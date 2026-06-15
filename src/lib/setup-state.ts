import { pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";
import {
  type DatabaseConfig,
  deleteStoredDatabaseConfig,
  getDatabaseConfig,
  isDatabaseConfigEnvironmentManaged,
  normalizeDatabaseConfig,
  saveDatabaseConfig,
  testDatabaseConfig,
} from "@/lib/database/config";
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
const ROLE_LABELS: Record<SetupRole, string> = {
  admin: "operator",
  sudo: "administrator",
};

const EMPTY_API_KEYS: SetupApiKeys = {
  kakaoMobilityRestApiKey: "",
  kakaoRestApiKey: "",
  openaiApiKey: "",
  openaiBaseUrl: "https://api.openai.com/v1",
  publicDataApiKey: "",
  seoulOpenApiKey: "",
  vworldApiKey: "",
};

function cleanText(value: unknown, maxLength: number) {
  return String(value ?? "")
    .trim()
    .slice(0, maxLength);
}

function assertEmail(value: string, label: string) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    throw new Error(`${label} email is invalid.`);
  }
}

function assertPassword(value: string, label: string) {
  if (!isPasswordValid(value)) {
    throw new Error(
      `${label} password must be at least 12 characters and include lowercase, uppercase, number, and special characters.`,
    );
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
    openaiBaseUrl:
      cleanText(input.openaiBaseUrl, 500) || EMPTY_API_KEYS.openaiBaseUrl,
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
  const label = ROLE_LABELS[role];
  const fullName = cleanText(input.fullName, 120);
  const email = cleanText(input.email, 200).toLowerCase();
  const password = String(input.password ?? "");

  if (!fullName) {
    throw new Error(`${label} full name is required.`);
  }
  assertEmail(email, label);
  assertPassword(password, label);

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
    throw new Error("Setup is already complete.");
  }

  if (!payload.licenseAccepted) {
    throw new Error("License agreement must be accepted.");
  }

  const databaseConfig = isDatabaseConfigEnvironmentManaged()
    ? getDatabaseConfig()
    : normalizeDatabaseConfig(
        payload.database ?? { connectionString: "", engine: "sqlite" },
      );
  const completedAt = new Date().toISOString();
  const state: SetupState = {
    accounts: {
      admin: accountFromPayload("admin", payload.admin),
      sudo: accountFromPayload("sudo", payload.sudo),
    },
    apiKeys: protectApiKeys(normalizeApiKeys(payload.apiKeys)),
    completedAt,
    licenseAcceptedAt: completedAt,
  };

  await testDatabaseConfig(databaseConfig);

  let savedDatabaseConfig = false;

  try {
    if (!isDatabaseConfigEnvironmentManaged()) {
      saveDatabaseConfig(databaseConfig);
      savedDatabaseConfig = true;
      await closeDatabase();
    }

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
  return state;
}
