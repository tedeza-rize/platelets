import {
  ensureIncidentEventIntegrity,
  incidentEventTableStatement,
} from "@/lib/database/incident-event-integrity";
import { quoteIdentifier } from "@/lib/database/sql";
import type { DatabaseClient } from "@/lib/database/types";

const SCHEMA_VERSION = 3;

export const DATABASE_TABLES = [
  "app_schema_versions",
  "app_settings",
  "users",
  "access_sessions",
  "points",
  "dataset_updates",
  "dataset_import_progress",
  "api_usage_windows",
  "api_logs",
  "admin_update_cooldowns",
  "incident_push_subscriptions",
  "hazard_events",
  "assembly_protests",
  "assembly_geocode_cache",
  "disaster_incidents",
  "disaster_incident_events",
] as const;

function types(db: DatabaseClient) {
  let autoId = "BIGINT AUTO_INCREMENT PRIMARY KEY";
  let timestamp = "DATETIME(3)";

  if (db.dialect === "sqlite") {
    autoId = "INTEGER PRIMARY KEY AUTOINCREMENT";
    timestamp = "TEXT";
  }

  if (db.dialect === "postgresql") {
    autoId = "BIGSERIAL PRIMARY KEY";
    timestamp = "TIMESTAMPTZ";
  }

  return {
    autoId,
    key: db.dialect === "mysql" ? "VARCHAR(191)" : "TEXT",
    number: db.dialect === "postgresql" ? "DOUBLE PRECISION" : "REAL",
    text: db.dialect === "mysql" ? "LONGTEXT" : "TEXT",
    timestamp,
  };
}

function tableStatements(db: DatabaseClient) {
  const type = types(db);

  return [
    `CREATE TABLE IF NOT EXISTS app_schema_versions (
      version INTEGER PRIMARY KEY,
      applied_at ${type.timestamp} NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS points (
      id ${type.autoId},
      source ${type.key} NOT NULL,
      source_record_id ${type.key} NOT NULL,
      name ${type.text} NOT NULL,
      category ${type.text} NOT NULL,
      address ${type.text} NOT NULL,
      phone ${type.text},
      parent_name ${type.text},
      latitude ${type.number},
      longitude ${type.number},
      source_updated_at ${type.timestamp},
      raw_json ${type.text} NOT NULL,
      created_at ${type.timestamp} NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at ${type.timestamp} NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(source, source_record_id)
    )`,
    `CREATE TABLE IF NOT EXISTS dataset_updates (
      source ${type.key} PRIMARY KEY,
      label ${type.text} NOT NULL,
      source_url ${type.text} NOT NULL,
      fetched_at ${type.timestamp},
      record_count INTEGER NOT NULL DEFAULT 0,
      geocoded_count INTEGER NOT NULL DEFAULT 0,
      skipped_count INTEGER NOT NULL DEFAULT 0,
      failed_count INTEGER NOT NULL DEFAULT 0,
      error ${type.text},
      updated_at ${type.timestamp} NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS dataset_import_progress (
      source ${type.key} PRIMARY KEY,
      status ${type.key} NOT NULL,
      mode ${type.key} NOT NULL,
      next_index INTEGER NOT NULL DEFAULT 0,
      total_count INTEGER NOT NULL DEFAULT 0,
      imported_count INTEGER NOT NULL DEFAULT 0,
      geocoded_count INTEGER NOT NULL DEFAULT 0,
      skipped_count INTEGER NOT NULL DEFAULT 0,
      failed_count INTEGER NOT NULL DEFAULT 0,
      reason ${type.text},
      points_json ${type.text} NOT NULL,
      fetched_at ${type.timestamp} NOT NULL,
      started_at ${type.timestamp} NOT NULL,
      updated_at ${type.timestamp} NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS api_usage_windows (
      provider ${type.key} PRIMARY KEY,
      registered_at ${type.timestamp},
      window_started_at ${type.timestamp},
      window_ends_at ${type.timestamp},
      used_count INTEGER NOT NULL DEFAULT 0,
      monthly_limit INTEGER NOT NULL,
      updated_at ${type.timestamp} NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS api_logs (
      id ${type.autoId},
      event_at ${type.timestamp} NOT NULL DEFAULT CURRENT_TIMESTAMP,
      level ${type.key} NOT NULL,
      category ${type.key} NOT NULL,
      source ${type.key},
      action ${type.key} NOT NULL,
      status ${type.key} NOT NULL,
      message ${type.text} NOT NULL,
      request_count INTEGER NOT NULL DEFAULT 0,
      metadata_json ${type.text} NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS app_settings (
      key ${type.key} PRIMARY KEY,
      value_json ${type.text} NOT NULL,
      updated_at ${type.timestamp} NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS admin_update_cooldowns (
      action ${type.key} PRIMARY KEY,
      last_used_at ${type.timestamp} NOT NULL,
      updated_at ${type.timestamp} NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS users (
      id ${type.key} PRIMARY KEY,
      username ${type.key} NOT NULL UNIQUE,
      password_hash ${type.text} NOT NULL,
      password_salt ${type.text} NOT NULL,
      password_iterations INTEGER NOT NULL,
      name ${type.text} NOT NULL,
      email ${type.text} NOT NULL,
      department ${type.text} NOT NULL,
      role ${type.key} NOT NULL,
      phone ${type.text} NOT NULL,
      created_at ${type.timestamp} NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at ${type.timestamp} NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS access_sessions (
      token_hash ${type.key} PRIMARY KEY,
      user_id ${type.key},
      username ${type.key},
      role ${type.key} NOT NULL,
      name ${type.text} NOT NULL,
      created_at ${type.timestamp} NOT NULL,
      expires_at ${type.timestamp} NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS incident_push_subscriptions (
      endpoint ${type.key} PRIMARY KEY,
      subscription_json ${type.text} NOT NULL,
      locale ${type.key} NOT NULL,
      created_at ${type.timestamp} NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at ${type.timestamp} NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS hazard_events (
      id ${type.autoId},
      event_id ${type.key} NOT NULL UNIQUE,
      event_type ${type.key} NOT NULL,
      title ${type.text} NOT NULL,
      issued_at ${type.timestamp},
      occurred_at ${type.timestamp},
      latitude ${type.number},
      longitude ${type.number},
      location ${type.text} NOT NULL,
      magnitude ${type.text},
      intensity ${type.text},
      depth ${type.text},
      description ${type.text},
      image_url ${type.text},
      raw_json ${type.text} NOT NULL,
      fetched_at ${type.timestamp} NOT NULL,
      created_at ${type.timestamp} NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at ${type.timestamp} NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS assembly_protests (
      id ${type.autoId},
      source_id ${type.key} NOT NULL,
      source_record_id ${type.key} NOT NULL,
      source_url ${type.text} NOT NULL,
      detail_url ${type.text},
      agency ${type.key} NOT NULL,
      date ${type.key} NOT NULL,
      source_title ${type.text} NOT NULL,
      starts_at ${type.timestamp},
      ends_at ${type.timestamp},
      location ${type.text} NOT NULL,
      location_scope ${type.text},
      latitude ${type.number},
      longitude ${type.number},
      crowd_size INTEGER,
      raw_json ${type.text} NOT NULL,
      fetched_at ${type.timestamp} NOT NULL,
      created_at ${type.timestamp} NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at ${type.timestamp} NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(source_id, source_record_id, date)
    )`,
    `CREATE TABLE IF NOT EXISTS assembly_geocode_cache (
      cache_key ${type.key} PRIMARY KEY,
      query ${type.text} NOT NULL,
      search_mode ${type.key} NOT NULL,
      latitude ${type.number} NOT NULL,
      longitude ${type.number} NOT NULL,
      matched_address ${type.text},
      provider_source ${type.key} NOT NULL,
      created_at ${type.timestamp} NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at ${type.timestamp} NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS disaster_incidents (
      id ${type.key} PRIMARY KEY,
      type ${type.key} NOT NULL,
      title ${type.text} NOT NULL,
      description ${type.text} NOT NULL,
      address ${type.text} NOT NULL,
      latitude ${type.number} NOT NULL,
      longitude ${type.number} NOT NULL,
      risk_level ${type.key} NOT NULL,
      status ${type.key} NOT NULL,
      occurred_at ${type.timestamp} NOT NULL,
      created_at ${type.timestamp} NOT NULL,
      updated_at ${type.timestamp} NOT NULL,
      deleted_at ${type.timestamp}
    )`,
    incidentEventTableStatement(db),
  ];
}

const INDEXES = [
  ["points_source_idx", "points", "source"],
  ["points_source_id_idx", "points", "source, id"],
  ["points_coordinates_idx", "points", "latitude, longitude"],
  ["points_source_coordinates_idx", "points", "source, latitude, longitude"],
  ["api_logs_event_idx", "api_logs", "event_at DESC"],
  ["api_logs_event_id_idx", "api_logs", "event_at DESC, id DESC"],
  ["api_logs_category_idx", "api_logs", "category, event_at DESC"],
  [
    "api_logs_category_event_id_idx",
    "api_logs",
    "category, event_at DESC, id DESC",
  ],
  [
    "api_logs_source_event_id_idx",
    "api_logs",
    "source, event_at DESC, id DESC",
  ],
  ["users_role_idx", "users", "role, username"],
  ["access_sessions_user_idx", "access_sessions", "user_id, expires_at"],
  ["access_sessions_expires_idx", "access_sessions", "expires_at"],
  ["hazard_events_event_idx", "hazard_events", "event_type, issued_at DESC"],
  ["hazard_events_coordinates_idx", "hazard_events", "latitude, longitude"],
  ["assembly_protests_date_idx", "assembly_protests", "date, agency"],
  [
    "assembly_protests_coordinates_idx",
    "assembly_protests",
    "latitude, longitude",
  ],
  [
    "assembly_geocode_cache_updated_idx",
    "assembly_geocode_cache",
    "updated_at DESC",
  ],
  ["disaster_incidents_occurred_idx", "disaster_incidents", "occurred_at DESC"],
  [
    "disaster_incidents_coordinates_idx",
    "disaster_incidents",
    "latitude, longitude",
  ],
  [
    "disaster_incidents_type_risk_idx",
    "disaster_incidents",
    "type, risk_level",
  ],
  [
    "disaster_incident_events_incident_idx",
    "disaster_incident_events",
    "incident_id, created_at DESC",
  ],
] as const;

async function indexExists(db: DatabaseClient, name: string) {
  if (db.dialect === "sqlite") {
    return Boolean(
      await db.get(
        "SELECT name FROM sqlite_master WHERE type = 'index' AND name = ?",
        [name],
      ),
    );
  }

  if (db.dialect === "postgresql") {
    return Boolean(
      await db.get(
        "SELECT indexname FROM pg_indexes WHERE schemaname = current_schema() AND indexname = ?",
        [name],
      ),
    );
  }

  return Boolean(
    await db.get(
      "SELECT index_name FROM information_schema.statistics WHERE table_schema = DATABASE() AND index_name = ?",
      [name],
    ),
  );
}

async function columnExists(db: DatabaseClient, table: string, column: string) {
  if (db.dialect === "sqlite") {
    const columns = await db.all<{ name: string }>(
      `PRAGMA table_info(${quoteIdentifier(table, db.dialect)})`,
    );
    return columns.some((current) => current.name === column);
  }

  const row = await db.get(
    db.dialect === "postgresql"
      ? "SELECT column_name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = ? AND column_name = ?"
      : "SELECT column_name FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?",
    [table, column],
  );
  return Boolean(row);
}

async function ensureIncidentActorColumns(db: DatabaseClient) {
  const type = types(db);

  for (const [name, definition] of [
    ["actor_id", `${type.key}`],
    ["actor_name", `${type.text}`],
    ["actor_role", `${type.key}`],
  ] as const) {
    if (!(await columnExists(db, "disaster_incident_events", name))) {
      await db.run(
        `ALTER TABLE disaster_incident_events ADD COLUMN ${quoteIdentifier(name, db.dialect)} ${definition}`,
      );
    }
  }
}

async function ensureIncidentDeletedAtColumn(db: DatabaseClient) {
  if (!(await columnExists(db, "disaster_incidents", "deleted_at"))) {
    await db.run(
      `ALTER TABLE disaster_incidents ADD COLUMN ${quoteIdentifier("deleted_at", db.dialect)} ${types(db).timestamp}`,
    );
  }
}

export async function initializeDatabaseSchema(db: DatabaseClient) {
  if (db.dialect === "sqlite") {
    await db.run("PRAGMA journal_mode = WAL");
    await db.run("PRAGMA foreign_keys = ON");
  }

  for (const statement of tableStatements(db)) {
    await db.run(statement);
  }

  await ensureIncidentDeletedAtColumn(db);
  await ensureIncidentActorColumns(db);
  await ensureIncidentEventIntegrity(db);

  for (const [name, table, columns] of INDEXES) {
    if (!(await indexExists(db, name))) {
      await db.run(
        `CREATE INDEX ${quoteIdentifier(name, db.dialect)} ON ${quoteIdentifier(table, db.dialect)}(${columns})`,
      );
    }
  }

  const existing = await db.get<{ version: number }>(
    "SELECT version FROM app_schema_versions WHERE version = ?",
    [SCHEMA_VERSION],
  );

  if (!existing) {
    await db.run(
      "INSERT INTO app_schema_versions (version, applied_at) VALUES (?, ?)",
      [SCHEMA_VERSION, new Date().toISOString()],
    );
  }
}
