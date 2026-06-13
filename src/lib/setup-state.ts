import { execFile } from "node:child_process";
import { pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { isPasswordValid } from "@/lib/password-policy";
import {
  closeDatabase,
  databaseFileExists,
  getAppSetting,
  getDatabase,
  getDatabaseFilePath,
  getDataDirectoryPath,
  setAppSetting,
} from "@/lib/points-db";
import {
  isSecretBox,
  type ProtectedSecret,
  protectSecret,
  revealSecret,
} from "@/lib/secret-box";
import {
  DEFAULT_NTP_SERVERS,
  getServerTimeStatusForServers,
  TIME_SKEW_THRESHOLD_MS,
} from "@/lib/time-sync";

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
  licenseAccepted: boolean;
  sudo: {
    email: string;
    fullName: string;
    password: string;
  };
};

type SetupEnvironmentCheck = {
  detailKey: string;
  detailValues?: Record<string, number | string>;
  id: string;
  ok: boolean;
  titleKey: string;
};

const SETUP_STATE_KEY = "setup-state";
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

const execFileAsync = promisify(execFile);

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

async function readSetupStateFromDatabaseFile() {
  const databasePath = getDatabaseFilePath();
  const script = `
const sqlite3 = require("sqlite3");
const [databasePath, setupStateKey] = process.argv.slice(1);
const db = new sqlite3.Database(databasePath, sqlite3.OPEN_READONLY, (openError) => {
  if (openError) {
    console.log("null");
    return;
  }

  db.get(
    "SELECT value_json FROM app_settings WHERE key = ?",
    [setupStateKey],
    (queryError, row) => {
      db.close(() => {
        if (queryError || !row) {
          console.log("null");
          return;
        }

        console.log(JSON.stringify({ valueJson: row.value_json }));
      });
    },
  );
});
`;

  try {
    const { stdout } = await execFileAsync(
      process.execPath,
      ["-e", script, databasePath, SETUP_STATE_KEY],
      { cwd: process.cwd(), timeout: 5000 },
    );
    const output = stdout.trim();

    if (!output || output === "null") {
      return null;
    }

    const payload = JSON.parse(output) as { valueJson?: string };
    return payload.valueJson
      ? (JSON.parse(payload.valueJson) as SetupState)
      : null;
  } catch {
    return null;
  }
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

export async function isSetupCompleteFromDatabaseFile() {
  const state = await readSetupStateFromDatabaseFile();
  return Boolean(state?.completedAt);
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

  await getDatabase();

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

  await setAppSetting(SETUP_STATE_KEY, state);
  return state;
}

function checkReadableWritableDataDirectory(dataDirectory: string) {
  try {
    fs.mkdirSync(dataDirectory, { recursive: true });
    fs.accessSync(dataDirectory, fs.constants.R_OK | fs.constants.W_OK);
    const probePath = path.join(
      dataDirectory,
      `.platelets-write-check-${process.pid}-${Date.now()}`,
    );
    fs.writeFileSync(probePath, "ok", { flag: "wx" });
    fs.readFileSync(probePath, "utf8");
    fs.rmSync(probePath, { force: true });
    return true;
  } catch {
    return false;
  }
}

function canDeleteDatabaseFile(databasePath: string) {
  if (!fs.existsSync(databasePath)) {
    return false;
  }

  try {
    fs.accessSync(databasePath, fs.constants.R_OK | fs.constants.W_OK);
    fs.accessSync(path.dirname(databasePath), fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

async function removeSetupDatabaseFile(targetPath: string) {
  const maxAttempts = 10;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      fs.rmSync(targetPath, { force: true });
      return;
    } catch (error) {
      if (!fs.existsSync(targetPath) || attempt === maxAttempts - 1) {
        throw error;
      }

      await new Promise((resolve) =>
        setTimeout(resolve, Math.min(50 * 2 ** attempt, 500)),
      );
    }
  }
}

export async function deleteSetupDatabaseFile() {
  const setupState = await readSetupStateFromDatabaseFile();
  const setupComplete = Boolean(setupState?.completedAt);

  if (setupComplete) {
    throw new Error("Setup is already complete.");
  }

  const databasePath = getDatabaseFilePath();

  if (!fs.existsSync(databasePath)) {
    return;
  }

  await closeDatabase();

  if (!fs.existsSync(databasePath)) {
    return;
  }

  if (!canDeleteDatabaseFile(databasePath)) {
    throw new Error("SQLite database file cannot be deleted.");
  }

  for (const targetPath of [
    `${databasePath}-wal`,
    `${databasePath}-shm`,
    databasePath,
  ]) {
    await removeSetupDatabaseFile(targetPath);
  }
}

export async function getSetupEnvironmentStatus(
  options: { serverReceivedAt?: Date } = {},
) {
  const dataDirectory = getDataDirectoryPath();
  const databasePath = getDatabaseFilePath();
  const writableDataDirectory =
    checkReadableWritableDataDirectory(dataDirectory);
  const hasDatabase = databaseFileExists();
  const setupState = hasDatabase
    ? await readSetupStateFromDatabaseFile()
    : null;
  const setupComplete = Boolean(setupState?.completedAt);
  const databaseCanDelete =
    hasDatabase && !setupComplete && canDeleteDatabaseFile(databasePath);
  const timeStatus = await getServerTimeStatusForServers(
    Array.from(DEFAULT_NTP_SERVERS),
    { serverReceivedAt: options.serverReceivedAt },
  );
  const selectedNtp = timeStatus.ntp.selected;
  const serverNtpOffsetMs = selectedNtp?.offsetMs ?? null;
  const serverNtpOk =
    serverNtpOffsetMs !== null &&
    Math.abs(serverNtpOffsetMs) <= TIME_SKEW_THRESHOLD_MS;
  const checks: SetupEnvironmentCheck[] = [
    {
      detailKey: "environment.node.detail",
      detailValues: { version: process.version },
      id: "node",
      ok: true,
      titleKey: "environment.node.title",
    },
    {
      detailKey: writableDataDirectory
        ? "environment.dataDirectory.writable"
        : "environment.dataDirectory.notWritable",
      detailValues: writableDataDirectory ? undefined : { path: dataDirectory },
      id: "data-directory",
      ok: writableDataDirectory,
      titleKey: "environment.dataDirectory.title",
    },
    {
      detailKey: hasDatabase
        ? "environment.sqlite.exists"
        : "environment.sqlite.absent",
      detailValues: hasDatabase ? { path: databasePath } : undefined,
      id: "sqlite",
      ok: !hasDatabase || !setupComplete,
      titleKey: "environment.sqlite.title",
    },
    {
      detailKey: serverNtpOk
        ? "environment.ntp.ok"
        : selectedNtp
          ? "environment.ntp.skewed"
          : "environment.ntp.unavailable",
      detailValues: selectedNtp
        ? {
            host: selectedNtp.host,
            offsetSeconds: ((serverNtpOffsetMs ?? 0) / 1000).toFixed(2),
            thresholdSeconds: (TIME_SKEW_THRESHOLD_MS / 1000).toFixed(0),
          }
        : {
            thresholdSeconds: (TIME_SKEW_THRESHOLD_MS / 1000).toFixed(0),
          },
      id: "server-ntp-clock",
      ok: serverNtpOk,
      titleKey: "environment.ntp.title",
    },
  ];

  return {
    checks,
    databaseCanDelete,
    databaseExists: hasDatabase,
    ready: checks.every((check) => check.ok),
    time: timeStatus,
  };
}
