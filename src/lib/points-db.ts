import {
  allDatabase as all,
  getDatabaseRow as get,
  runDatabase as run,
} from "@/lib/database/query";
import type { DatabaseClient } from "@/lib/database/types";
import type { DatasetUpdateProgress } from "@/lib/dataset-progress";
import { DATASET_SOURCES, type DatasetSourceId } from "@/lib/dataset-sources";
import {
  closeDatabase,
  databaseFileExists,
  getDatabase,
  getDatabaseFilePath,
  getDataDirectoryPath,
  getSqliteWriteSafetyStatus,
  withDatabaseWriteTransaction,
} from "@/lib/points-db-modules/connection";
import {
  findNearestEmergencyInstitutions,
  findNearestPoints,
  getPointSummary,
  listEmergencyHospitalFallbackPoints,
  listPointMarkers,
  listPointSummaries,
  listPoints,
  searchPointSummaries,
} from "@/lib/points-db-modules/point-repository";

export {
  closeDatabase,
  databaseFileExists,
  findNearestEmergencyInstitutions,
  findNearestPoints,
  getDatabase,
  getDatabaseFilePath,
  getDataDirectoryPath,
  getPointSummary,
  getSqliteWriteSafetyStatus,
  listEmergencyHospitalFallbackPoints,
  listPointMarkers,
  listPointSummaries,
  listPoints,
  searchPointSummaries,
  withDatabaseWriteTransaction,
};

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

export type AssemblyProtestInput = {
  agency: string;
  crowdSize: number | null;
  date: string;
  detailUrl: string | null;
  endsAt: string | null;
  latitude: number | null;
  location: string;
  locationScope: string | null;
  longitude: number | null;
  raw: Record<string, unknown>;
  sourceId: string;
  sourceRecordId: string;
  sourceTitle: string;
  sourceUrl: string;
  startsAt: string | null;
};

export type AssemblyProtest = AssemblyProtestInput & {
  fetchedAt: string;
  id: number;
};

export type AssemblyProtestUpdateResult = {
  date: string;
  failedSourceCount: number;
  fetchedAt: string;
  geocodedCount: number;
  importedCount: number;
  sourceResults: Array<{
    agency: string;
    error?: string;
    geocodedCount: number;
    importedCount: number;
    sourceId: string;
    status: "failure" | "success";
  }>;
  sourceCount: number;
};

export type AssemblyGeocodeSearchMode = "address" | "both" | "keyword";

export type AssemblyGeocodeCacheInput = {
  latitude: number;
  longitude: number;
  matchedAddress: string | null;
  query: string;
  searchMode: AssemblyGeocodeSearchMode;
  source: string;
};

export type AssemblyGeocodeCacheEntry = AssemblyGeocodeCacheInput & {
  createdAt: string;
  updatedAt: string;
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

type AssemblyProtestRow = {
  agency: string;
  crowd_size: number | null;
  date: string;
  detail_url: string | null;
  ends_at: string | null;
  fetched_at: string;
  id: number;
  latitude: number | null;
  location: string;
  location_scope: string | null;
  longitude: number | null;
  raw_json: string;
  source_id: string;
  source_record_id: string;
  source_title: string;
  source_url: string;
  starts_at: string | null;
};

type AssemblyGeocodeCacheRow = {
  created_at: string;
  latitude: number;
  longitude: number;
  matched_address: string | null;
  provider_source: string;
  query: string;
  search_mode: AssemblyGeocodeSearchMode;
  updated_at: string;
};

export const ADMIN_UPDATE_COOLDOWN_MS = 5 * 60 * 1000;
const KMA_EARTHQUAKE_DAILY_LIMIT = 5_000;
const KAKAO_LOCAL_DAILY_LIMIT = 100_000;
const API_LOG_WHERE_CLAUSES = {
  category: "category = ?",
  source: "source = ?",
} as const;
const ASSEMBLY_PROTEST_WHERE_CLAUSES = {
  date: "date = ?",
} as const;

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

function mapAssemblyProtestRow(row: AssemblyProtestRow): AssemblyProtest {
  return {
    agency: row.agency,
    crowdSize: row.crowd_size,
    date: row.date,
    detailUrl: row.detail_url,
    endsAt: row.ends_at,
    fetchedAt: row.fetched_at,
    id: row.id,
    latitude: row.latitude,
    location: row.location,
    locationScope: row.location_scope,
    longitude: row.longitude,
    raw: JSON.parse(row.raw_json) as Record<string, unknown>,
    sourceId: row.source_id,
    sourceRecordId: row.source_record_id,
    sourceTitle: row.source_title,
    sourceUrl: row.source_url,
    startsAt: row.starts_at,
  };
}

function normalizeAssemblyGeocodeCacheQuery(query: string) {
  return query.replace(/\s+/g, " ").trim().toLocaleLowerCase("ko-KR");
}

function assemblyGeocodeCacheKey(params: {
  query: string;
  searchMode: AssemblyGeocodeSearchMode;
}) {
  const query = normalizeAssemblyGeocodeCacheQuery(params.query);
  return query ? `${params.searchMode}:${query}` : null;
}

function mapAssemblyGeocodeCacheRow(
  row: AssemblyGeocodeCacheRow,
): AssemblyGeocodeCacheEntry {
  return {
    createdAt: row.created_at,
    latitude: row.latitude,
    longitude: row.longitude,
    matchedAddress: row.matched_address,
    query: row.query,
    searchMode: row.search_mode,
    source: row.provider_source,
    updatedAt: row.updated_at,
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

function buildSqlPlaceholders(count: number, separator = ",") {
  if (!Number.isSafeInteger(count) || count < 1) {
    return "?";
  }

  return Array.from({ length: count }, () => "?").join(separator);
}

function buildWhitelistedWhereClause(
  ids: readonly string[],
  clauses: Readonly<Record<string, string>>,
) {
  const selected = ids.flatMap((id) =>
    Object.hasOwn(clauses, id) ? [clauses[id]] : [],
  );

  return selected.length > 0 ? `WHERE ${selected.join(" AND ")}` : "";
}

async function getKakaoLocalUsageWindowRow(db: DatabaseClient) {
  return get<ApiUsageWindowRow>(
    db,
    "SELECT * FROM api_usage_windows WHERE provider = ?",
    ["kakao-local"],
  );
}

async function getKmaEarthquakeUsageWindowRow(db: DatabaseClient) {
  return get<ApiUsageWindowRow>(
    db,
    "SELECT * FROM api_usage_windows WHERE provider = ?",
    ["kma-earthquake"],
  );
}

export async function listApiLogs(
  options: {
    category?: ApiLogInput["category"] | null;
    limit?: number;
    source?: DatasetSourceId | null;
  } = {},
) {
  const db = await getDatabase();
  const conditions: Array<keyof typeof API_LOG_WHERE_CLAUSES> = [];
  const params: unknown[] = [];
  const limit = Math.min(Math.max(options.limit ?? 200, 1), 500);

  if (options.category) {
    conditions.push("category");
    params.push(options.category);
  }

  if (options.source) {
    conditions.push("source");
    params.push(options.source);
  }

  const where = buildWhitelistedWhereClause(conditions, API_LOG_WHERE_CLAUSES);
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

export async function listAssemblyProtests(
  options: { date?: string; limit?: number } = {},
) {
  const db = await getDatabase();
  const conditions: Array<keyof typeof ASSEMBLY_PROTEST_WHERE_CLAUSES> = [];
  const params: unknown[] = [];
  const limit = Math.min(Math.max(options.limit ?? 500, 1), 2_000);

  if (options.date) {
    conditions.push("date");
    params.push(options.date);
  }

  const where = buildWhitelistedWhereClause(
    conditions,
    ASSEMBLY_PROTEST_WHERE_CLAUSES,
  );
  const rows = await all<AssemblyProtestRow>(
    db,
    `SELECT *
      FROM assembly_protests
      ${where}
      ORDER BY date DESC, COALESCE(starts_at, ends_at, fetched_at), agency, id
      LIMIT ?`,
    [...params, limit],
  );

  return rows.map(mapAssemblyProtestRow);
}

export async function replaceAssemblyProtestsForDate(params: {
  date: string;
  fetchedAt: string;
  protests: AssemblyProtestInput[];
  sourceIds: string[];
}) {
  await withDatabaseWriteTransaction(async (db) => {
    if (params.sourceIds.length > 0) {
      await run(
        db,
        `DELETE FROM assembly_protests
          WHERE date = ?
            AND source_id IN (${buildSqlPlaceholders(params.sourceIds.length)})`,
        [params.date, ...params.sourceIds],
      );
    }

    for (const protest of params.protests) {
      await run(
        db,
        `INSERT INTO assembly_protests (
          source_id,
          source_record_id,
          source_url,
          detail_url,
          agency,
          date,
          source_title,
          starts_at,
          ends_at,
          location,
          location_scope,
          latitude,
          longitude,
          crowd_size,
          raw_json,
          fetched_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(source_id, source_record_id, date) DO UPDATE SET
          source_url = excluded.source_url,
          detail_url = excluded.detail_url,
          agency = excluded.agency,
          source_title = excluded.source_title,
          starts_at = excluded.starts_at,
          ends_at = excluded.ends_at,
          location = excluded.location,
          location_scope = excluded.location_scope,
          latitude = excluded.latitude,
          longitude = excluded.longitude,
          crowd_size = excluded.crowd_size,
          raw_json = excluded.raw_json,
          fetched_at = excluded.fetched_at,
          updated_at = CURRENT_TIMESTAMP`,
        [
          protest.sourceId,
          protest.sourceRecordId,
          protest.sourceUrl,
          protest.detailUrl,
          protest.agency,
          protest.date,
          protest.sourceTitle,
          protest.startsAt,
          protest.endsAt,
          protest.location,
          protest.locationScope,
          protest.latitude,
          protest.longitude,
          protest.crowdSize,
          JSON.stringify(protest.raw),
          params.fetchedAt,
        ],
      );
    }
  });
}

export async function getAssemblyGeocodeCacheEntry(params: {
  query: string;
  searchMode: AssemblyGeocodeSearchMode;
}) {
  const cacheKey = assemblyGeocodeCacheKey(params);
  if (!cacheKey) return null;

  const db = await getDatabase();
  const row = await get<AssemblyGeocodeCacheRow>(
    db,
    `SELECT
        created_at,
        latitude,
        longitude,
        matched_address,
        provider_source,
        query,
        search_mode,
        updated_at
      FROM assembly_geocode_cache
      WHERE cache_key = ?`,
    [cacheKey],
  );

  return row ? mapAssemblyGeocodeCacheRow(row) : null;
}

export async function saveAssemblyGeocodeCacheEntry(
  input: AssemblyGeocodeCacheInput,
) {
  const cacheKey = assemblyGeocodeCacheKey(input);
  if (!cacheKey) return null;

  const db = await getDatabase();
  await run(
    db,
    `INSERT INTO assembly_geocode_cache (
      cache_key,
      query,
      search_mode,
      latitude,
      longitude,
      matched_address,
      provider_source,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(cache_key) DO UPDATE SET
      query = excluded.query,
      search_mode = excluded.search_mode,
      latitude = excluded.latitude,
      longitude = excluded.longitude,
      matched_address = excluded.matched_address,
      provider_source = excluded.provider_source,
      updated_at = CURRENT_TIMESTAMP`,
    [
      cacheKey,
      input.query.replace(/\s+/g, " ").trim(),
      input.searchMode,
      input.latitude,
      input.longitude,
      input.matchedAddress,
      input.source,
    ],
  );

  return getAssemblyGeocodeCacheEntry(input);
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
      WHERE action IN (${buildSqlPlaceholders(actions.length)})`,
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
  await withDatabaseWriteTransaction(async (db) => {
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
  await withDatabaseWriteTransaction(async (db) => {
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
  await withDatabaseWriteTransaction(async (db) => {
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
