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

const dataDirectory = path.join(process.cwd(), "data");
const databasePath = path.join(dataDirectory, "points.sqlite");

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
    "CREATE INDEX IF NOT EXISTS points_source_idx ON points(source)",
  );
  await run(
    db,
    "CREATE INDEX IF NOT EXISTS points_coordinates_idx ON points(latitude, longitude)",
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
