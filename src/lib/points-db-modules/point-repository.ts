import {
  allDatabase as allSqlite,
  getDatabaseRow as getSqlite,
} from "@/lib/database/query";
import type { DatasetSourceId } from "@/lib/dataset-sources";
import type {
  EmergencyPoint,
  EmergencyPointMarker,
  EmergencyPointSummary,
  PointSearchOptions,
} from "@/lib/points-db";
import { getDatabase } from "@/lib/points-db-modules/connection";

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

const POINT_ORDER_CLAUSES = {
  marker: "p.source, p.id",
  name: "p.source, p.name",
  proximity:
    "((p.latitude - ?) * (p.latitude - ?) + (p.longitude - ?) * (p.longitude - ?)), p.id",
} as const;
const POINT_WHERE_CLAUSES = {
  boundsLatitude: "p.latitude BETWEEN ? AND ?",
  boundsLongitude: "p.longitude BETWEEN ? AND ?",
  mappedLatitude: "p.latitude IS NOT NULL",
  mappedLongitude: "p.longitude IS NOT NULL",
  source: "p.source = ?",
} as const;

type PointOrderClauseId = keyof typeof POINT_ORDER_CLAUSES;

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
  value: number | undefined,
  fallback = 5_000,
  maximum = 20_000,
) {
  return Math.min(Math.max(Math.trunc(value ?? fallback), 1), maximum);
}

function buildPointWhereClause(options: PointSearchOptions) {
  const conditions: Array<keyof typeof POINT_WHERE_CLAUSES> = [];
  const params: unknown[] = [];

  if (options.source) {
    conditions.push("source");
    params.push(options.source);
  }
  if (!options.includeUnmapped) {
    conditions.push("mappedLatitude", "mappedLongitude");
  }
  if (options.bounds) {
    conditions.push("boundsLatitude", "boundsLongitude");
    params.push(options.bounds.minLatitude, options.bounds.maxLatitude);
    params.push(options.bounds.minLongitude, options.bounds.maxLongitude);
  }

  const selected = conditions.map((id) => POINT_WHERE_CLAUSES[id]);
  return {
    params,
    where: selected.length > 0 ? `WHERE ${selected.join(" AND ")}` : "",
  };
}

function buildPointOrderClause(
  options: PointSearchOptions,
  fallback: Exclude<PointOrderClauseId, "proximity">,
) {
  if (!options.center) {
    return { orderBy: POINT_ORDER_CLAUSES[fallback], orderParams: [] };
  }

  return {
    orderBy: POINT_ORDER_CLAUSES.proximity,
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
  const { orderBy, orderParams } = buildPointOrderClause(options, "name");
  const limit = clampPointLimit(options.limit, 100_000, 100_000);
  const rows = await allSqlite<PointRow>(
    db,
    `SELECT p.id, p.source, p.source_record_id, p.name, p.category,
        p.address, p.phone, p.parent_name, p.latitude, p.longitude,
        p.source_updated_at, '' AS raw_json, u.fetched_at
      FROM points p
      LEFT JOIN dataset_updates u ON u.source = p.source
      ${where}
      ORDER BY ${orderBy}
      LIMIT ?`,
    [...params, ...orderParams, limit],
  );
  return rows.map(mapPointSummaryRow);
}

export async function searchPointSummaries(query: string, limit = 20) {
  const normalized = query.trim().slice(0, 120);
  if (!normalized) return [];

  const db = await getDatabase();
  const pattern = `%${normalized.replace(/[\\%_]/g, "\\$&")}%`;
  const rows = await allSqlite<PointRow>(
    db,
    `SELECT p.id, p.source, p.source_record_id, p.name, p.category,
        p.address, p.phone, p.parent_name, p.latitude, p.longitude,
        p.source_updated_at, '' AS raw_json, u.fetched_at
      FROM points p
      LEFT JOIN dataset_updates u ON u.source = p.source
      WHERE p.name LIKE ? ESCAPE '\\'
        OR p.category LIKE ? ESCAPE '\\'
        OR p.address LIKE ? ESCAPE '\\'
      ORDER BY p.name
      LIMIT ?`,
    [pattern, pattern, pattern, Math.min(Math.max(limit, 1), 50)],
  );
  return rows.map(mapPointSummaryRow);
}

export async function listPointMarkers(options: PointSearchOptions = {}) {
  const db = await getDatabase();
  const { params, where } = buildPointWhereClause(options);
  const { orderBy, orderParams } = buildPointOrderClause(options, "marker");
  const limit = clampPointLimit(options.limit, 100_000, 100_000);
  const rows = await allSqlite<PointRow>(
    db,
    `SELECT p.id, p.source, '' AS source_record_id, '' AS name,
        p.category, '' AS address, NULL AS phone, NULL AS parent_name,
        p.latitude, p.longitude, NULL AS source_updated_at,
        '' AS raw_json, NULL AS fetched_at
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
  const { orderBy, orderParams } = buildPointOrderClause(options, "name");
  const rows = await allSqlite<PointRow>(
    db,
    `SELECT p.*, u.fetched_at
      FROM points p
      LEFT JOIN dataset_updates u ON u.source = p.source
      ${where}
      ORDER BY ${orderBy}
      LIMIT ?`,
    [...params, ...orderParams, clampPointLimit(options.limit)],
  );
  return rows.map(mapPointRow);
}

export async function listEmergencyHospitalFallbackPoints() {
  const db = await getDatabase();
  const rows = await allSqlite<PointRow>(
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
  const row = await getSqlite<PointRow>(
    db,
    `SELECT p.id, p.source, p.source_record_id, p.name, p.category,
        p.address, p.phone, p.parent_name, p.latitude, p.longitude,
        p.source_updated_at, '' AS raw_json, u.fetched_at
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
      distanceMeters: Math.round(distanceMeters(options, point)),
    }))
    .filter((point) => point.distanceMeters <= radiusMeters)
    .sort((left, right) => left.distanceMeters - right.distanceMeters)
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
      distanceMeters: Math.round(distanceMeters(options, point)),
    }))
    .filter((point) => point.distanceMeters <= radiusMeters)
    .sort((left, right) => left.distanceMeters - right.distanceMeters)
    .slice(0, Math.min(Math.max(Math.trunc(options.limit ?? 30), 1), 100));
}
