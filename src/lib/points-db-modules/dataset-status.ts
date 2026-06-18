import {
  allDatabase as all,
  getDatabaseRow as get,
  runDatabase as run,
} from "@/lib/database/query";
import { DATASET_SOURCES, type DatasetSourceId } from "@/lib/dataset-sources";
import { getDatasetUpdateProgress } from "@/lib/points-db-modules/admin-settings";
import {
  getDatabase,
  withDatabaseWriteTransaction,
} from "@/lib/points-db-modules/connection";
import { buildSqlPlaceholders } from "@/lib/points-db-modules/sql-utils";
import type {
  DatasetImportCheckpoint,
  DatasetImportMode,
  DatasetImportProgress,
  DatasetImportProgressStatus,
  DatasetStatus,
  DatasetUpdateResult,
  EmergencyPointInput,
} from "@/lib/points-db-types";

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
  if (progress && status.recordCount === 0 && progress.importedCount > 0) {
    return {
      ...status,
      failedCount: progress.failedCount,
      fetchedAt: progress.fetchedAt,
      geocodedCount: progress.geocodedCount,
      importProgress: progress,
      recordCount: progress.importedCount,
      skippedCount: progress.skippedCount,
      updatedAt: progress.updatedAt,
    };
  }

  return {
    ...status,
    importProgress: progress,
  };
}

function withUpdateProgress(
  status: DatasetStatus,
  updateProgress: DatasetStatus["updateProgress"],
) {
  return { ...status, updateProgress };
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

  await withDatabaseWriteTransaction(async (db) => {
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
        .map(() => `(${buildSqlPlaceholders(insertColumns, ", ")})`)
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
