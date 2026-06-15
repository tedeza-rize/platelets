import fs from "node:fs";
import {
  getSqliteDatabasePath,
  getDataDirectoryPath as resolveDataDirectoryPath,
} from "@/lib/data-paths";
import { getDatabaseConfig, openDatabaseClient } from "@/lib/database/config";
import { initializeDatabaseSchema } from "@/lib/database/schema";
import type { DatabaseClient } from "@/lib/database/types";

const dataDirectory = resolveDataDirectoryPath();
const databasePath = getSqliteDatabasePath();
let databasePromise: Promise<DatabaseClient> | null = null;
let writeTransactionQueue: Promise<void> = Promise.resolve();

export type SqliteWriteSafetyStatus = {
  deploymentSignals: string[];
  mode: "blocked" | "single-process";
  reason: string | null;
  writesAllowed: boolean;
};

const SERVERLESS_DEPLOYMENT_SIGNALS = [
  "AWS_EXECUTION_ENV",
  "AWS_LAMBDA_FUNCTION_NAME",
  "FUNCTIONS_WORKER_RUNTIME",
  "K_SERVICE",
  "LAMBDA_TASK_ROOT",
  "VERCEL",
  "WEBSITE_INSTANCE_ID",
] as const;

function clean(value: string | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function detectedDeploymentSignals() {
  return SERVERLESS_DEPLOYMENT_SIGNALS.filter((name) =>
    Boolean(process.env[name]?.trim()),
  );
}

function explicitWriteMode() {
  const mode = clean(process.env.PLATELETS_SQLITE_WRITE_MODE);

  if (
    mode === "single-process" ||
    mode === "single-writer" ||
    mode === "local"
  ) {
    return "single-process";
  }

  if (
    mode === "blocked" ||
    mode === "multi-instance" ||
    mode === "read-only" ||
    mode === "readonly" ||
    mode === "serverless"
  ) {
    return "blocked";
  }

  return null;
}

export function getSqliteWriteSafetyStatus(): SqliteWriteSafetyStatus {
  const mode = explicitWriteMode();
  const deploymentSignals = detectedDeploymentSignals();

  if (mode === "single-process") {
    return {
      deploymentSignals,
      mode,
      reason: null,
      writesAllowed: true,
    };
  }

  if (mode === "blocked") {
    return {
      deploymentSignals,
      mode,
      reason: "PLATELETS_SQLITE_WRITE_MODE disables SQLite writes.",
      writesAllowed: false,
    };
  }

  if (deploymentSignals.length > 0) {
    return {
      deploymentSignals,
      mode: "blocked",
      reason:
        "Serverless or multi-instance deployment signals were detected. SQLite writes require one persistent application process.",
      writesAllowed: false,
    };
  }

  return {
    deploymentSignals,
    mode: "single-process",
    reason: null,
    writesAllowed: true,
  };
}

export function getDatabaseFilePath() {
  return databasePath;
}

export function getDataDirectoryPath() {
  return dataDirectory;
}

export function databaseFileExists() {
  const config = getDatabaseConfig();
  return config.engine === "sqlite" ? fs.existsSync(databasePath) : true;
}

export async function getDatabase() {
  if (!databasePromise) {
    databasePromise = (async () => {
      fs.mkdirSync(dataDirectory, { recursive: true });
      const db = openDatabaseClient(getDatabaseConfig());

      try {
        await initializeDatabaseSchema(db);
        return db;
      } catch (error) {
        await db.close().catch(() => undefined);
        throw error;
      }
    })();
  }

  return databasePromise;
}

export async function closeDatabase() {
  if (!databasePromise) {
    return;
  }

  const promise = databasePromise;
  databasePromise = null;

  try {
    await (await promise).close();
  } catch {
    // Closing an already-failed connection is a best-effort cleanup.
  }
}

function assertWritesAllowed(db: DatabaseClient) {
  if (db.engine !== "sqlite") {
    return;
  }

  const safety = getSqliteWriteSafetyStatus();

  if (!safety.writesAllowed) {
    throw new Error(
      [
        "SQLite writes are disabled for this deployment.",
        safety.reason,
        "Set PLATELETS_SQLITE_WRITE_MODE=single-process only when exactly one persistent server process owns the database file, or select an external database.",
      ]
        .filter(Boolean)
        .join(" "),
    );
  }
}

export async function withDatabaseWriteTransaction<T>(
  operation: (db: DatabaseClient) => Promise<T>,
) {
  const previousTransaction = writeTransactionQueue;
  let releaseTransaction = () => {
    // Assigned by the queue promise constructor below.
  };
  writeTransactionQueue = new Promise<void>((resolve) => {
    releaseTransaction = resolve;
  });

  await previousTransaction;

  try {
    const db = await getDatabase();
    assertWritesAllowed(db);
    return await db.transaction(operation);
  } finally {
    releaseTransaction();
  }
}
