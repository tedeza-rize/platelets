import fs from "node:fs";
import path from "node:path";
import {
  closeSqliteDatabase,
  openSqliteDatabase,
  runSqlite,
  type SqliteDatabase,
} from "@/lib/sqlite";

const configuredDataDirectory = process.env.PLATELETS_DATA_DIR;
const dataDirectory = configuredDataDirectory
  ? path.isAbsolute(configuredDataDirectory)
    ? configuredDataDirectory
    : path.join(
        /*turbopackIgnore: true*/ process.cwd(),
        configuredDataDirectory,
      )
  : path.join(process.cwd(), "data");
const databasePath = path.join(dataDirectory, "points.sqlite");

let databasePromise: Promise<SqliteDatabase> | null = null;
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

const DATABASE_SCHEMA = `
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS points (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source TEXT NOT NULL,
    source_record_id TEXT NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    address TEXT NOT NULL,
    phone TEXT,
    parent_name TEXT,
    latitude REAL,
    longitude REAL,
    source_updated_at TEXT,
    raw_json TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(source, source_record_id)
  );
  CREATE TABLE IF NOT EXISTS dataset_updates (
    source TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    source_url TEXT NOT NULL,
    fetched_at TEXT,
    record_count INTEGER NOT NULL DEFAULT 0,
    geocoded_count INTEGER NOT NULL DEFAULT 0,
    skipped_count INTEGER NOT NULL DEFAULT 0,
    failed_count INTEGER NOT NULL DEFAULT 0,
    error TEXT,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS dataset_import_progress (
    source TEXT PRIMARY KEY,
    status TEXT NOT NULL,
    mode TEXT NOT NULL,
    next_index INTEGER NOT NULL DEFAULT 0,
    total_count INTEGER NOT NULL DEFAULT 0,
    imported_count INTEGER NOT NULL DEFAULT 0,
    geocoded_count INTEGER NOT NULL DEFAULT 0,
    skipped_count INTEGER NOT NULL DEFAULT 0,
    failed_count INTEGER NOT NULL DEFAULT 0,
    reason TEXT,
    points_json TEXT NOT NULL DEFAULT '[]',
    fetched_at TEXT NOT NULL,
    started_at TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS api_usage_windows (
    provider TEXT PRIMARY KEY,
    registered_at TEXT,
    window_started_at TEXT,
    window_ends_at TEXT,
    used_count INTEGER NOT NULL DEFAULT 0,
    monthly_limit INTEGER NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS api_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    level TEXT NOT NULL,
    category TEXT NOT NULL,
    source TEXT,
    action TEXT NOT NULL,
    status TEXT NOT NULL,
    message TEXT NOT NULL,
    request_count INTEGER NOT NULL DEFAULT 0,
    metadata_json TEXT NOT NULL DEFAULT '{}'
  );
  CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value_json TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS admin_update_cooldowns (
    action TEXT PRIMARY KEY,
    last_used_at TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    password_iterations INTEGER NOT NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    department TEXT NOT NULL,
    role TEXT NOT NULL,
    phone TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS incident_push_subscriptions (
    endpoint TEXT PRIMARY KEY,
    subscription_json TEXT NOT NULL,
    locale TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS hazard_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id TEXT NOT NULL UNIQUE,
    event_type TEXT NOT NULL,
    title TEXT NOT NULL,
    issued_at TEXT,
    occurred_at TEXT,
    latitude REAL,
    longitude REAL,
    location TEXT NOT NULL,
    magnitude TEXT,
    intensity TEXT,
    depth TEXT,
    description TEXT,
    image_url TEXT,
    raw_json TEXT NOT NULL,
    fetched_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS assembly_protests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_id TEXT NOT NULL,
    source_record_id TEXT NOT NULL,
    source_url TEXT NOT NULL,
    detail_url TEXT,
    agency TEXT NOT NULL,
    date TEXT NOT NULL,
    source_title TEXT NOT NULL,
    starts_at TEXT,
    ends_at TEXT,
    location TEXT NOT NULL,
    location_scope TEXT,
    latitude REAL,
    longitude REAL,
    crowd_size INTEGER,
    raw_json TEXT NOT NULL,
    fetched_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(source_id, source_record_id, date)
  );
  CREATE TABLE IF NOT EXISTS assembly_geocode_cache (
    cache_key TEXT PRIMARY KEY,
    query TEXT NOT NULL,
    search_mode TEXT NOT NULL,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    matched_address TEXT,
    provider_source TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS points_source_idx ON points(source);
  CREATE INDEX IF NOT EXISTS points_coordinates_idx ON points(latitude, longitude);
  CREATE INDEX IF NOT EXISTS api_logs_event_idx ON api_logs(event_at DESC);
  CREATE INDEX IF NOT EXISTS api_logs_category_idx ON api_logs(category, event_at DESC);
  CREATE INDEX IF NOT EXISTS users_role_idx ON users(role, username);
  CREATE INDEX IF NOT EXISTS hazard_events_event_idx ON hazard_events(event_type, issued_at DESC);
  CREATE INDEX IF NOT EXISTS hazard_events_coordinates_idx ON hazard_events(latitude, longitude);
  CREATE INDEX IF NOT EXISTS assembly_protests_date_idx ON assembly_protests(date, agency);
  CREATE INDEX IF NOT EXISTS assembly_protests_coordinates_idx ON assembly_protests(latitude, longitude);
  CREATE INDEX IF NOT EXISTS assembly_geocode_cache_updated_idx ON assembly_geocode_cache(updated_at DESC);
`;

export function getDatabaseFilePath() {
  return databasePath;
}

export function getDataDirectoryPath() {
  return dataDirectory;
}

export function databaseFileExists() {
  return fs.existsSync(databasePath);
}

export async function getDatabase() {
  if (!databasePromise) {
    databasePromise = (async () => {
      fs.mkdirSync(dataDirectory, { recursive: true });
      const db = openSqliteDatabase(databasePath);

      try {
        await runSqlite(db, DATABASE_SCHEMA);
        return db;
      } catch (error) {
        await closeSqliteDatabase(db).catch(() => undefined);
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
    await closeSqliteDatabase(await promise);
  } catch {
    return;
  }
}

export async function withDatabaseWriteTransaction<T>(
  operation: (db: SqliteDatabase) => Promise<T>,
) {
  const safety = getSqliteWriteSafetyStatus();

  if (!safety.writesAllowed) {
    throw new Error(
      [
        "SQLite writes are disabled for this deployment.",
        safety.reason,
        "Set PLATELETS_SQLITE_WRITE_MODE=single-process only when exactly one persistent server process owns the database file, or migrate writes to an external database.",
      ]
        .filter(Boolean)
        .join(" "),
    );
  }

  const previousTransaction = writeTransactionQueue;
  let releaseTransaction = () => {
    // Assigned by the queue promise constructor below.
  };
  writeTransactionQueue = new Promise<void>((resolve) => {
    releaseTransaction = resolve;
  });

  await previousTransaction;
  const db = await getDatabase();
  let transactionStarted = false;

  try {
    await runSqlite(db, "BEGIN IMMEDIATE");
    transactionStarted = true;
    const result = await operation(db);
    await runSqlite(db, "COMMIT");
    return result;
  } catch (error) {
    if (transactionStarted) {
      await runSqlite(db, "ROLLBACK").catch(() => undefined);
    }
    throw error;
  } finally {
    releaseTransaction();
  }
}
