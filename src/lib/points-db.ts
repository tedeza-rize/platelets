import fs from "node:fs";
import path from "node:path";
import sqlite3 from "sqlite3";
import { DATASET_SOURCES, type DatasetSourceId } from "@/lib/dataset-sources";

export type EmergencyPointInput = {
  address: string;
  category: string;
  latitude: number | null;
  longitude: number | null;
  name: string;
  parentName: string | null;
  phone: string | null;
  raw: Record<string, string>;
  source: DatasetSourceId;
  sourceRecordId: string;
  sourceUpdatedAt: string | null;
};

export type EmergencyPoint = Omit<EmergencyPointInput, "raw"> & {
  id: number;
  fetchedAt: string | null;
  raw: Record<string, string>;
};

export type DatasetStatus = {
  error: string | null;
  failedCount: number;
  fetchedAt: string | null;
  geocodedCount: number;
  id: DatasetSourceId;
  label: string;
  recordCount: number;
  skippedCount: number;
  sourceUrl: string;
  updatedAt: string | null;
};

export type DatasetUpdateResult = DatasetStatus & {
  importedCount: number;
};

export type ApiLogInput = {
  action: string;
  category: "dataset" | "geocoding" | "hazard" | "system" | "ui";
  level: "debug" | "error" | "info" | "warn";
  message: string;
  metadata?: Record<string, unknown>;
  requestCount?: number;
  source?: DatasetSourceId | null;
  status: "failure" | "skipped" | "success";
};

export type ApiLogEntry = Required<
  Omit<ApiLogInput, "metadata" | "requestCount" | "source">
> & {
  eventAt: string;
  id: number;
  metadata: Record<string, unknown>;
  requestCount: number;
  source: DatasetSourceId | null;
};

export type ApiUsageWindow = {
  monthlyLimit: number;
  provider: "naver-geocoding";
  registeredAt: string | null;
  updatedAt: string | null;
  usedCount: number;
  windowEndsAt: string | null;
  windowStartedAt: string | null;
};

export type HazardEventType = "earthquake" | "tsunami";

export type HazardEventInput = {
  eventId: string;
  eventType: HazardEventType;
  title: string;
  issuedAt: string | null;
  occurredAt: string | null;
  latitude: number | null;
  longitude: number | null;
  location: string;
  magnitude: string | null;
  intensity: string | null;
  depth: string | null;
  description: string | null;
  imageUrl: string | null;
  raw: Record<string, string>;
};

export type HazardEvent = HazardEventInput & {
  fetchedAt: string | null;
  id: number;
};

export type HazardEventUpdateResult = {
  fetchedAt: string;
  importedCount: number;
  sources: Array<{
    count: number;
    eventType: HazardEventType;
  }>;
};

type SqliteDatabase = sqlite3.Database;

type PointRow = {
  address: string;
  category: string;
  fetched_at: string | null;
  id: number;
  latitude: number | null;
  longitude: number | null;
  name: string;
  parent_name: string | null;
  phone: string | null;
  raw_json: string;
  source: DatasetSourceId;
  source_record_id: string;
  source_updated_at: string | null;
};

type StatusRow = {
  error: string | null;
  failed_count: number;
  fetched_at: string | null;
  geocoded_count: number;
  label: string;
  record_count: number;
  skipped_count: number;
  source: DatasetSourceId;
  source_url: string;
  updated_at: string | null;
};

type ApiLogRow = {
  action: string;
  category: ApiLogInput["category"];
  event_at: string;
  id: number;
  level: ApiLogInput["level"];
  message: string;
  metadata_json: string;
  request_count: number;
  source: DatasetSourceId | null;
  status: ApiLogInput["status"];
};

type ApiUsageWindowRow = {
  monthly_limit: number;
  provider: "naver-geocoding";
  registered_at: string | null;
  updated_at: string | null;
  used_count: number;
  window_ends_at: string | null;
  window_started_at: string | null;
};

type HazardEventRow = {
  depth: string | null;
  description: string | null;
  event_id: string;
  event_type: HazardEventType;
  fetched_at: string | null;
  id: number;
  image_url: string | null;
  intensity: string | null;
  issued_at: string | null;
  latitude: number | null;
  location: string;
  longitude: number | null;
  magnitude: string | null;
  occurred_at: string | null;
  raw_json: string;
  title: string;
};

const dataDirectory = path.join(process.cwd(), "data");
const databasePath = path.join(dataDirectory, "points.sqlite");
const NAVER_GEOCODING_MONTHLY_LIMIT = 300_000;

let databasePromise: Promise<SqliteDatabase> | null = null;

function run(db: SqliteDatabase, sql: string, params: unknown[] = []) {
  return new Promise<void>((resolve, reject) => {
    db.run(sql, params, (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

function all<T>(db: SqliteDatabase, sql: string, params: unknown[] = []) {
  return new Promise<T[]>((resolve, reject) => {
    db.all(sql, params, (error, rows: T[]) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(rows);
    });
  });
}

function get<T>(db: SqliteDatabase, sql: string, params: unknown[] = []) {
  return new Promise<T | undefined>((resolve, reject) => {
    db.get(sql, params, (error, row: T | undefined) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(row);
    });
  });
}

async function initializeDatabase(db: SqliteDatabase) {
  await run(db, "PRAGMA journal_mode = WAL");
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS points (
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
    )`,
  );
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS dataset_updates (
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
    )`,
  );
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS api_usage_windows (
      provider TEXT PRIMARY KEY,
      registered_at TEXT,
      window_started_at TEXT,
      window_ends_at TEXT,
      used_count INTEGER NOT NULL DEFAULT 0,
      monthly_limit INTEGER NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
  );
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS api_logs (
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
    )`,
  );
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS hazard_events (
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
    )`,
  );
  await run(
    db,
    "CREATE INDEX IF NOT EXISTS points_source_idx ON points(source)",
  );
  await run(
    db,
    "CREATE INDEX IF NOT EXISTS points_coordinates_idx ON points(latitude, longitude)",
  );
  await run(
    db,
    "CREATE INDEX IF NOT EXISTS api_logs_event_idx ON api_logs(event_at DESC)",
  );
  await run(
    db,
    "CREATE INDEX IF NOT EXISTS api_logs_category_idx ON api_logs(category, event_at DESC)",
  );
  await run(
    db,
    "CREATE INDEX IF NOT EXISTS hazard_events_event_idx ON hazard_events(event_type, issued_at DESC)",
  );
  await run(
    db,
    "CREATE INDEX IF NOT EXISTS hazard_events_coordinates_idx ON hazard_events(latitude, longitude)",
  );
}

export async function getDatabase() {
  if (!databasePromise) {
    databasePromise = new Promise<SqliteDatabase>((resolve, reject) => {
      fs.mkdirSync(dataDirectory, { recursive: true });
      const db = new sqlite3.Database(databasePath, (error) => {
        if (error) {
          reject(error);
          return;
        }
        initializeDatabase(db).then(() => resolve(db), reject);
      });
    });
  }

  return databasePromise;
}

function mapPointRow(row: PointRow): EmergencyPoint {
  return {
    address: row.address,
    category: row.category,
    fetchedAt: row.fetched_at,
    id: row.id,
    latitude: row.latitude,
    longitude: row.longitude,
    name: row.name,
    parentName: row.parent_name,
    phone: row.phone,
    raw: JSON.parse(row.raw_json) as Record<string, string>,
    source: row.source,
    sourceRecordId: row.source_record_id,
    sourceUpdatedAt: row.source_updated_at,
  };
}

function emptyStatus(source: DatasetSourceId): DatasetStatus {
  const definition = DATASET_SOURCES[source];

  return {
    error: null,
    failedCount: 0,
    fetchedAt: null,
    geocodedCount: 0,
    id: source,
    label: definition.label,
    recordCount: 0,
    skippedCount: 0,
    sourceUrl: definition.url,
    updatedAt: null,
  };
}

function mapStatusRow(row: StatusRow): DatasetStatus {
  return {
    error: row.error,
    failedCount: row.failed_count,
    fetchedAt: row.fetched_at,
    geocodedCount: row.geocoded_count,
    id: row.source,
    label: row.label,
    recordCount: row.record_count,
    skippedCount: row.skipped_count,
    sourceUrl: row.source_url,
    updatedAt: row.updated_at,
  };
}

function mapApiLogRow(row: ApiLogRow): ApiLogEntry {
  return {
    action: row.action,
    category: row.category,
    eventAt: row.event_at,
    id: row.id,
    level: row.level,
    message: row.message,
    metadata: JSON.parse(row.metadata_json) as Record<string, unknown>,
    requestCount: row.request_count,
    source: row.source,
    status: row.status,
  };
}

function emptyNaverUsageWindow(): ApiUsageWindow {
  return {
    monthlyLimit: NAVER_GEOCODING_MONTHLY_LIMIT,
    provider: "naver-geocoding",
    registeredAt: null,
    updatedAt: null,
    usedCount: 0,
    windowEndsAt: null,
    windowStartedAt: null,
  };
}

function mapUsageWindowRow(row: ApiUsageWindowRow): ApiUsageWindow {
  return {
    monthlyLimit: row.monthly_limit,
    provider: row.provider,
    registeredAt: row.registered_at,
    updatedAt: row.updated_at,
    usedCount: row.used_count,
    windowEndsAt: row.window_ends_at,
    windowStartedAt: row.window_started_at,
  };
}

function mapHazardEventRow(row: HazardEventRow): HazardEvent {
  return {
    depth: row.depth,
    description: row.description,
    eventId: row.event_id,
    eventType: row.event_type,
    fetchedAt: row.fetched_at,
    id: row.id,
    imageUrl: row.image_url,
    intensity: row.intensity,
    issuedAt: row.issued_at,
    latitude: row.latitude,
    location: row.location,
    longitude: row.longitude,
    magnitude: row.magnitude,
    occurredAt: row.occurred_at,
    raw: JSON.parse(row.raw_json) as Record<string, string>,
    title: row.title,
  };
}

function addOneMonth(value: Date) {
  const next = new Date(value);
  next.setMonth(next.getMonth() + 1);
  return next;
}

async function getNaverUsageWindowRow(db: SqliteDatabase) {
  return get<ApiUsageWindowRow>(
    db,
    "SELECT * FROM api_usage_windows WHERE provider = ?",
    ["naver-geocoding"],
  );
}

export async function listPoints(
  options: { includeUnmapped?: boolean; source?: DatasetSourceId | null } = {},
) {
  const db = await getDatabase();
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (options.source) {
    conditions.push("source = ?");
    params.push(options.source);
  }

  if (!options.includeUnmapped) {
    conditions.push("latitude IS NOT NULL");
    conditions.push("longitude IS NOT NULL");
  }

  const where =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const rows = await all<PointRow>(
    db,
    `SELECT p.*, u.fetched_at
      FROM points p
      LEFT JOIN dataset_updates u ON u.source = p.source
      ${where}
      ORDER BY p.source, p.name`,
    params,
  );

  return rows.map(mapPointRow);
}

export async function listApiLogs(
  options: {
    category?: ApiLogInput["category"] | null;
    limit?: number;
    source?: DatasetSourceId | null;
  } = {},
) {
  const db = await getDatabase();
  const conditions: string[] = [];
  const params: unknown[] = [];
  const limit = Math.min(Math.max(options.limit ?? 200, 1), 500);

  if (options.category) {
    conditions.push("category = ?");
    params.push(options.category);
  }

  if (options.source) {
    conditions.push("source = ?");
    params.push(options.source);
  }

  const where =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const rows = await all<ApiLogRow>(
    db,
    `SELECT * FROM api_logs ${where} ORDER BY event_at DESC, id DESC LIMIT ?`,
    [...params, limit],
  );

  return rows.map(mapApiLogRow);
}

export async function listHazardEvents(options: { limit?: number } = {}) {
  const db = await getDatabase();
  const limit = Math.min(Math.max(options.limit ?? 100, 1), 300);
  const rows = await all<HazardEventRow>(
    db,
    `SELECT *
      FROM hazard_events
      ORDER BY COALESCE(issued_at, occurred_at, fetched_at) DESC, id DESC
      LIMIT ?`,
    [limit],
  );

  return rows.map(mapHazardEventRow);
}

export async function recordApiLog(input: ApiLogInput) {
  const db = await getDatabase();

  await run(
    db,
    `INSERT INTO api_logs (
      level,
      category,
      source,
      action,
      status,
      message,
      request_count,
      metadata_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.level,
      input.category,
      input.source ?? null,
      input.action,
      input.status,
      input.message,
      input.requestCount ?? 0,
      JSON.stringify(input.metadata ?? {}),
    ],
  );
}

export async function replaceHazardEvents(params: {
  events: HazardEventInput[];
  fetchedAt: string;
}) {
  const db = await getDatabase();

  await run(db, "BEGIN IMMEDIATE");

  try {
    await run(db, "DELETE FROM hazard_events");

    for (const event of params.events) {
      await run(
        db,
        `INSERT INTO hazard_events (
          event_id,
          event_type,
          title,
          issued_at,
          occurred_at,
          latitude,
          longitude,
          location,
          magnitude,
          intensity,
          depth,
          description,
          image_url,
          raw_json,
          fetched_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          event.eventId,
          event.eventType,
          event.title,
          event.issuedAt,
          event.occurredAt,
          event.latitude,
          event.longitude,
          event.location,
          event.magnitude,
          event.intensity,
          event.depth,
          event.description,
          event.imageUrl,
          JSON.stringify(event.raw),
          params.fetchedAt,
        ],
      );
    }

    await run(db, "COMMIT");
  } catch (error) {
    await run(db, "ROLLBACK");
    throw error;
  }
}

export async function getNaverGeocodingUsage() {
  const db = await getDatabase();
  const row = await getNaverUsageWindowRow(db);

  return row ? mapUsageWindowRow(row) : emptyNaverUsageWindow();
}

export async function consumeNaverGeocodingQuota() {
  const db = await getDatabase();
  const now = new Date();
  const nowIso = now.toISOString();

  await run(db, "BEGIN IMMEDIATE");

  try {
    const existing = await getNaverUsageWindowRow(db);
    const shouldReset =
      existing?.window_ends_at && now >= new Date(existing.window_ends_at);
    const windowStartedAt =
      existing && !shouldReset ? existing.window_started_at : nowIso;
    const registeredAt = existing?.registered_at ?? nowIso;
    const windowEndsAt =
      existing && !shouldReset && existing.window_ends_at
        ? existing.window_ends_at
        : addOneMonth(now).toISOString();
    const currentUsedCount = existing && !shouldReset ? existing.used_count : 0;

    if (currentUsedCount >= NAVER_GEOCODING_MONTHLY_LIMIT) {
      throw new Error("Naver geocoding monthly quota exceeded");
    }

    await run(
      db,
      `INSERT INTO api_usage_windows (
        provider,
        registered_at,
        window_started_at,
        window_ends_at,
        used_count,
        monthly_limit,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(provider) DO UPDATE SET
        registered_at = excluded.registered_at,
        window_started_at = excluded.window_started_at,
        window_ends_at = excluded.window_ends_at,
        used_count = excluded.used_count,
        monthly_limit = excluded.monthly_limit,
        updated_at = CURRENT_TIMESTAMP`,
      [
        "naver-geocoding",
        registeredAt,
        windowStartedAt,
        windowEndsAt,
        currentUsedCount + 1,
        NAVER_GEOCODING_MONTHLY_LIMIT,
      ],
    );

    await run(db, "COMMIT");
  } catch (error) {
    await run(db, "ROLLBACK");
    throw error;
  }

  return getNaverGeocodingUsage();
}

export async function listDatasetStatuses() {
  const db = await getDatabase();
  const rows = await all<StatusRow>(
    db,
    "SELECT * FROM dataset_updates ORDER BY source",
  );
  const bySource = new Map(rows.map((row) => [row.source, mapStatusRow(row)]));

  return (Object.keys(DATASET_SOURCES) as DatasetSourceId[]).map(
    (source) => bySource.get(source) ?? emptyStatus(source),
  );
}

export async function getDatasetStatus(source: DatasetSourceId) {
  const db = await getDatabase();
  const row = await get<StatusRow>(
    db,
    "SELECT * FROM dataset_updates WHERE source = ?",
    [source],
  );

  return row ? mapStatusRow(row) : emptyStatus(source);
}

export async function replaceDataset(params: {
  failedCount: number;
  fetchedAt: string;
  geocodedCount: number;
  points: EmergencyPointInput[];
  skippedCount: number;
  source: DatasetSourceId;
}) {
  const db = await getDatabase();
  const definition = DATASET_SOURCES[params.source];

  await run(db, "BEGIN IMMEDIATE");

  try {
    await run(db, "DELETE FROM points WHERE source = ?", [params.source]);

    for (const point of params.points) {
      await run(
        db,
        `INSERT INTO points (
          source,
          source_record_id,
          name,
          category,
          address,
          phone,
          parent_name,
          latitude,
          longitude,
          source_updated_at,
          raw_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          point.source,
          point.sourceRecordId,
          point.name,
          point.category,
          point.address,
          point.phone,
          point.parentName,
          point.latitude,
          point.longitude,
          point.sourceUpdatedAt,
          JSON.stringify(point.raw),
        ],
      );
    }

    await run(
      db,
      `INSERT INTO dataset_updates (
        source,
        label,
        source_url,
        fetched_at,
        record_count,
        geocoded_count,
        skipped_count,
        failed_count,
        error,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, CURRENT_TIMESTAMP)
      ON CONFLICT(source) DO UPDATE SET
        label = excluded.label,
        source_url = excluded.source_url,
        fetched_at = excluded.fetched_at,
        record_count = excluded.record_count,
        geocoded_count = excluded.geocoded_count,
        skipped_count = excluded.skipped_count,
        failed_count = excluded.failed_count,
        error = NULL,
        updated_at = CURRENT_TIMESTAMP`,
      [
        params.source,
        definition.label,
        definition.url,
        params.fetchedAt,
        params.points.length,
        params.geocodedCount,
        params.skippedCount,
        params.failedCount,
      ],
    );

    await run(db, "COMMIT");
  } catch (error) {
    await run(db, "ROLLBACK");
    throw error;
  }

  const status = await getDatasetStatus(params.source);

  return {
    ...status,
    importedCount: params.points.length,
  } satisfies DatasetUpdateResult;
}

export async function recordDatasetError(
  source: DatasetSourceId,
  error: unknown,
) {
  const db = await getDatabase();
  const definition = DATASET_SOURCES[source];
  const message = error instanceof Error ? error.message : String(error);

  await run(
    db,
    `INSERT INTO dataset_updates (
      source,
      label,
      source_url,
      error,
      updated_at
    ) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(source) DO UPDATE SET
      label = excluded.label,
      source_url = excluded.source_url,
      error = excluded.error,
      updated_at = CURRENT_TIMESTAMP`,
    [source, definition.label, definition.url, message],
  );

  return getDatasetStatus(source);
}
