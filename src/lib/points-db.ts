import fs from "node:fs";
import path from "node:path";
import sqlite3 from "sqlite3";
import type { DatasetUpdateProgress } from "@/lib/dataset-progress";
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

export type EmergencyPointSummary = Omit<EmergencyPoint, "raw">;

export type EmergencyPointMarker = Pick<
  EmergencyPointSummary,
  "category" | "id" | "latitude" | "longitude" | "source"
>;

export type PointBoundingBox = {
  maxLatitude: number;
  maxLongitude: number;
  minLatitude: number;
  minLongitude: number;
};

export type PointCoordinate = {
  latitude: number;
  longitude: number;
};

export type PointSearchOptions = {
  bounds?: PointBoundingBox;
  center?: PointCoordinate;
  includeUnmapped?: boolean;
  limit?: number;
  source?: DatasetSourceId | null;
};

export type NearestPoint = EmergencyPointSummary & {
  distanceMeters: number;
};

export type DatasetStatus = {
  error: string | null;
  failedCount: number;
  fetchedAt: string | null;
  geocodedCount: number;
  id: DatasetSourceId;
  importProgress: DatasetImportProgress | null;
  label: string;
  recordCount: number;
  skippedCount: number;
  sourceUrl: string;
  updatedAt: string | null;
  updateProgress: DatasetUpdateProgress | null;
};

export type DatasetUpdateResult = DatasetStatus & {
  importedCount: number;
};

export type DatasetImportMode = "restart" | "resume";

export type DatasetImportProgressStatus = "paused" | "running";

export type DatasetImportProgress = {
  failedCount: number;
  fetchedAt: string;
  geocodedCount: number;
  importedCount: number;
  mode: DatasetImportMode;
  nextIndex: number;
  reason: string | null;
  skippedCount: number;
  source: DatasetSourceId;
  startedAt: string;
  status: DatasetImportProgressStatus;
  totalCount: number;
  updatedAt: string;
};

export type DatasetImportCheckpoint = DatasetImportProgress & {
  points: EmergencyPointInput[];
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
  provider: "kakao-local" | "kma-earthquake";
  registeredAt: string | null;
  updatedAt: string | null;
  usedCount: number;
  windowEndsAt: string | null;
  windowStartedAt: string | null;
};

export type AdminUpdateCooldown = {
  action: string;
  available: boolean;
  cooldownMs: number;
  lastUsedAt: string | null;
  nextAvailableAt: string | null;
  remainingMs: number;
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

type DatasetImportProgressRow = {
  failed_count: number;
  fetched_at: string;
  geocoded_count: number;
  imported_count: number;
  mode: DatasetImportMode;
  next_index: number;
  points_json: string;
  reason: string | null;
  skipped_count: number;
  source: DatasetSourceId;
  started_at: string;
  status: DatasetImportProgressStatus;
  total_count: number;
  updated_at: string;
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
  provider: ApiUsageWindow["provider"];
  registered_at: string | null;
  updated_at: string | null;
  used_count: number;
  window_ends_at: string | null;
  window_started_at: string | null;
};

type AdminUpdateCooldownRow = {
  action: string;
  last_used_at: string;
  updated_at: string;
};

type AppSettingRow = {
  key: string;
  updated_at: string;
  value_json: string;
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
export const ADMIN_UPDATE_COOLDOWN_MS = 5 * 60 * 1000;
const KMA_EARTHQUAKE_DAILY_LIMIT = 5_000;
const KAKAO_LOCAL_DAILY_LIMIT = 100_000;

let databasePromise: Promise<SqliteDatabase> | null = null;
let writeTransactionQueue: Promise<void> = Promise.resolve();

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

async function withWriteTransaction<T>(
  operation: (db: SqliteDatabase) => Promise<T>,
) {
  const previousTransaction = writeTransactionQueue;
  let releaseTransaction = () => {};
  writeTransactionQueue = new Promise<void>((resolve) => {
    releaseTransaction = resolve;
  });

  await previousTransaction;

  const db = await getDatabase();
  let transactionStarted = false;

  try {
    await run(db, "BEGIN IMMEDIATE");
    transactionStarted = true;
    const result = await operation(db);
    await run(db, "COMMIT");
    transactionStarted = false;
    return result;
  } catch (error) {
    if (transactionStarted) {
      await run(db, "ROLLBACK").catch(() => undefined);
    }

    throw error;
  } finally {
    releaseTransaction();
  }
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
    `CREATE TABLE IF NOT EXISTS dataset_import_progress (
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
    `CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value_json TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
  );
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS admin_update_cooldowns (
      action TEXT PRIMARY KEY,
      last_used_at TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
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

function mapPointSummaryRow(row: PointRow): EmergencyPointSummary {
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
    source: row.source,
    sourceRecordId: row.source_record_id,
    sourceUpdatedAt: row.source_updated_at,
  };
}

function mapPointMarkerRow(row: PointRow): EmergencyPointMarker {
  return {
    category: row.category,
    id: row.id,
    latitude: row.latitude,
    longitude: row.longitude,
    source: row.source,
  };
}

function clampPointLimit(
  limit: number | undefined,
  fallback = 5_000,
  max = 20_000,
) {
  if (limit === undefined) {
    return fallback;
  }

  return Math.min(Math.max(Math.trunc(limit), 1), max);
}

function emptyStatus(source: DatasetSourceId): DatasetStatus {
  const definition = DATASET_SOURCES[source];

  return {
    error: null,
    failedCount: 0,
    fetchedAt: null,
    geocodedCount: 0,
    id: source,
    importProgress: null,
    label: definition.label,
    recordCount: 0,
    skippedCount: 0,
    sourceUrl: definition.url,
    updatedAt: null,
    updateProgress: null,
  };
}

function mapStatusRow(row: StatusRow): DatasetStatus {
  return {
    error: row.error,
    failedCount: row.failed_count,
    fetchedAt: row.fetched_at,
    geocodedCount: row.geocoded_count,
    id: row.source,
    importProgress: null,
    label: row.label,
    recordCount: row.record_count,
    skippedCount: row.skipped_count,
    sourceUrl: row.source_url,
    updatedAt: row.updated_at,
    updateProgress: null,
  };
}

function mapImportProgressRow(
  row: DatasetImportProgressRow,
): DatasetImportCheckpoint {
  return {
    failedCount: row.failed_count,
    fetchedAt: row.fetched_at,
    geocodedCount: row.geocoded_count,
    importedCount: row.imported_count,
    mode: row.mode,
    nextIndex: row.next_index,
    points: JSON.parse(row.points_json) as EmergencyPointInput[],
    reason: row.reason,
    skippedCount: row.skipped_count,
    source: row.source,
    startedAt: row.started_at,
    status: row.status,
    totalCount: row.total_count,
    updatedAt: row.updated_at,
  };
}

function stripCheckpointPoints(
  checkpoint: DatasetImportCheckpoint,
): DatasetImportProgress {
  return {
    failedCount: checkpoint.failedCount,
    fetchedAt: checkpoint.fetchedAt,
    geocodedCount: checkpoint.geocodedCount,
    importedCount: checkpoint.importedCount,
    mode: checkpoint.mode,
    nextIndex: checkpoint.nextIndex,
    reason: checkpoint.reason,
    skippedCount: checkpoint.skippedCount,
    source: checkpoint.source,
    startedAt: checkpoint.startedAt,
    status: checkpoint.status,
    totalCount: checkpoint.totalCount,
    updatedAt: checkpoint.updatedAt,
  };
}

function withImportProgress(
  status: DatasetStatus,
  progress: DatasetImportProgress | null,
): DatasetStatus {
  return {
    ...status,
    importProgress: progress,
  };
}

function withUpdateProgress(
  status: DatasetStatus,
  updateProgress: DatasetUpdateProgress | null,
) {
  return { ...status, updateProgress };
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

function emptyKakaoLocalUsageWindow(): ApiUsageWindow {
  return {
    monthlyLimit: KAKAO_LOCAL_DAILY_LIMIT,
    provider: "kakao-local",
    registeredAt: null,
    updatedAt: null,
    usedCount: 0,
    windowEndsAt: null,
    windowStartedAt: null,
  };
}

function emptyKmaEarthquakeUsageWindow(): ApiUsageWindow {
  return {
    monthlyLimit: KMA_EARTHQUAKE_DAILY_LIMIT,
    provider: "kma-earthquake",
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

function nextKstMidnight(value: Date) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Seoul",
    year: "numeric",
  });
  const parts = new Map(
    formatter.formatToParts(value).map((part) => [part.type, part.value]),
  );
  const year = Number(parts.get("year"));
  const month = Number(parts.get("month"));
  const day = Number(parts.get("day"));

  return new Date(Date.UTC(year, month - 1, day + 1, -9, 0, 0));
}

async function getKakaoLocalUsageWindowRow(db: SqliteDatabase) {
  return get<ApiUsageWindowRow>(
    db,
    "SELECT * FROM api_usage_windows WHERE provider = ?",
    ["kakao-local"],
  );
}

async function getKmaEarthquakeUsageWindowRow(db: SqliteDatabase) {
  return get<ApiUsageWindowRow>(
    db,
    "SELECT * FROM api_usage_windows WHERE provider = ?",
    ["kma-earthquake"],
  );
}

function buildPointWhereClause(options: PointSearchOptions) {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (options.source) {
    conditions.push("p.source = ?");
    params.push(options.source);
  }

  if (!options.includeUnmapped) {
    conditions.push("p.latitude IS NOT NULL");
    conditions.push("p.longitude IS NOT NULL");
  }

  if (options.bounds) {
    conditions.push("p.latitude BETWEEN ? AND ?");
    conditions.push("p.longitude BETWEEN ? AND ?");
    params.push(options.bounds.minLatitude, options.bounds.maxLatitude);
    params.push(options.bounds.minLongitude, options.bounds.maxLongitude);
  }

  const where =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  return { params, where };
}

function buildPointOrderClause(options: PointSearchOptions, fallback: string) {
  if (!options.center) {
    return { orderBy: fallback, orderParams: [] };
  }

  return {
    orderBy:
      "((p.latitude - ?) * (p.latitude - ?) + (p.longitude - ?) * (p.longitude - ?)), p.id",
    orderParams: [
      options.center.latitude,
      options.center.latitude,
      options.center.longitude,
      options.center.longitude,
    ],
  };
}

export async function listPointSummaries(options: PointSearchOptions = {}) {
  const db = await getDatabase();
  const { params, where } = buildPointWhereClause(options);
  const { orderBy, orderParams } = buildPointOrderClause(
    options,
    "p.source, p.name",
  );
  const limit = clampPointLimit(options.limit, 100_000, 100_000);
  const rows = await all<PointRow>(
    db,
    `SELECT
        p.id,
        p.source,
        p.source_record_id,
        p.name,
        p.category,
        p.address,
        p.phone,
        p.parent_name,
        p.latitude,
        p.longitude,
        p.source_updated_at,
        '' AS raw_json,
        u.fetched_at
      FROM points p
      LEFT JOIN dataset_updates u ON u.source = p.source
      ${where}
      ORDER BY ${orderBy}
      LIMIT ?`,
    [...params, ...orderParams, limit],
  );

  return rows.map(mapPointSummaryRow);
}

export async function listPointMarkers(options: PointSearchOptions = {}) {
  const db = await getDatabase();
  const { params, where } = buildPointWhereClause(options);
  const { orderBy, orderParams } = buildPointOrderClause(
    options,
    "p.source, p.id",
  );
  const limit = clampPointLimit(options.limit, 100_000, 100_000);
  const rows = await all<PointRow>(
    db,
    `SELECT
        p.id,
        p.source,
        '' AS source_record_id,
        '' AS name,
        p.category,
        '' AS address,
        NULL AS phone,
        NULL AS parent_name,
        p.latitude,
        p.longitude,
        NULL AS source_updated_at,
        '' AS raw_json,
        NULL AS fetched_at
      FROM points p
      ${where}
      ORDER BY ${orderBy}
      LIMIT ?`,
    [...params, ...orderParams, limit],
  );

  return rows.map(mapPointMarkerRow);
}

export async function listPoints(options: PointSearchOptions = {}) {
  const db = await getDatabase();
  const { params, where } = buildPointWhereClause(options);
  const { orderBy, orderParams } = buildPointOrderClause(
    options,
    "p.source, p.name",
  );
  const limit = clampPointLimit(options.limit);
  const rows = await all<PointRow>(
    db,
    `SELECT p.*, u.fetched_at
      FROM points p
      LEFT JOIN dataset_updates u ON u.source = p.source
      ${where}
      ORDER BY ${orderBy}
      LIMIT ?`,
    [...params, ...orderParams, limit],
  );

  return rows.map(mapPointRow);
}

export async function listEmergencyHospitalFallbackPoints() {
  const db = await getDatabase();
  const rows = await all<PointRow>(
    db,
    `SELECT p.*, u.fetched_at
      FROM points p
      LEFT JOIN dataset_updates u ON u.source = p.source
      WHERE p.source = 'hospitals'
        AND json_extract(p.raw_json, '$.dutyEryn') = '1'
      ORDER BY p.name`,
  );

  return rows.map(mapPointRow);
}

export async function getPointSummary(id: number) {
  const db = await getDatabase();
  const row = await get<PointRow>(
    db,
    `SELECT
        p.id,
        p.source,
        p.source_record_id,
        p.name,
        p.category,
        p.address,
        p.phone,
        p.parent_name,
        p.latitude,
        p.longitude,
        p.source_updated_at,
        '' AS raw_json,
        u.fetched_at
      FROM points p
      LEFT JOIN dataset_updates u ON u.source = p.source
      WHERE p.id = ?`,
    [id],
  );

  return row ? mapPointSummaryRow(row) : null;
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function distanceMeters(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
) {
  const earthRadiusMeters = 6_371_000;
  const dLat = toRadians(to.latitude - from.latitude);
  const dLon = toRadians(to.longitude - from.longitude);
  const lat1 = toRadians(from.latitude);
  const lat2 = toRadians(to.latitude);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function findNearestPoints(options: {
  latitude: number;
  limit?: number;
  longitude: number;
  radiusMeters?: number;
  source?: DatasetSourceId | null;
}) {
  const radiusMeters = Math.min(
    Math.max(options.radiusMeters ?? 20_000, 500),
    100_000,
  );
  const latitudeDelta = radiusMeters / 111_320;
  const longitudeDelta =
    radiusMeters /
    (111_320 * Math.max(Math.cos(toRadians(options.latitude)), 0.1));
  const candidates = await listPointSummaries({
    bounds: {
      maxLatitude: options.latitude + latitudeDelta,
      maxLongitude: options.longitude + longitudeDelta,
      minLatitude: options.latitude - latitudeDelta,
      minLongitude: options.longitude - longitudeDelta,
    },
    limit: 20_000,
    source: options.source,
  });

  return candidates
    .filter(
      (
        point,
      ): point is EmergencyPointSummary & {
        latitude: number;
        longitude: number;
      } => point.latitude !== null && point.longitude !== null,
    )
    .map((point) => ({
      ...point,
      distanceMeters: Math.round(
        distanceMeters(options, {
          latitude: point.latitude,
          longitude: point.longitude,
        }),
      ),
    }))
    .filter((point) => point.distanceMeters <= radiusMeters)
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
    .slice(0, Math.min(Math.max(Math.trunc(options.limit ?? 10), 1), 100));
}

export async function findNearestEmergencyInstitutions(options: {
  latitude: number;
  limit?: number;
  longitude: number;
  radiusMeters?: number;
}) {
  const radiusMeters = Math.min(
    Math.max(options.radiusMeters ?? 100_000, 1_000),
    200_000,
  );
  const latitudeDelta = radiusMeters / 111_320;
  const longitudeDelta =
    radiusMeters /
    (111_320 * Math.max(Math.cos(toRadians(options.latitude)), 0.1));
  const candidates = await listPoints({
    bounds: {
      maxLatitude: options.latitude + latitudeDelta,
      maxLongitude: options.longitude + longitudeDelta,
      minLatitude: options.latitude - latitudeDelta,
      minLongitude: options.longitude - longitudeDelta,
    },
    limit: 5_000,
    source: "emergency-medical-institutions",
  });

  return candidates
    .filter(
      (
        point,
      ): point is EmergencyPoint & {
        latitude: number;
        longitude: number;
      } => point.latitude !== null && point.longitude !== null,
    )
    .map((point) => ({
      ...point,
      distanceMeters: Math.round(
        distanceMeters(options, {
          latitude: point.latitude,
          longitude: point.longitude,
        }),
      ),
    }))
    .filter((point) => point.distanceMeters <= radiusMeters)
    .sort((left, right) => left.distanceMeters - right.distanceMeters)
    .slice(0, Math.min(Math.max(Math.trunc(options.limit ?? 30), 1), 100));
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

function mapAdminUpdateCooldownRow(
  action: string,
  row: AdminUpdateCooldownRow | undefined,
  cooldownMs: number,
): AdminUpdateCooldown {
  const lastUsedAt = row?.last_used_at ?? null;
  const nextAvailableAt = lastUsedAt
    ? new Date(new Date(lastUsedAt).getTime() + cooldownMs).toISOString()
    : null;
  const remainingMs = nextAvailableAt
    ? Math.max(0, new Date(nextAvailableAt).getTime() - Date.now())
    : 0;

  return {
    action,
    available: remainingMs === 0,
    cooldownMs,
    lastUsedAt,
    nextAvailableAt,
    remainingMs,
  };
}

export class AdminUpdateCooldownError extends Error {
  cooldown: AdminUpdateCooldown;

  constructor(cooldown: AdminUpdateCooldown) {
    super("Admin update cooldown is active");
    this.cooldown = cooldown;
  }
}

export async function getAdminUpdateCooldowns(
  actions: string[],
  cooldownMs = ADMIN_UPDATE_COOLDOWN_MS,
) {
  const db = await getDatabase();

  if (actions.length === 0) {
    const rows = await all<AdminUpdateCooldownRow>(
      db,
      "SELECT * FROM admin_update_cooldowns ORDER BY action",
    );

    return rows.map((row) =>
      mapAdminUpdateCooldownRow(row.action, row, cooldownMs),
    );
  }

  const rows = await all<AdminUpdateCooldownRow>(
    db,
    `SELECT * FROM admin_update_cooldowns
      WHERE action IN (${actions.map(() => "?").join(",")})`,
    actions,
  );
  const byAction = new Map(rows.map((row) => [row.action, row]));

  return actions.map((action) =>
    mapAdminUpdateCooldownRow(action, byAction.get(action), cooldownMs),
  );
}

export async function assertAdminUpdateAvailable(action: string) {
  const [cooldown] = await getAdminUpdateCooldowns([action]);

  if (cooldown && !cooldown.available) {
    throw new AdminUpdateCooldownError(cooldown);
  }
}

export async function recordAdminUpdateUsed(action: string) {
  const db = await getDatabase();

  await run(
    db,
    `INSERT INTO admin_update_cooldowns (
      action,
      last_used_at,
      updated_at
    ) VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(action) DO UPDATE SET
      last_used_at = excluded.last_used_at,
      updated_at = CURRENT_TIMESTAMP`,
    [action, new Date().toISOString()],
  );
}

export async function getAppSetting<TValue>(
  key: string,
  fallback: TValue,
): Promise<TValue> {
  const db = await getDatabase();
  const row = await get<AppSettingRow>(
    db,
    "SELECT * FROM app_settings WHERE key = ?",
    [key],
  );

  if (!row) {
    return fallback;
  }

  try {
    return JSON.parse(row.value_json) as TValue;
  } catch {
    return fallback;
  }
}

export async function setAppSetting(key: string, value: unknown) {
  const db = await getDatabase();

  await run(
    db,
    `INSERT INTO app_settings (
      key,
      value_json,
      updated_at
    ) VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET
      value_json = excluded.value_json,
      updated_at = CURRENT_TIMESTAMP`,
    [key, JSON.stringify(value)],
  );
}

const DATASET_PROGRESS_SETTING_PREFIX = "dataset-update-progress:";

export async function setDatasetUpdateProgress(
  progress: Omit<DatasetUpdateProgress, "updatedAt">,
) {
  const value: DatasetUpdateProgress = {
    ...progress,
    percent: Math.min(100, Math.max(0, Math.round(progress.percent))),
    updatedAt: new Date().toISOString(),
  };

  await setAppSetting(
    `${DATASET_PROGRESS_SETTING_PREFIX}${progress.source}`,
    value,
  );

  return value;
}

export async function getDatasetUpdateProgress(source: DatasetSourceId) {
  return getAppSetting<DatasetUpdateProgress | null>(
    `${DATASET_PROGRESS_SETTING_PREFIX}${source}`,
    null,
  );
}

export async function upsertHazardEvents(params: {
  events: HazardEventInput[];
  fetchedAt: string;
}) {
  await withWriteTransaction(async (db) => {
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
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(event_id) DO UPDATE SET
          event_type = excluded.event_type,
          title = excluded.title,
          issued_at = excluded.issued_at,
          occurred_at = excluded.occurred_at,
          latitude = excluded.latitude,
          longitude = excluded.longitude,
          location = excluded.location,
          magnitude = excluded.magnitude,
          intensity = excluded.intensity,
          depth = excluded.depth,
          description = excluded.description,
          image_url = excluded.image_url,
          raw_json = excluded.raw_json,
          fetched_at = excluded.fetched_at,
          updated_at = CURRENT_TIMESTAMP`,
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
  });
}

export async function getKakaoLocalUsage() {
  const db = await getDatabase();
  const row = await getKakaoLocalUsageWindowRow(db);

  return row ? mapUsageWindowRow(row) : emptyKakaoLocalUsageWindow();
}

export async function getKmaEarthquakeUsage() {
  const db = await getDatabase();
  const row = await getKmaEarthquakeUsageWindowRow(db);

  return row ? mapUsageWindowRow(row) : emptyKmaEarthquakeUsageWindow();
}

export async function consumeKakaoLocalQuota() {
  const now = new Date();
  const nowIso = now.toISOString();
  await withWriteTransaction(async (db) => {
    const existing = await getKakaoLocalUsageWindowRow(db);
    const shouldReset =
      existing?.window_ends_at && now >= new Date(existing.window_ends_at);
    const windowStartedAt =
      existing && !shouldReset ? existing.window_started_at : nowIso;
    const registeredAt = existing?.registered_at ?? nowIso;
    const windowEndsAt =
      existing && !shouldReset && existing.window_ends_at
        ? existing.window_ends_at
        : nextKstMidnight(now).toISOString();
    const currentUsedCount = existing && !shouldReset ? existing.used_count : 0;

    if (currentUsedCount >= KAKAO_LOCAL_DAILY_LIMIT) {
      throw new Error("Kakao Local API daily request quota exceeded");
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
        "kakao-local",
        registeredAt,
        windowStartedAt,
        windowEndsAt,
        currentUsedCount + 1,
        KAKAO_LOCAL_DAILY_LIMIT,
      ],
    );
  });

  return getKakaoLocalUsage();
}

export async function consumeKmaEarthquakeQuota(requestCount = 1) {
  const now = new Date();
  const nowIso = now.toISOString();
  await withWriteTransaction(async (db) => {
    const existing = await getKmaEarthquakeUsageWindowRow(db);
    const shouldReset =
      existing?.window_ends_at && now >= new Date(existing.window_ends_at);
    const windowStartedAt =
      existing && !shouldReset ? existing.window_started_at : nowIso;
    const registeredAt = existing?.registered_at ?? nowIso;
    const windowEndsAt =
      existing && !shouldReset && existing.window_ends_at
        ? existing.window_ends_at
        : nextKstMidnight(now).toISOString();
    const currentUsedCount = existing && !shouldReset ? existing.used_count : 0;

    if (currentUsedCount + requestCount > KMA_EARTHQUAKE_DAILY_LIMIT) {
      throw new Error("KMA earthquake daily request quota exceeded");
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
        "kma-earthquake",
        registeredAt,
        windowStartedAt,
        windowEndsAt,
        currentUsedCount + requestCount,
        KMA_EARTHQUAKE_DAILY_LIMIT,
      ],
    );
  });

  return getKmaEarthquakeUsage();
}

export async function listDatasetStatuses() {
  const db = await getDatabase();
  const rows = await all<StatusRow>(
    db,
    "SELECT * FROM dataset_updates ORDER BY source",
  );
  const bySource = new Map(rows.map((row) => [row.source, mapStatusRow(row)]));
  const progressRows = await all<DatasetImportProgressRow>(
    db,
    "SELECT * FROM dataset_import_progress ORDER BY source",
  );
  const progressBySource = new Map(
    progressRows.map((row) => [
      row.source,
      stripCheckpointPoints(mapImportProgressRow(row)),
    ]),
  );

  const sources = Object.keys(DATASET_SOURCES) as DatasetSourceId[];
  const updateProgresses = await Promise.all(
    sources.map((source) => getDatasetUpdateProgress(source)),
  );

  return sources.map((source, index) =>
    withUpdateProgress(
      withImportProgress(
        bySource.get(source) ?? emptyStatus(source),
        progressBySource.get(source) ?? null,
      ),
      updateProgresses[index] ?? null,
    ),
  );
}

export async function getDatasetStatus(source: DatasetSourceId) {
  const db = await getDatabase();
  const row = await get<StatusRow>(
    db,
    "SELECT * FROM dataset_updates WHERE source = ?",
    [source],
  );
  const progress = await getDatasetImportProgress(source);

  return withUpdateProgress(
    withImportProgress(row ? mapStatusRow(row) : emptyStatus(source), progress),
    await getDatasetUpdateProgress(source),
  );
}

export async function getDatasetImportCheckpoint(source: DatasetSourceId) {
  const db = await getDatabase();
  const row = await get<DatasetImportProgressRow>(
    db,
    "SELECT * FROM dataset_import_progress WHERE source = ?",
    [source],
  );

  return row ? mapImportProgressRow(row) : null;
}

export async function getDatasetImportProgress(source: DatasetSourceId) {
  const checkpoint = await getDatasetImportCheckpoint(source);

  return checkpoint ? stripCheckpointPoints(checkpoint) : null;
}

export async function saveDatasetImportProgress(
  checkpoint: DatasetImportCheckpoint,
) {
  const db = await getDatabase();

  await run(
    db,
    `INSERT INTO dataset_import_progress (
      source,
      status,
      mode,
      next_index,
      total_count,
      imported_count,
      geocoded_count,
      skipped_count,
      failed_count,
      reason,
      points_json,
      fetched_at,
      started_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(source) DO UPDATE SET
      status = excluded.status,
      mode = excluded.mode,
      next_index = excluded.next_index,
      total_count = excluded.total_count,
      imported_count = excluded.imported_count,
      geocoded_count = excluded.geocoded_count,
      skipped_count = excluded.skipped_count,
      failed_count = excluded.failed_count,
      reason = excluded.reason,
      points_json = excluded.points_json,
      fetched_at = excluded.fetched_at,
      started_at = excluded.started_at,
      updated_at = CURRENT_TIMESTAMP`,
    [
      checkpoint.source,
      checkpoint.status,
      checkpoint.mode,
      checkpoint.nextIndex,
      checkpoint.totalCount,
      checkpoint.importedCount,
      checkpoint.geocodedCount,
      checkpoint.skippedCount,
      checkpoint.failedCount,
      checkpoint.reason,
      JSON.stringify(checkpoint.points),
      checkpoint.fetchedAt,
      checkpoint.startedAt,
    ],
  );

  return getDatasetImportProgress(checkpoint.source);
}

export async function clearDatasetImportProgress(source: DatasetSourceId) {
  const db = await getDatabase();

  await run(db, "DELETE FROM dataset_import_progress WHERE source = ?", [
    source,
  ]);
}

export async function replaceDataset(params: {
  failedCount: number;
  fetchedAt: string;
  geocodedCount: number;
  points: EmergencyPointInput[];
  skippedCount: number;
  source: DatasetSourceId;
}) {
  const definition = DATASET_SOURCES[params.source];

  await withWriteTransaction(async (db) => {
    await run(db, "DELETE FROM points WHERE source = ?", [params.source]);
    await run(db, "DELETE FROM dataset_import_progress WHERE source = ?", [
      params.source,
    ]);

    const insertColumns = 11;
    const insertBatchSize = 80;

    for (
      let startIndex = 0;
      startIndex < params.points.length;
      startIndex += insertBatchSize
    ) {
      const batch = params.points.slice(
        startIndex,
        startIndex + insertBatchSize,
      );
      const placeholders = batch
        .map(
          () =>
            `(${Array.from({ length: insertColumns }, () => "?").join(", ")})`,
        )
        .join(", ");
      const values = batch.flatMap((point) => [
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
      ]);

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
        ) VALUES ${placeholders}`,
        values,
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
  });

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
