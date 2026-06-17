import {
  allDatabase as all,
  getDatabaseRow as get,
  runDatabase as run,
} from "@/lib/database/query";
import {
  getDatabase,
  withDatabaseWriteTransaction,
} from "@/lib/points-db-modules/connection";
import {
  buildSqlPlaceholders,
  buildWhitelistedWhereClause,
} from "@/lib/points-db-modules/sql-utils";
import type {
  AssemblyGeocodeCacheEntry,
  AssemblyGeocodeCacheInput,
  AssemblyGeocodeSearchMode,
  AssemblyProtest,
  AssemblyProtestInput,
} from "@/lib/points-db-types";

const ASSEMBLY_PROTEST_WHERE_CLAUSES = {
  date: "date = ?",
} as const;

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
