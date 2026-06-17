import type { AssemblyPoliceAgency, DatasetSourceId } from "./constants.ts";
import {
  DATASET_SOURCE_IDS,
  DATASET_SOURCES,
  POINT_COLUMNS,
} from "./constants.ts";
import { all, withDatabase } from "./database.ts";
import type {
  AssemblyProtestRow,
  AssemblyProtestSummary,
  Coordinate,
  DatasetStatusRow,
  MappedPoint,
  NearestPoint,
  PointRow,
  PointSearchOptions,
  PointSummary,
  PointWithRawRow,
} from "./types.ts";

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(Math.trunc(value), min), max);
}

export function pointFromRow(row: PointRow): PointSummary {
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

function assemblyProtestFromRow(
  row: AssemblyProtestRow,
): AssemblyProtestSummary {
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
    sourceId: row.source_id,
    sourceRecordId: row.source_record_id,
    sourceTitle: row.source_title,
    sourceUrl: row.source_url,
    startsAt: row.starts_at,
  };
}

function buildPointWhere(options: PointSearchOptions) {
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

  return {
    params,
    where: conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "",
  };
}

export async function listPointSummaries(options: PointSearchOptions = {}) {
  const limit = clamp(options.limit ?? 100, 1, 1_000);
  const { params, where } = buildPointWhere(options);

  return withDatabase(async (db) => {
    const rows = await all<PointRow>(
      db,
      `SELECT ${POINT_COLUMNS}
        FROM points p
        LEFT JOIN dataset_updates u ON u.source = p.source
        ${where}
        ORDER BY p.source, p.name
        LIMIT ?`,
      [...params, limit],
    );

    return rows.map(pointFromRow);
  });
}

export async function searchPointSummaries(query: string, limit = 20) {
  const normalized = query.trim().slice(0, 120);

  if (!normalized) {
    return [];
  }

  const pattern = `%${normalized.replace(/[\\%_]/g, "\\$&")}%`;

  return withDatabase(async (db) => {
    const rows = await all<PointRow>(
      db,
      `SELECT ${POINT_COLUMNS}
        FROM points p
        LEFT JOIN dataset_updates u ON u.source = p.source
        WHERE p.name LIKE ? ESCAPE '\\'
          OR p.category LIKE ? ESCAPE '\\'
          OR p.address LIKE ? ESCAPE '\\'
        ORDER BY p.name
        LIMIT ?`,
      [pattern, pattern, pattern, clamp(limit, 1, 50)],
    );

    return rows.map(pointFromRow);
  });
}

export async function datasetStatuses() {
  return withDatabase(async (db) => {
    const rows = await all<DatasetStatusRow>(
      db,
      `SELECT
        source,
        label,
        fetched_at,
        record_count,
        geocoded_count,
        skipped_count,
        failed_count,
        error,
        updated_at
      FROM dataset_updates
      ORDER BY source`,
    );
    const bySource = new Map(rows.map((row) => [row.source, row]));

    return DATASET_SOURCE_IDS.map((source) => {
      const row = bySource.get(source);
      const definition = DATASET_SOURCES[source];

      return {
        error: row?.error ?? null,
        failedCount: row?.failed_count ?? 0,
        fetchedAt: row?.fetched_at ?? null,
        geocodedCount: row?.geocoded_count ?? 0,
        id: source,
        label: row?.label ?? definition.label,
        recordCount: row?.record_count ?? 0,
        skippedCount: row?.skipped_count ?? 0,
        type: definition.type,
        updatedAt: row?.updated_at ?? null,
      };
    });
  });
}

export async function listAssemblyProtestsForMcp(options: {
  date: string;
  limit?: number;
  mappedOnly?: boolean;
  sourceId?: AssemblyPoliceAgency;
}) {
  const conditions = ["date = ?"];
  const params: unknown[] = [options.date];
  const limit = clamp(options.limit ?? 500, 1, 2_000);

  if (options.sourceId) {
    conditions.push("source_id = ?");
    params.push(options.sourceId);
  }

  if (options.mappedOnly) {
    conditions.push("latitude IS NOT NULL");
    conditions.push("longitude IS NOT NULL");
  }

  try {
    return await withDatabase(async (db) => {
      const rows = await all<AssemblyProtestRow>(
        db,
        `SELECT
          id,
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
          fetched_at
        FROM assembly_protests
        WHERE ${conditions.join(" AND ")}
        ORDER BY COALESCE(starts_at, ends_at, fetched_at), agency, id
        LIMIT ?`,
        [...params, limit],
      );

      return rows.map(assemblyProtestFromRow);
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("no such table: assembly_protests")
    ) {
      return [];
    }

    throw error;
  }
}

export function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

export function distanceMeters(from: Coordinate, to: Coordinate) {
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

export function isWithinKoreaCoordinates(coordinates: Coordinate) {
  return (
    coordinates.latitude >= 32 &&
    coordinates.latitude <= 39 &&
    coordinates.longitude >= 124 &&
    coordinates.longitude <= 132
  );
}

export async function nearestPoints(options: {
  latitude: number;
  limit?: number;
  longitude: number;
  radiusMeters?: number;
  source?: DatasetSourceId;
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
    limit: 1_000,
    source: options.source,
  });

  return candidates
    .filter(
      (point): point is MappedPoint =>
        point.latitude !== null && point.longitude !== null,
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
    .filter(
      (point): point is NearestPoint => point.distanceMeters <= radiusMeters,
    )
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
    .slice(0, clamp(options.limit ?? 10, 1, 50));
}

export function pointWithRawFromRow(row: PointWithRawRow): PointSummary & {
  raw: Record<string, string>;
} {
  return {
    ...pointFromRow(row),
    raw: JSON.parse(row.raw_json) as Record<string, string>,
  };
}
