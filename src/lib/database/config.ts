import fs from "node:fs";
import path from "node:path";
import { getDataDirectoryPath, getSqliteDatabasePath } from "@/lib/data-paths";
import { openMysqlClient } from "@/lib/database/mysql-adapter";
import { openPostgresqlClient } from "@/lib/database/postgresql-adapter";
import { openSqliteClient } from "@/lib/database/sqlite-adapter";
import type { DatabaseClient, DatabaseEngine } from "@/lib/database/types";
import {
  type ProtectedSecret,
  protectSecret,
  revealSecret,
} from "@/lib/secret-box";

export type DatabaseConfig = {
  connectionString: string;
  engine: DatabaseEngine;
};

type StoredDatabaseConfig = {
  configuredAt: string;
  connectionString: ProtectedSecret;
  engine: DatabaseEngine;
  version: 1;
};

const DATABASE_CONFIG_FILE = "database-config.json";
const DATABASE_ENGINES = new Set<DatabaseEngine>([
  "mariadb",
  "mysql",
  "postgresql",
  "sqlite",
]);

function databaseConfigPath() {
  return path.join(getDataDirectoryPath(), DATABASE_CONFIG_FILE);
}

function normalizeEngine(value: unknown): DatabaseEngine {
  const engine = String(value ?? "")
    .trim()
    .toLowerCase() as DatabaseEngine;

  if (!DATABASE_ENGINES.has(engine)) {
    throw new Error("Database engine is not supported.");
  }

  return engine;
}

function normalizeConnectionString(engine: DatabaseEngine, value: unknown) {
  if (engine === "sqlite") {
    return "";
  }

  const connectionString = String(value ?? "").trim();

  if (!connectionString || connectionString.length > 2_000) {
    throw new Error("Database connection address is invalid.");
  }

  let url: URL;

  try {
    url = new URL(connectionString);
  } catch (error) {
    throw new Error("Database connection address is invalid.", {
      cause: error,
    });
  }

  const allowedProtocols =
    engine === "postgresql"
      ? new Set(["postgres:", "postgresql:"])
      : new Set(["mysql:"]);

  if (!(allowedProtocols.has(url.protocol) && url.hostname && url.pathname)) {
    throw new Error("Database connection address is invalid.");
  }

  return connectionString;
}

export function normalizeDatabaseConfig(input: {
  connectionString?: unknown;
  engine?: unknown;
}): DatabaseConfig {
  const engine = normalizeEngine(input.engine);
  return {
    connectionString: normalizeConnectionString(engine, input.connectionString),
    engine,
  };
}

function storedDatabaseConfig(): DatabaseConfig | null {
  const configPath = databaseConfigPath();

  if (!fs.existsSync(configPath)) {
    return null;
  }

  const stored = JSON.parse(
    fs.readFileSync(configPath, "utf8"),
  ) as StoredDatabaseConfig;
  const engine = normalizeEngine(stored.engine);

  return {
    connectionString: normalizeConnectionString(
      engine,
      revealSecret(stored.connectionString),
    ),
    engine,
  };
}

export function getDatabaseConfig(): DatabaseConfig {
  return storedDatabaseConfig() ?? { connectionString: "", engine: "sqlite" };
}

export function hasStoredDatabaseConfig() {
  return fs.existsSync(databaseConfigPath());
}

export function saveDatabaseConfig(config: DatabaseConfig) {
  const normalized = normalizeDatabaseConfig(config);
  const dataDirectory = getDataDirectoryPath();
  const configPath = databaseConfigPath();
  const temporaryPath = `${configPath}.${process.pid}.tmp`;
  const stored: StoredDatabaseConfig = {
    configuredAt: new Date().toISOString(),
    connectionString: protectSecret(normalized.connectionString),
    engine: normalized.engine,
    version: 1,
  };

  fs.mkdirSync(dataDirectory, { recursive: true });
  fs.writeFileSync(temporaryPath, `${JSON.stringify(stored, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  fs.renameSync(temporaryPath, configPath);
}

export function deleteStoredDatabaseConfig() {
  fs.rmSync(databaseConfigPath(), { force: true });
}

export function openDatabaseClient(config: DatabaseConfig): DatabaseClient {
  if (config.engine === "sqlite") {
    return openSqliteClient(getSqliteDatabasePath());
  }

  if (config.engine === "postgresql") {
    return openPostgresqlClient(config.connectionString);
  }

  return openMysqlClient(config.connectionString, config.engine);
}

export async function testDatabaseConfig(config: DatabaseConfig) {
  const normalized = normalizeDatabaseConfig(config);
  const client =
    normalized.engine === "sqlite"
      ? openSqliteClient(":memory:")
      : openDatabaseClient(normalized);

  try {
    await client.get<{ ok: number }>("SELECT 1 AS ok");
  } finally {
    await client.close();
  }
}
