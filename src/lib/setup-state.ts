import { pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";
import {
  type DatabaseConfig,
  deleteStoredDatabaseConfig,
  normalizeDatabaseConfig,
  saveDatabaseConfig,
  testDatabaseConfig,
} from "@/lib/database/config";
import {
  type IntegrationSettingsUpdate,
  saveIntegrationSettings,
} from "@/lib/integration-settings";
import { isPasswordValid } from "@/lib/password-policy";
import {
  closeDatabase,
  databaseFileExists,
  getAppSetting,
  getDatabase,
  setAppSetting,
} from "@/lib/points-db";
import {
  isSecretBox,
  type ProtectedSecret,
  protectSecret,
  revealSecret,
} from "@/lib/secret-box";
import { ensureSetupUsers } from "@/lib/users";

export type SetupRole = "admin" | "sudo";

export type SetupAccount = {
  email: string;
  fullName: string;
  iterations: number;
  passwordHash: string;
  role: SetupRole;
  salt: string;
};

export type SetupApiKeys = {
  kakaoMobilityRestApiKey: string;
  kakaoRestApiKey: string;
  openaiApiKey: string;
  openaiBaseUrl: string;
  publicDataApiKey: string;
  seoulOpenApiKey: string;
  vworldApiKey: string;
};

export type ApiKeyConfigurationSummary = {
  configured: Record<Exclude<keyof SetupApiKeys, "openaiBaseUrl">, boolean>;
};

export type SetupDatabaseSelection = {
  connectionString?: string;
  engine?: DatabaseConfig["engine"];
};

type StoredSetupApiKeys = Omit<
  SetupApiKeys,
  | "kakaoMobilityRestApiKey"
  | "kakaoRestApiKey"
  | "openaiApiKey"
  | "publicDataApiKey"
  | "seoulOpenApiKey"
  | "vworldApiKey"
> & {
  kakaoMobilityRestApiKey: ProtectedSecret;
  kakaoRestApiKey: ProtectedSecret;
  openaiApiKey: ProtectedSecret;
  publicDataApiKey: ProtectedSecret;
  seoulOpenApiKey: ProtectedSecret;
  vworldApiKey: ProtectedSecret;
};

export type SetupState = {
  accounts: Record<SetupRole, SetupAccount>;
  apiKeys: StoredSetupApiKeys;
  completedAt: string;
  licenseAcceptedAt: string;
};

export type SetupPayload = {
  admin: {
    email: string;
    fullName: string;
    password: string;
  };
  apiKeys: Partial<SetupApiKeys>;
  database?: SetupDatabaseSelection;
  integrations?: IntegrationSettingsUpdate;
  licenseAccepted: boolean;
  sudo: {
    email: string;
    fullName: string;
    password: string;
  };
};

export const SETUP_STATE_KEY = "setup-state";
const PASSWORD_ITERATIONS = 210_000;
const PASSWORD_KEY_LENGTH = 32;

const EMPTY_API_KEYS: SetupApiKeys = {
  kakaoMobilityRestApiKey: "",
  kakaoRestApiKey: "",
  openaiApiKey: "",
  openaiBaseUrl: "https://api.openai.com/v1",
  publicDataApiKey: "",
  seoulOpenApiKey: "",
  vworldApiKey: "",
};

export class SetupStateError extends Error {
  readonly errorKey: string;

  constructor(errorKey: string) {
    super(errorKey);
    this.errorKey = errorKey;
    this.name = "SetupStateError";
  }
}

export function getSetupStateErrorKey(error: unknown) {
  return error instanceof SetupStateError ? error.errorKey : null;
}

function setupError(errorKey: string): never {
  throw new SetupStateError(errorKey);
}

function cleanText(value: unknown, maxLength: number) {
  return String(value ?? "")
    .trim()
    .slice(0, maxLength);
}

function cleanOpenAiBaseUrl(value: unknown) {
  const candidate = cleanText(value, 500) || EMPTY_API_KEYS.openaiBaseUrl;
  let url: URL;

  try {
    url = new URL(candidate);
  } catch {
    setupError("validation.api.openaiBaseUrl");
  }

  if (url.protocol !== "https:" || url.username || url.password) {
    setupError("validation.api.openaiBaseUrlSecure");
  }

  return url.toString().replace(/\/$/, "");
}

function assertEmail(value: string) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    setupError("validation.account.email");
  }
}

function assertPassword(value: string) {
  if (!isPasswordValid(value)) {
    setupError("validation.account.password");
  }
}

function hashPassword(password: string) {
  const salt = randomBytes(16).toString("base64url");
  const passwordHash = pbkdf2Sync(
    password,
    salt,
    PASSWORD_ITERATIONS,
    PASSWORD_KEY_LENGTH,
    "sha256",
  ).toString("base64url");

  return {
    iterations: PASSWORD_ITERATIONS,
    passwordHash,
    salt,
  };
}

function verifyPassword(password: string, account: SetupAccount) {
  const expected = Buffer.from(account.passwordHash, "base64url");
  const actual = pbkdf2Sync(
    password,
    account.salt,
    account.iterations,
    expected.length,
    "sha256",
  );

  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function normalizeApiKeys(input: Partial<SetupApiKeys> = {}): SetupApiKeys {
  return {
    kakaoMobilityRestApiKey: cleanText(input.kakaoMobilityRestApiKey, 500),
    kakaoRestApiKey: cleanText(input.kakaoRestApiKey, 500),
    openaiApiKey: cleanText(input.openaiApiKey, 500),
    openaiBaseUrl: cleanOpenAiBaseUrl(input.openaiBaseUrl),
    publicDataApiKey: cleanText(input.publicDataApiKey, 1000),
    seoulOpenApiKey: cleanText(input.seoulOpenApiKey, 500),
    vworldApiKey: cleanText(input.vworldApiKey, 500),
  };
}

function protectApiKeys(input: SetupApiKeys): StoredSetupApiKeys {
  return {
    kakaoMobilityRestApiKey: protectSecret(input.kakaoMobilityRestApiKey),
    kakaoRestApiKey: protectSecret(input.kakaoRestApiKey),
    openaiApiKey: protectSecret(input.openaiApiKey),
    openaiBaseUrl: input.openaiBaseUrl,
    publicDataApiKey: protectSecret(input.publicDataApiKey),
    seoulOpenApiKey: protectSecret(input.seoulOpenApiKey),
    vworldApiKey: protectSecret(input.vworldApiKey),
  };
}

function revealApiKeys(input: SetupState["apiKeys"]): SetupApiKeys {
  return {
    kakaoMobilityRestApiKey: revealSecret(input.kakaoMobilityRestApiKey),
    kakaoRestApiKey: revealSecret(input.kakaoRestApiKey),
    openaiApiKey: revealSecret(input.openaiApiKey),
    openaiBaseUrl:
      cleanText(input.openaiBaseUrl, 500) || EMPTY_API_KEYS.openaiBaseUrl,
    publicDataApiKey: revealSecret(input.publicDataApiKey),
    seoulOpenApiKey: revealSecret(input.seoulOpenApiKey),
    vworldApiKey: revealSecret(input.vworldApiKey),
  };
}

function hasPlainApiKeys(input: SetupState["apiKeys"]) {
  return [
    input.kakaoMobilityRestApiKey,
    input.kakaoRestApiKey,
    input.openaiApiKey,
    input.publicDataApiKey,
    input.seoulOpenApiKey,
    input.vworldApiKey,
  ].some((value) => Boolean(value) && !isSecretBox(value));
}

function accountFromPayload(
  role: SetupRole,
  input: SetupPayload[SetupRole],
): SetupAccount {
  const fullName = cleanText(input.fullName, 120);
  const email = cleanText(input.email, 200).toLowerCase();
  const password = String(input.password ?? "");

  if (!fullName) {
    setupError("validation.account.fullName");
  }
  assertEmail(email);
  assertPassword(password);

  return {
    email,
    fullName,
    role,
    ...hashPassword(password),
  };
}

export async function getSetupState() {
  if (!databaseFileExists()) {
    return null;
  }

  const state = await getAppSetting<SetupState | null>(SETUP_STATE_KEY, null);
  return state?.completedAt ? state : null;
}

export async function isSetupComplete() {
  return Boolean(await getSetupState());
}

export async function getConfiguredApiKeys() {
  const state = await getSetupState();

  if (!state) {
    return EMPTY_API_KEYS;
  }

  const apiKeys = revealApiKeys(state.apiKeys);

  if (hasPlainApiKeys(state.apiKeys)) {
    await setAppSetting(SETUP_STATE_KEY, {
      ...state,
      apiKeys: protectApiKeys(apiKeys),
    });
  }

  return apiKeys;
}

export async function getApiKeyConfigurationSummary(): Promise<ApiKeyConfigurationSummary> {
  const keys = await getConfiguredApiKeys();

  return {
    configured: {
      kakaoMobilityRestApiKey: Boolean(keys.kakaoMobilityRestApiKey),
      kakaoRestApiKey: Boolean(keys.kakaoRestApiKey),
      openaiApiKey: Boolean(keys.openaiApiKey),
      publicDataApiKey: Boolean(keys.publicDataApiKey),
      seoulOpenApiKey: Boolean(keys.seoulOpenApiKey),
      vworldApiKey: Boolean(keys.vworldApiKey),
    },
  };
}

export async function saveConfiguredApiKeys(
  input: Partial<SetupApiKeys>,
  clearKeys: Exclude<keyof SetupApiKeys, "openaiBaseUrl">[] = [],
) {
  const state = await getSetupState();

  if (!state) {
    throw new Error("Setup is not complete.");
  }

  const current = revealApiKeys(state.apiKeys);
  const next = { ...current };
  const secretFields = [
    "kakaoMobilityRestApiKey",
    "kakaoRestApiKey",
    "openaiApiKey",
    "publicDataApiKey",
    "seoulOpenApiKey",
    "vworldApiKey",
  ] as const;

  for (const field of secretFields) {
    if (clearKeys.includes(field)) {
      next[field] = "";
      continue;
    }

    const value = cleanText(
      input[field],
      field === "publicDataApiKey" ? 1000 : 500,
    );
    if (value) {
      next[field] = value;
    }
  }

  if (input.openaiBaseUrl !== undefined) {
    next.openaiBaseUrl = cleanOpenAiBaseUrl(input.openaiBaseUrl);
  }

  await setAppSetting(SETUP_STATE_KEY, {
    ...state,
    apiKeys: protectApiKeys(normalizeApiKeys(next)),
  });

  return getApiKeyConfigurationSummary();
}

export async function getStoredAccessRole(password: string) {
  if (!password) {
    return null;
  }

  const state = await getSetupState();

  if (!state) {
    return null;
  }

  if (verifyPassword(password, state.accounts.sudo)) {
    return "sudo" as const;
  }

  if (verifyPassword(password, state.accounts.admin)) {
    return "admin" as const;
  }

  return null;
}

export async function completeSetup(payload: SetupPayload) {
  if (await isSetupComplete()) {
    setupError("database.alreadyInstalled");
  }

  if (!payload.licenseAccepted) {
    setupError("validation.license");
  }

  const databaseConfig = normalizeDatabaseConfig(
    payload.database ?? { connectionString: "", engine: "sqlite" },
  );
  const apiKeys = normalizeApiKeys(payload.apiKeys);
  const completedAt = new Date().toISOString();
  const state: SetupState = {
    accounts: {
      admin: accountFromPayload("admin", payload.admin),
      sudo: accountFromPayload("sudo", payload.sudo),
    },
    apiKeys: protectApiKeys(apiKeys),
    completedAt,
    licenseAcceptedAt: completedAt,
  };

  await testDatabaseConfig(databaseConfig);

  let savedDatabaseConfig = false;

  try {
    saveDatabaseConfig(databaseConfig);
    savedDatabaseConfig = true;
    await closeDatabase();

    await getDatabase();
  } catch (error) {
    if (savedDatabaseConfig) {
      await closeDatabase();
      deleteStoredDatabaseConfig();
    }

    throw error;
  }

  await ensureSetupUsers({
    admin: {
      email: state.accounts.admin.email,
      name: state.accounts.admin.fullName,
      password: payload.admin.password,
    },
    sudo: {
      email: state.accounts.sudo.email,
      name: state.accounts.sudo.fullName,
      password: payload.sudo.password,
    },
  });
  await setAppSetting(SETUP_STATE_KEY, state);
  await setAppSetting("ai-settings", { baseUrl: apiKeys.openaiBaseUrl });
  if (payload.integrations) {
    await saveIntegrationSettings(payload.integrations);
  }
  return state;
}
