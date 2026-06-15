import fs from "node:fs";
import path from "node:path";
import {
  getDatabaseConfig,
  isDatabaseConfigEnvironmentManaged,
} from "@/lib/database/config";
import {
  closeDatabase,
  databaseFileExists,
  getDatabaseFilePath,
  getDataDirectoryPath,
} from "@/lib/points-db";
import {
  getSetupState,
  SETUP_STATE_KEY,
  type SetupState,
} from "@/lib/setup-state";
import {
  closeSqliteDatabase,
  getSqlite,
  openSqliteDatabase,
} from "@/lib/sqlite";
import {
  DEFAULT_NTP_SERVERS,
  getServerTimeStatusForServers,
  TIME_SKEW_THRESHOLD_MS,
} from "@/lib/time-sync";

type SetupEnvironmentCheck = {
  detailKey: string;
  detailValues?: Record<string, number | string>;
  id: string;
  ok: boolean;
  titleKey: string;
};

async function readSetupStateFromDatabaseFile() {
  const databasePath = getDatabaseFilePath();

  if (!fs.existsSync(databasePath)) {
    return null;
  }

  try {
    const db = openSqliteDatabase(databasePath, { readonly: true });

    try {
      const row = await getSqlite<{ value_json: string }>(
        db,
        "SELECT value_json FROM app_settings WHERE key = ?",
        [SETUP_STATE_KEY],
      );
      return row?.value_json
        ? (JSON.parse(row.value_json) as SetupState)
        : null;
    } finally {
      await closeSqliteDatabase(db);
    }
  } catch {
    return null;
  }
}

async function readSetupStateFromConfiguredDatabase() {
  if (getDatabaseConfig().engine === "sqlite") {
    return readSetupStateFromDatabaseFile();
  }

  try {
    return await getSetupState();
  } catch {
    return null;
  }
}

function ntpDetailKey(serverNtpOk: boolean, hasSelectedNtp: boolean) {
  if (serverNtpOk) {
    return "environment.ntp.ok";
  }

  return hasSelectedNtp
    ? "environment.ntp.skewed"
    : "environment.ntp.unavailable";
}

export async function isSetupCompleteFromDatabaseFile() {
  const state = await readSetupStateFromConfiguredDatabase();
  return Boolean(state?.completedAt);
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
  if (getDatabaseConfig().engine !== "sqlite") {
    throw new Error("SQLite database file deletion is unavailable.");
  }

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
  const databaseConfig = getDatabaseConfig();
  const dataDirectory = getDataDirectoryPath();
  const databasePath = getDatabaseFilePath();
  const writableDataDirectory =
    checkReadableWritableDataDirectory(dataDirectory);
  const hasDatabase = databaseFileExists();
  const setupState = hasDatabase
    ? await readSetupStateFromConfiguredDatabase()
    : null;
  const setupComplete = Boolean(setupState?.completedAt);
  const databaseCanDelete =
    databaseConfig.engine === "sqlite" &&
    hasDatabase &&
    !setupComplete &&
    canDeleteDatabaseFile(databasePath);
  const timeStatus = await getServerTimeStatusForServers(
    Array.from(DEFAULT_NTP_SERVERS),
    { serverReceivedAt: options.serverReceivedAt },
  );
  const selectedNtp = timeStatus.ntp.selected;
  const serverNtpOffsetMs = selectedNtp?.offsetMs ?? null;
  const serverNtpOk =
    serverNtpOffsetMs !== null &&
    Math.abs(serverNtpOffsetMs) <= TIME_SKEW_THRESHOLD_MS;
  const databaseCheck: SetupEnvironmentCheck =
    databaseConfig.engine === "sqlite"
      ? {
          detailKey: hasDatabase
            ? "environment.sqlite.exists"
            : "environment.sqlite.absent",
          detailValues: hasDatabase ? { path: databasePath } : undefined,
          id: "sqlite",
          ok: !(hasDatabase && setupComplete),
          titleKey: "environment.sqlite.title",
        }
      : {
          detailKey: "environment.database.external",
          id: "database",
          ok: true,
          titleKey: "environment.database.title",
        };
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
    databaseCheck,
    {
      detailKey: ntpDetailKey(serverNtpOk, Boolean(selectedNtp)),
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
    database: {
      engine: databaseConfig.engine,
      managedByEnvironment: isDatabaseConfigEnvironmentManaged(),
    },
    databaseCanDelete,
    databaseExists: hasDatabase,
    ready: checks.every((check) => check.ok),
    time: timeStatus,
  };
}
