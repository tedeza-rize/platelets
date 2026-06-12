import { pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";
import fs from "node:fs";
import { isPasswordValid } from "@/lib/password-policy";
import {
  databaseFileExists,
  getAppSetting,
  getDatabase,
  getDataDirectoryPath,
  setAppSetting,
} from "@/lib/points-db";

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

export type SetupState = {
  accounts: Record<SetupRole, SetupAccount>;
  apiKeys: SetupApiKeys;
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
  licenseAccepted: boolean;
  sudo: {
    email: string;
    fullName: string;
    password: string;
  };
};

const SETUP_STATE_KEY = "setup-state";
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

function accountFromPayload(
  role: SetupRole,
  input: SetupPayload[SetupRole],
): SetupAccount {
  const fullName = cleanText(input.fullName, 120);
  const email = cleanText(input.email, 200).toLowerCase();
  const password = String(input.password ?? "");

  if (!fullName) {
    throw new Error(`${role} full name is required.`);
  }
  assertEmail(email, role);
  assertPassword(password, role);

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
  return state?.apiKeys ?? EMPTY_API_KEYS;
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

  await getDatabase();

  const completedAt = new Date().toISOString();
  const state: SetupState = {
    accounts: {
      admin: accountFromPayload("admin", payload.admin),
      sudo: accountFromPayload("sudo", payload.sudo),
    },
    apiKeys: normalizeApiKeys(payload.apiKeys),
    completedAt,
    licenseAcceptedAt: completedAt,
  };

  await setAppSetting(SETUP_STATE_KEY, state);
  return state;
}

export function getSetupEnvironmentStatus() {
  const dataDirectory = getDataDirectoryPath();

  return {
    checks: [
      {
        detail: `Node ${process.version}`,
        id: "node",
        ok: true,
        title: "Node.js runtime",
      },
      {
        detail: fs.existsSync(dataDirectory)
          ? "Data directory exists."
          : "Data directory will be created during installation.",
        id: "data-directory",
        ok: true,
        title: "Writable data directory",
      },
      {
        detail: databaseFileExists()
          ? "SQLite database file exists."
          : "SQLite database file will be created.",
        id: "sqlite",
        ok: true,
        title: "SQLite database",
      },
    ],
    databaseExists: databaseFileExists(),
  };
}
