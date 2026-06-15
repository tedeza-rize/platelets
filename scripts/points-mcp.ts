#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import Database from "better-sqlite3";
import { z } from "zod/v4";
import { loadMcpRuntimeApiKeys } from "./mcp-runtime-config.ts";

const DATASET_SOURCE_IDS = [
  "fire-stations",
  "fire-safety-targets",
  "fire-water-sources",
  "busan-fire-safety-targets",
  "busan-fire-water-sources",
  "police-stations",
  "aeds",
  "childcare-centers",
  "pharmacies",
  "hospitals",
  "emergency-medical-institutions",
  "schools",
  "universities",
] as const;
type DatasetSourceId = (typeof DATASET_SOURCE_IDS)[number];

const ASSEMBLY_SOURCE_IDS = [
  "seoul",
  "busan",
  "daegu",
  "incheon",
  "gwangju",
  "daejeon",
  "ulsan",
  "sejong",
  "gyeonggi-south",
  "gyeonggi-north",
  "gangwon",
  "chungbuk",
  "chungnam",
  "jeonbuk",
  "jeonnam",
  "gyeongbuk",
  "gyeongnam",
  "jeju",
] as const;
type AssemblyPoliceAgency = (typeof ASSEMBLY_SOURCE_IDS)[number];

type DatasetSourceType =
  | "aed"
  | "childcare"
  | "emergency-medical"
  | "fire"
  | "fire-safety-target"
  | "fire-water"
  | "hospital"
  | "pharmacy"
  | "police"
  | "school"
  | "university";

const DATASET_SOURCES = {
  aeds: {
    label: "AED",
    type: "aed",
  },
  "fire-stations": {
    label: "소방서/119안전센터",
    type: "fire",
  },
  "fire-safety-targets": {
    label: "소방안전 빅데이터: 특정소방대상물",
    type: "fire-safety-target",
  },
  "fire-water-sources": {
    label: "소방안전 빅데이터: 소방용수",
    type: "fire-water",
  },
  "busan-fire-safety-targets": {
    label: "소방안전 빅데이터: 부산 특정소방대상물",
    type: "fire-safety-target",
  },
  "busan-fire-water-sources": {
    label: "소방안전 빅데이터: 부산 소방용수",
    type: "fire-water",
  },
  "police-stations": {
    label: "경찰서/지구대/파출소",
    type: "police",
  },
  "childcare-centers": {
    label: "어린이집/유치원",
    type: "childcare",
  },
  pharmacies: {
    label: "약국",
    type: "pharmacy",
  },
  hospitals: {
    label: "병의원",
    type: "hospital",
  },
  "emergency-medical-institutions": {
    label: "응급의료기관",
    type: "emergency-medical",
  },
  schools: {
    label: "초중고등학교",
    type: "school",
  },
  universities: {
    label: "대학교",
    type: "university",
  },
} satisfies Record<
  DatasetSourceId,
  {
    label: string;
    type: DatasetSourceType;
  }
>;
const POINT_COLUMNS = `
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
  u.fetched_at
`;
const projectRoot = process.cwd();
const dataDirectory = path.join(projectRoot, "data");
const databasePath = path.join(dataDirectory, "points.sqlite");
const runtimeApiKeys = loadMcpRuntimeApiKeys(databasePath, dataDirectory);
const forecastDocPath = path.join(
  projectRoot,
  "docs",
  "AI_FORECAST_AND_RESPONSE.md",
);

type SqliteDatabase = Database.Database;

function emergencyBedAvailability(emergencyBeds: number | null) {
  if (emergencyBeds === null) {
    return 0.45;
  }

  return emergencyBeds > 0 ? 1 : 0.05;
}

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
  source: DatasetSourceId;
  source_record_id: string;
  source_updated_at: string | null;
};

type PointWithRawRow = PointRow & {
  raw_json: string;
};

type DatasetStatusRow = {
  error: string | null;
  failed_count: number;
  fetched_at: string | null;
  geocoded_count: number;
  label: string;
  record_count: number;
  skipped_count: number;
  source: DatasetSourceId;
  updated_at: string | null;
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
  source_id: AssemblyPoliceAgency;
  source_record_id: string;
  source_title: string;
  source_url: string;
  starts_at: string | null;
};

type Coordinate = {
  latitude: number;
  longitude: number;
};

type PointBounds = {
  maxLatitude: number;
  maxLongitude: number;
  minLatitude: number;
  minLongitude: number;
};

type PointSearchOptions = {
  bounds?: PointBounds;
  includeUnmapped?: boolean;
  limit?: number;
  source?: DatasetSourceId;
};

type PointSummary = {
  address: string;
  category: string;
  fetchedAt: string | null;
  id: number;
  latitude: number | null;
  longitude: number | null;
  name: string;
  parentName: string | null;
  phone: string | null;
  source: DatasetSourceId;
  sourceRecordId: string;
  sourceUpdatedAt: string | null;
};

type AssemblyProtestSummary = {
  agency: string;
  crowdSize: number | null;
  date: string;
  detailUrl: string | null;
  endsAt: string | null;
  fetchedAt: string;
  id: number;
  latitude: number | null;
  location: string;
  locationScope: string | null;
  longitude: number | null;
  sourceId: AssemblyPoliceAgency;
  sourceRecordId: string;
  sourceTitle: string;
  sourceUrl: string;
  startsAt: string | null;
};

type MappedPoint = Omit<PointSummary, "latitude" | "longitude"> & Coordinate;

type NearestPoint = MappedPoint & {
  distanceMeters: number;
};

type EmergencyScenario =
  | "general"
  | "pediatric-respiratory"
  | "cardiac"
  | "stroke"
  | "trauma"
  | "burn"
  | "delivery"
  | "elderly-fall";

const STRICT_EMERGENCY_SCENARIOS = new Set<EmergencyScenario>([
  "pediatric-respiratory",
  "cardiac",
  "stroke",
  "trauma",
  "burn",
  "delivery",
]);

type EmergencyCandidate = MappedPoint & {
  raw: Record<string, string>;
  distanceMeters: number;
};

type KakaoDirectionSummary = {
  distanceMeters: number;
  durationSeconds: number;
  fare: unknown;
  priority: string;
};

type KakaoDirectionError = {
  error: string;
  resultCode?: number | null;
};

type KakaoDirectionResult = KakaoDirectionError | KakaoDirectionSummary | null;

type EmergencyHospitalRecommendation = {
  address: string;
  category: string;
  distanceMeters: number;
  durationSeconds: number;
  emergencyBeds: number | null;
  id: number;
  name: string;
  phone: string | null;
  route: KakaoDirectionResult;
  score: number;
  scoreBasis: string;
  scenarioMinimum: string;
  sourceUpdatedAt: string | null;
};

type VworldSearchResult = Coordinate & {
  matchedAddress: string | null;
  query: string;
  source: string;
  title: string | null;
};

type RankedResponsePoint = NearestPoint & {
  route: KakaoDirectionResult;
  scoreBasis: "kakao-route-duration" | "straight-line-distance";
};

type ToolResult = {
  content: Array<{
    text: string;
    type: "text";
  }>;
  structuredContent: Record<string, unknown>;
};

type KakaoDirectionsResponse = {
  routes?: Array<{
    result_code?: number;
    result_msg?: string;
    summary?: {
      distance?: number;
      duration?: number;
      fare?: unknown;
      priority?: string;
    };
  }>;
};

type KakaoLocalSearchKind = "address" | "keyword";

type KakaoLocalSearchResponse = {
  documents?: Array<{
    address?: {
      address_name?: string;
    } | null;
    address_name?: string;
    place_name?: string;
    road_address?: {
      address_name?: string;
    } | null;
    x?: string;
    y?: string;
  }>;
  errorType?: string;
  message?: string;
  meta?: {
    total_count?: number;
  };
};

type VworldSearchMode = "address" | "both" | "keyword";

type VworldAddressResponse = {
  response?: {
    error?: {
      code?: string;
      text?: string;
    };
    result?:
      | {
          point?: {
            x?: string;
            y?: string;
          };
        }
      | Array<{
          text?: string;
        }>;
    status?: string;
  };
};

type VworldSearchResponse = {
  response?: {
    error?: {
      code?: string;
      text?: string;
    };
    result?: {
      items?: Array<{
        address?: {
          parcel?: string;
          road?: string;
        };
        point?: {
          x?: string;
          y?: string;
        };
        title?: string;
      }>;
    };
    status?: string;
  };
};

async function getDatabase(): Promise<SqliteDatabase> {
  return new Database(databasePath, {
    fileMustExist: true,
    readonly: true,
    timeout: 5_000,
  });
}

async function all<TRow>(
  db: SqliteDatabase,
  sql: string,
  params: unknown[] = [],
): Promise<TRow[]> {
  return db.prepare(sql).all(...params) as TRow[];
}

async function closeDatabase(db: SqliteDatabase): Promise<void> {
  db.close();
}

async function withDatabase<TResult>(
  callback: (db: SqliteDatabase) => Promise<TResult>,
) {
  const db = await getDatabase();

  try {
    return await callback(db);
  } finally {
    await closeDatabase(db);
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(Math.trunc(value), min), max);
}

function pointFromRow(row: PointRow): PointSummary {
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

async function listPointSummaries(options: PointSearchOptions = {}) {
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

async function searchPointSummaries(query: string, limit = 20) {
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

async function datasetStatuses() {
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

async function listAssemblyProtestsForMcp(options: {
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

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function distanceMeters(from: Coordinate, to: Coordinate) {
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

function isWithinKoreaCoordinates(coordinates: Coordinate) {
  return (
    coordinates.latitude >= 32 &&
    coordinates.latitude <= 39 &&
    coordinates.longitude >= 124 &&
    coordinates.longitude <= 132
  );
}

async function nearestPoints(options: {
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

function pointWithRawFromRow(row: PointWithRawRow): PointSummary & {
  raw: Record<string, string>;
} {
  return {
    ...pointFromRow(row),
    raw: JSON.parse(row.raw_json) as Record<string, string>,
  };
}

function gradeRatio(category: string) {
  if (/권역|전문/.test(category)) return 1;
  if (/지역응급의료센터/.test(category)) return 0.85;
  if (/지역응급의료기관/.test(category)) return 0.65;
  return 0.45;
}

function rawSearchText(raw: Record<string, string>) {
  return Object.entries(raw)
    .filter(([key, value]) => value && !key.toLowerCase().includes("addr"))
    .map(([key, value]) => `${key} ${value}`)
    .join(" ")
    .toLowerCase();
}

function termRatio(text: string, terms: string[]) {
  if (terms.length === 0) return 0.5;
  const matches = terms.filter((term) =>
    text.includes(term.toLowerCase()),
  ).length;
  return Math.min(1, 0.2 + matches / Math.min(3, terms.length));
}

function numeric(raw: Record<string, string>, keys: string[]) {
  for (const key of keys) {
    const value = Number(raw[key]);
    if (Number.isFinite(value)) return value;
  }
  return null;
}

function isEmergencyOperating(candidate: {
  category: string;
  raw: Record<string, string>;
}) {
  const text = rawSearchText(candidate.raw);

  return (
    candidate.raw.dutyEryn === "1" ||
    /응급|권역|지역응급|센터/.test(candidate.category) ||
    /응급실|응급의료/.test(text)
  );
}

function passesEmergencyScenarioMinimum(params: {
  availability: number;
  candidate: { category: string; raw: Record<string, string> };
  capability: number;
  emergencyBeds: number | null;
  scenario: EmergencyScenario;
}) {
  if (!isEmergencyOperating(params.candidate)) {
    return {
      passed: false,
      reason: "emergency-operation-not-confirmed",
    };
  }

  if (params.emergencyBeds !== null && params.emergencyBeds <= 0) {
    return {
      passed: false,
      reason: "no-emergency-bed-available",
    };
  }

  if (!STRICT_EMERGENCY_SCENARIOS.has(params.scenario)) {
    return {
      passed: true,
      reason: "basic-emergency-minimum-passed",
    };
  }

  const highGradeEmergencyCenter =
    gradeRatio(params.candidate.category) >= 0.65;
  const passed =
    params.capability >= 0.5 ||
    (highGradeEmergencyCenter && params.availability >= 0.45);

  return {
    passed,
    reason: passed
      ? "scenario-minimum-passed"
      : "scenario-capability-not-confirmed",
  };
}

const EMERGENCY_SCENARIO_TERMS: Record<EmergencyScenario, string[]> = {
  burn: ["화상", "외과", "성형외과", "중환자", "수술"],
  cardiac: ["심장", "순환기", "흉부외과", "심근경색", "중환자"],
  delivery: ["산부인과", "분만", "신생아", "응급분만"],
  "elderly-fall": ["정형외과", "신경외과", "내과", "골절"],
  general: ["응급의학", "응급실", "내과", "외과"],
  "pediatric-respiratory": ["소아청소년과", "소아", "호흡", "신생아", "중환자"],
  stroke: ["신경과", "신경외과", "뇌혈관", "뇌경색", "뇌출혈"],
  trauma: ["외상", "외과", "정형외과", "신경외과", "중환자", "수술"],
};

async function nearestEmergencyCandidates(options: {
  latitude: number;
  limit?: number;
  longitude: number;
  radiusMeters?: number;
}) {
  const radiusMeters = Math.min(
    Math.max(options.radiusMeters ?? 120_000, 1_000),
    200_000,
  );
  const latitudeDelta = radiusMeters / 111_320;
  const longitudeDelta =
    radiusMeters /
    (111_320 * Math.max(Math.cos(toRadians(options.latitude)), 0.1));

  return withDatabase(async (db) => {
    const rows = await all<PointWithRawRow>(
      db,
      `SELECT ${POINT_COLUMNS}, p.raw_json
        FROM points p
        LEFT JOIN dataset_updates u ON u.source = p.source
        WHERE p.source = 'emergency-medical-institutions'
          AND p.latitude BETWEEN ? AND ?
          AND p.longitude BETWEEN ? AND ?
        ORDER BY ((p.latitude - ?) * (p.latitude - ?) + (p.longitude - ?) * (p.longitude - ?)), p.id
        LIMIT ?`,
      [
        options.latitude - latitudeDelta,
        options.latitude + latitudeDelta,
        options.longitude - longitudeDelta,
        options.longitude + longitudeDelta,
        options.latitude,
        options.latitude,
        options.longitude,
        options.longitude,
        5_000,
      ],
    );

    return rows
      .map(pointWithRawFromRow)
      .filter(
        (point): point is EmergencyCandidate =>
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
      .filter((point) => point.distanceMeters <= radiusMeters)
      .sort((left, right) => left.distanceMeters - right.distanceMeters)
      .slice(0, clamp(options.limit ?? 12, 1, 50));
  });
}

async function recommendEmergencyHospitalsForMcp(options: {
  latitude: number;
  limit?: number;
  longitude: number;
  radiusMeters?: number;
  scenario: EmergencyScenario;
  useDirections?: boolean;
}) {
  const origin = { latitude: options.latitude, longitude: options.longitude };
  const candidates = await nearestEmergencyCandidates({
    ...origin,
    limit: Math.max((options.limit ?? 8) * 3, 12),
    radiusMeters: options.radiusMeters,
  });
  const results: EmergencyHospitalRecommendation[] = [];

  for (const candidate of candidates.slice(0, 12)) {
    const route =
      options.useDirections === false
        ? null
        : await kakaoDirectionSummary(
            origin,
            {
              latitude: candidate.latitude,
              longitude: candidate.longitude,
            },
            "TIME",
          );
    const durationSeconds = isKakaoDirectionSummary(route)
      ? route.durationSeconds
      : Math.round((candidate.distanceMeters * 1.25) / 11.1);
    const emergencyBeds = numeric(candidate.raw, ["realtimeBed.hvec", "hvec"]);
    const capability = termRatio(
      rawSearchText(candidate.raw),
      EMERGENCY_SCENARIO_TERMS[options.scenario],
    );
    const availability = emergencyBedAvailability(emergencyBeds);
    const minimum = passesEmergencyScenarioMinimum({
      availability,
      candidate,
      capability,
      emergencyBeds,
      scenario: options.scenario,
    });

    if (!minimum.passed) {
      continue;
    }

    const travel = Math.max(0.05, 1 - durationSeconds / 60 / 90);
    const score =
      Math.round(
        (travel * 45 +
          capability * 25 +
          availability * 20 +
          gradeRatio(candidate.category) * 10) *
          10,
      ) / 10;

    results.push({
      address: candidate.address,
      category: candidate.category,
      distanceMeters: isKakaoDirectionSummary(route)
        ? route.distanceMeters
        : Math.round(candidate.distanceMeters * 1.25),
      durationSeconds,
      emergencyBeds,
      id: candidate.id,
      name: candidate.name,
      phone: candidate.phone,
      route,
      score,
      scoreBasis: isKakaoDirectionSummary(route)
        ? "kakao-route-duration-and-medical-suitability"
        : "estimated-road-time-and-medical-suitability",
      scenarioMinimum: minimum.reason,
      sourceUpdatedAt: candidate.sourceUpdatedAt,
    });
  }

  return results
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.durationSeconds - right.durationSeconds,
    )
    .slice(0, clamp(options.limit ?? 8, 1, 12));
}

function kakaoRestApiKey() {
  return runtimeApiKeys.kakaoRestApiKey;
}

function vworldApiKey() {
  return runtimeApiKeys.vworldApiKey;
}

function kakaoLocalEndpoint(kind: KakaoLocalSearchKind) {
  return kind === "address"
    ? "https://dapi.kakao.com/v2/local/search/address.json"
    : "https://dapi.kakao.com/v2/local/search/keyword.json";
}

async function kakaoLocalCoordinate(params: {
  query: string;
  searchMode: "address" | "both" | "keyword";
}) {
  const restApiKey = kakaoRestApiKey();
  const query = params.query.trim().slice(0, 160);

  if (!query) {
    return { error: "query-required", result: null };
  }

  if (!restApiKey) {
    return { error: "kakao-rest-api-key-missing", result: null };
  }

  const searchKinds: KakaoLocalSearchKind[] =
    params.searchMode === "both" ? ["keyword", "address"] : [params.searchMode];

  for (const kind of searchKinds) {
    const url = new URL(kakaoLocalEndpoint(kind));
    url.searchParams.set("query", query);
    url.searchParams.set("size", "1");

    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        Authorization: `KakaoAK ${restApiKey}`,
      },
    });

    if (!response.ok) {
      return {
        error: `Kakao Local failed with HTTP ${response.status}`,
        result: null,
      };
    }

    const payload = (await response.json()) as KakaoLocalSearchResponse;
    const first = payload.documents?.[0];
    const longitude = Number(first?.x);
    const latitude = Number(first?.y);
    const coordinates = { latitude, longitude };

    if (
      Number.isFinite(latitude) &&
      Number.isFinite(longitude) &&
      isWithinKoreaCoordinates(coordinates)
    ) {
      return {
        error: null,
        result: {
          latitude,
          longitude,
          matchedAddress:
            first?.road_address?.address_name ??
            first?.address?.address_name ??
            first?.address_name ??
            first?.place_name ??
            null,
          query,
          searchKind: kind,
          source: `kakao-local-${kind}`,
        },
      };
    }
  }

  return { error: "no-coordinate-result-inside-korea", result: null };
}

function coordinateFromVworldPoint(
  point: { x?: string; y?: string } | undefined,
) {
  const longitude = Number(point?.x);
  const latitude = Number(point?.y);
  const coordinates = { latitude, longitude };

  return Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    isWithinKoreaCoordinates(coordinates)
    ? coordinates
    : null;
}

function vworldAddressText(item: {
  address?: { parcel?: string; road?: string };
  title?: string;
}) {
  return item.address?.road ?? item.address?.parcel ?? item.title ?? null;
}

async function vworldAddressCoordinate(params: {
  query: string;
  type: "parcel" | "road";
}) {
  const apiKey = vworldApiKey();
  const query = params.query.trim().slice(0, 160);

  if (!query) return { error: "query-required", result: null };
  if (!apiKey) return { error: "vworld-api-key-missing", result: null };

  const url = new URL("https://api.vworld.kr/req/address");
  url.searchParams.set("service", "address");
  url.searchParams.set("request", "getCoord");
  url.searchParams.set("version", "2.0");
  url.searchParams.set("crs", "EPSG:4326");
  url.searchParams.set("format", "json");
  url.searchParams.set("errorformat", "json");
  url.searchParams.set("type", params.type);
  url.searchParams.set("address", query);
  url.searchParams.set("key", apiKey);

  const response = await fetch(url, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    return {
      error: `VWorld failed with HTTP ${response.status}`,
      result: null,
    };
  }

  const payload = (await response.json()) as VworldAddressResponse;
  const coordinates = coordinateFromVworldPoint(
    Array.isArray(payload.response?.result)
      ? undefined
      : payload.response?.result?.point,
  );

  if (payload.response?.status !== "OK" || !coordinates) {
    return {
      error:
        payload.response?.error?.text ??
        payload.response?.status ??
        "no-coordinate-result-inside-korea",
      result: null,
    };
  }

  return {
    error: null,
    result: {
      ...coordinates,
      matchedAddress: query,
      query,
      searchKind: params.type,
      source: `vworld-address-${params.type}`,
    },
  };
}

async function vworldSearchLocations(params: {
  limit: number;
  query: string;
  searchMode: VworldSearchMode;
}) {
  const apiKey = vworldApiKey();
  const query = params.query.trim().slice(0, 160);
  const limit = clamp(params.limit, 1, 20);

  if (!query) return { error: "query-required", results: [] };
  if (!apiKey) return { error: "vworld-api-key-missing", results: [] };

  const requests =
    params.searchMode === "address"
      ? [
          {
            category: "road",
            source: "vworld-search-address-road",
            type: "address",
          },
          {
            category: "parcel",
            source: "vworld-search-address-parcel",
            type: "address",
          },
        ]
      : [
          { source: "vworld-search-place", type: "place" },
          {
            category: "road",
            source: "vworld-search-address-road",
            type: "address",
          },
          {
            category: "parcel",
            source: "vworld-search-address-parcel",
            type: "address",
          },
          {
            category: "L4",
            source: "vworld-search-district",
            type: "district",
          },
        ];
  const results: VworldSearchResult[] = [];
  const seen = new Set<string>();

  for (const request of requests) {
    if (results.length >= limit) break;

    const url = new URL("https://api.vworld.kr/req/search");
    url.searchParams.set("service", "search");
    url.searchParams.set("request", "search");
    url.searchParams.set("version", "2.0");
    url.searchParams.set("crs", "EPSG:4326");
    url.searchParams.set("format", "json");
    url.searchParams.set("errorformat", "json");
    url.searchParams.set("page", "1");
    url.searchParams.set("size", String(limit));
    url.searchParams.set("query", query);
    url.searchParams.set("type", request.type);
    url.searchParams.set("key", apiKey);

    if (request.category) {
      url.searchParams.set("category", request.category);
    }

    const response = await fetch(url, {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) continue;

    const payload = (await response.json()) as VworldSearchResponse;
    const items = payload.response?.result?.items ?? [];

    for (const item of items) {
      const coordinates = coordinateFromVworldPoint(item.point);
      const matchedAddress = vworldAddressText(item);
      if (!coordinates) continue;

      const key = `${coordinates.latitude}:${coordinates.longitude}:${matchedAddress}`;
      if (seen.has(key)) continue;
      seen.add(key);

      results.push({
        ...coordinates,
        matchedAddress,
        query,
        source: request.source,
        title: item.title ?? null,
      });

      if (results.length >= limit) break;
    }
  }

  return { error: null, results };
}

async function vworldReverseCoordinate(params: {
  latitude: number;
  longitude: number;
  type: "both" | "parcel" | "road";
}) {
  const apiKey = vworldApiKey();
  const coordinates = {
    latitude: params.latitude,
    longitude: params.longitude,
  };

  if (!apiKey) return { error: "vworld-api-key-missing", result: null };
  if (!isWithinKoreaCoordinates(coordinates)) {
    return { error: "coordinate-outside-korea", result: null };
  }

  const url = new URL("https://api.vworld.kr/req/address");
  url.searchParams.set("service", "address");
  url.searchParams.set("request", "getAddress");
  url.searchParams.set("version", "2.0");
  url.searchParams.set("crs", "EPSG:4326");
  url.searchParams.set("format", "json");
  url.searchParams.set("errorformat", "json");
  url.searchParams.set("type", params.type);
  url.searchParams.set("point", `${params.longitude},${params.latitude}`);
  url.searchParams.set("key", apiKey);

  const response = await fetch(url, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    return {
      error: `VWorld failed with HTTP ${response.status}`,
      result: null,
    };
  }

  const payload = (await response.json()) as VworldAddressResponse;
  const addresses = Array.isArray(payload.response?.result)
    ? payload.response.result
        .map((entry) => entry.text?.trim())
        .filter((entry): entry is string => Boolean(entry))
    : [];

  if (payload.response?.status !== "OK" || addresses.length === 0) {
    return {
      error:
        payload.response?.error?.text ??
        payload.response?.status ??
        "no-address-result",
      result: null,
    };
  }

  return {
    error: null,
    result: {
      addresses: addresses.slice(0, 5),
      coordinates,
      provider: "vworld",
    },
  };
}

function isKakaoDirectionSummary(
  route: KakaoDirectionResult,
): route is KakaoDirectionSummary {
  return route !== null && !("error" in route);
}

async function kakaoDirectionSummary(
  origin: Coordinate,
  destination: Coordinate,
  priority: "RECOMMEND" | "TIME" | "DISTANCE",
): Promise<KakaoDirectionResult> {
  const restApiKey = kakaoRestApiKey();

  if (!restApiKey) {
    return null;
  }

  const url = new URL("https://apis-navi.kakaomobility.com/v1/directions");
  url.searchParams.set("origin", `${origin.longitude},${origin.latitude}`);
  url.searchParams.set(
    "destination",
    `${destination.longitude},${destination.latitude}`,
  );
  url.searchParams.set("priority", priority);
  url.searchParams.set("summary", "true");
  url.searchParams.set("alternatives", "false");
  url.searchParams.set("road_details", "false");

  const response = await fetch(url, {
    headers: {
      Authorization: `KakaoAK ${restApiKey}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    return {
      error: `Kakao directions failed with HTTP ${response.status}`,
    };
  }

  const payload = (await response.json()) as KakaoDirectionsResponse;
  const route = payload.routes?.[0];

  if (route?.result_code !== 0) {
    return {
      error: route?.result_msg ?? "Kakao directions returned no route",
      resultCode: route?.result_code ?? null,
    };
  }

  return {
    distanceMeters: route.summary?.distance ?? 0,
    durationSeconds: route.summary?.duration ?? 0,
    fare: route.summary?.fare ?? null,
    priority: route.summary?.priority ?? priority,
  };
}

function asToolResult(payload: Record<string, unknown>): ToolResult {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(payload, null, 2),
      },
    ],
    structuredContent: payload,
  };
}

const sourceSchema = z
  .enum(DATASET_SOURCE_IDS)
  .optional()
  .describe("Dataset source id. Defaults vary by tool.");
const server = new McpServer({
  name: "platelets-points",
  version: "0.1.0",
});

server.registerResource(
  "forecast-and-response-plan",
  "platelets://docs/forecast-and-response",
  {
    description:
      "119 신고 수요 예측, 긴급상황 대응 추천, 병원/응급실 확장 방향 문서",
    mimeType: "text/markdown",
    title: "Platelets AI Forecast and Response Plan",
  },
  async () => ({
    contents: [
      {
        mimeType: "text/markdown",
        text: await fs.readFile(forecastDocPath, "utf8"),
        uri: "platelets://docs/forecast-and-response",
      },
    ],
  }),
);

server.registerResource(
  "points-schema",
  "platelets://schema/points",
  {
    description: "MCP와 /api/points가 반환하는 응급 거점 요약 필드",
    mimeType: "application/json",
    title: "Emergency Point Schema",
  },
  async () => ({
    contents: [
      {
        mimeType: "application/json",
        text: JSON.stringify(
          {
            fields: {
              address: "string",
              category: "string",
              fetchedAt: "ISO timestamp or null",
              id: "number",
              latitude: "number or null",
              longitude: "number or null",
              name: "string",
              parentName: "string or null",
              phone: "string or null",
              source: DATASET_SOURCE_IDS,
              sourceRecordId: "string",
              sourceUpdatedAt: "string or null",
            },
            note: "Raw source records are intentionally excluded from MCP and default HTTP map payloads.",
          },
          null,
          2,
        ),
        uri: "platelets://schema/points",
      },
    ],
  }),
);

server.registerTool(
  "dataset_status",
  {
    description: "Return imported dataset counts and geocoding coverage.",
    inputSchema: {},
    title: "Dataset Status",
  },
  async () => asToolResult({ datasets: await datasetStatuses() }),
);

server.registerTool(
  "search_points",
  {
    description:
      "Search bounded facility summaries by name, category, or address. Raw source records are never returned.",
    inputSchema: {
      limit: z.number().int().min(1).max(50).optional().default(20),
      query: z.string().min(1).max(120),
    },
    title: "Search Points",
  },
  async (args) =>
    asToolResult({
      points: await searchPointSummaries(args.query, args.limit),
      query: args.query,
    }),
);

server.registerTool(
  "geocode_place",
  {
    description:
      "Resolve one Korean place, landmark, station exit, plaza, or address query to coordinates using Kakao Local. Use vworld_search_locations when Kakao is unavailable or more map search coverage is needed. Returns no raw provider payload.",
    inputSchema: {
      query: z.string().min(1).max(160),
      searchMode: z
        .enum(["both", "keyword", "address"])
        .optional()
        .default("both"),
    },
    title: "Geocode Place",
  },
  async (args) =>
    asToolResult({
      geocoding: await kakaoLocalCoordinate({
        query: args.query,
        searchMode: args.searchMode,
      }),
    }),
);

server.registerTool(
  "vworld_geocode_address",
  {
    description:
      "Resolve one Korean road or parcel address to coordinates using VWorld Geocoder API 2.0. Returns no raw provider payload.",
    inputSchema: {
      query: z.string().min(1).max(160),
      type: z.enum(["road", "parcel"]).optional().default("road"),
    },
    title: "VWorld Geocode Address",
  },
  async (args) =>
    asToolResult({
      geocoding: await vworldAddressCoordinate({
        query: args.query,
        type: args.type,
      }),
    }),
);

server.registerTool(
  "vworld_search_locations",
  {
    description:
      "Search Korean places, road addresses, parcel addresses, and districts using VWorld Search API 2.0. Returns bounded normalized map results only.",
    inputSchema: {
      limit: z.number().int().min(1).max(20).optional().default(5),
      query: z.string().min(1).max(160),
      searchMode: z
        .enum(["both", "keyword", "address"])
        .optional()
        .default("both"),
    },
    title: "VWorld Search Locations",
  },
  async (args) =>
    asToolResult(
      await vworldSearchLocations({
        limit: args.limit,
        query: args.query,
        searchMode: args.searchMode,
      }),
    ),
);

server.registerTool(
  "vworld_reverse_geocode",
  {
    description:
      "Resolve Korean coordinates to road and parcel addresses using VWorld Geocoder API 2.0. Returns no raw provider payload.",
    inputSchema: {
      latitude: z.number().min(32).max(39),
      longitude: z.number().min(124).max(132),
      type: z.enum(["both", "road", "parcel"]).optional().default("both"),
    },
    title: "VWorld Reverse Geocode",
  },
  async (args) =>
    asToolResult({
      reverseGeocoding: await vworldReverseCoordinate({
        latitude: args.latitude,
        longitude: args.longitude,
        type: args.type,
      }),
    }),
);

server.registerTool(
  "list_assembly_protests",
  {
    description:
      "List normalized daily assembly/protest rows imported from provincial police notices. Raw board text is never returned.",
    inputSchema: {
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      limit: z.number().int().min(1).max(2000).optional().default(500),
      mappedOnly: z.boolean().optional().default(false),
      sourceId: z.enum(ASSEMBLY_SOURCE_IDS).optional(),
    },
    title: "List Assembly Protests",
  },
  async (args) =>
    asToolResult({
      date: args.date,
      protests: await listAssemblyProtestsForMcp({
        date: args.date,
        limit: args.limit,
        mappedOnly: args.mappedOnly,
        sourceId: args.sourceId,
      }),
    }),
);

server.registerTool(
  "grounding_snapshot",
  {
    description:
      "Return compact dataset status, text matches, and optional nearby facilities for LLM grounding.",
    inputSchema: {
      latitude: z.number().min(32).max(39).optional(),
      longitude: z.number().min(124).max(132).optional(),
      query: z.string().max(120).optional().default(""),
    },
    title: "Grounding Snapshot",
  },
  async (args) => {
    const hasCoordinate =
      args.latitude !== undefined && args.longitude !== undefined;

    return asToolResult({
      datasets: await datasetStatuses(),
      matchingFacilities: args.query
        ? await searchPointSummaries(args.query, 20)
        : [],
      nearbyFacilities: hasCoordinate
        ? await nearestPoints({
            latitude: args.latitude as number,
            limit: 20,
            longitude: args.longitude as number,
            radiusMeters: 30_000,
          })
        : [],
    });
  },
);

server.registerTool(
  "list_points",
  {
    description:
      "List bounded emergency points for AI context. Use bounds and limit to keep context small.",
    inputSchema: {
      includeUnmapped: z.boolean().optional().default(false),
      limit: z.number().int().min(1).max(1000).optional().default(100),
      maxLatitude: z.number().optional(),
      maxLongitude: z.number().optional(),
      minLatitude: z.number().optional(),
      minLongitude: z.number().optional(),
      source: sourceSchema,
    },
    title: "List Points",
  },
  async (args) => {
    const hasAnyBound = [
      args.minLatitude,
      args.maxLatitude,
      args.minLongitude,
      args.maxLongitude,
    ].some((value) => value !== undefined);

    let bounds: PointBounds | undefined;

    if (hasAnyBound) {
      const { maxLatitude, maxLongitude, minLatitude, minLongitude } = args;

      if (
        minLatitude === undefined ||
        maxLatitude === undefined ||
        minLongitude === undefined ||
        maxLongitude === undefined
      ) {
        return asToolResult({
          error: "Provide all four bounding box values or none.",
        });
      }

      bounds = {
        maxLatitude,
        maxLongitude,
        minLatitude,
        minLongitude,
      };
    }

    return asToolResult({
      points: await listPointSummaries({
        bounds,
        includeUnmapped: args.includeUnmapped,
        limit: args.limit,
        source: args.source,
      }),
    });
  },
);

server.registerTool(
  "nearest_points",
  {
    description:
      "Find nearest points by straight-line distance. Good first pass before route scoring.",
    inputSchema: {
      latitude: z.number().min(32).max(39),
      limit: z.number().int().min(1).max(50).optional().default(10),
      longitude: z.number().min(124).max(132),
      radiusMeters: z
        .number()
        .int()
        .min(500)
        .max(100000)
        .optional()
        .default(20000),
      source: sourceSchema,
    },
    title: "Nearest Points",
  },
  async (args) =>
    asToolResult({
      points: await nearestPoints(args),
    }),
);

server.registerTool(
  "rank_response_points",
  {
    description:
      "Rank nearby response points for an incident. If Kakao Local is configured in Platelets, route duration is used; otherwise straight-line distance is used.",
    inputSchema: {
      latitude: z.number().min(32).max(39),
      limit: z.number().int().min(1).max(10).optional().default(5),
      longitude: z.number().min(124).max(132),
      patientType: z
        .enum([
          "unknown",
          "adult",
          "child",
          "infant",
          "trauma",
          "cardiac",
          "respiratory",
        ])
        .optional()
        .default("unknown")
        .describe(
          "Use recommend_emergency_hospitals for hospital suitability ranking. This tool ranks generic response points.",
        ),
      priority: z
        .enum(["RECOMMEND", "TIME", "DISTANCE"])
        .optional()
        .default("TIME"),
      radiusMeters: z
        .number()
        .int()
        .min(500)
        .max(100000)
        .optional()
        .default(20000),
      source: z.enum(DATASET_SOURCE_IDS).optional().default("fire-stations"),
      useDirections: z.boolean().optional().default(true),
    },
    title: "Rank Response Points",
  },
  async (args) => {
    const incident = {
      latitude: args.latitude,
      longitude: args.longitude,
    };
    const nearest = await nearestPoints({
      ...incident,
      limit: Math.max(args.limit * 3, 10),
      radiusMeters: args.radiusMeters,
      source: args.source,
    });
    const ranked: RankedResponsePoint[] = [];

    for (const point of nearest.slice(0, 10)) {
      const route =
        args.useDirections &&
        point.latitude !== null &&
        point.longitude !== null
          ? await kakaoDirectionSummary(
              incident,
              {
                latitude: point.latitude,
                longitude: point.longitude,
              },
              args.priority,
            )
          : null;

      ranked.push({
        ...point,
        route,
        scoreBasis: isKakaoDirectionSummary(route)
          ? "kakao-route-duration"
          : "straight-line-distance",
      });
    }

    ranked.sort((a, b) => {
      const aDuration = isKakaoDirectionSummary(a.route)
        ? a.route.durationSeconds
        : undefined;
      const bDuration = isKakaoDirectionSummary(b.route)
        ? b.route.durationSeconds
        : undefined;

      if (aDuration !== undefined && bDuration !== undefined) {
        return aDuration - bDuration;
      }

      return a.distanceMeters - b.distanceMeters;
    });

    return asToolResult({
      incident: {
        ...incident,
        patientType: args.patientType,
      },
      note: "This generic tool ranks response points. Use recommend_emergency_hospitals for hospital suitability scoring.",
      points: ranked.slice(0, args.limit),
    });
  },
);

server.registerTool(
  "recommend_emergency_hospitals",
  {
    description:
      "Recommend emergency hospitals using road-time evidence when Kakao is configured and medical suitability from stored emergency institution data.",
    inputSchema: {
      latitude: z.number().min(32).max(39),
      limit: z.number().int().min(1).max(12).optional().default(8),
      longitude: z.number().min(124).max(132),
      radiusMeters: z
        .number()
        .int()
        .min(1000)
        .max(200000)
        .optional()
        .default(120000),
      scenario: z
        .enum([
          "general",
          "pediatric-respiratory",
          "cardiac",
          "stroke",
          "trauma",
          "burn",
          "delivery",
          "elderly-fall",
        ])
        .optional()
        .default("general"),
      useDirections: z.boolean().optional().default(true),
    },
    title: "Recommend Emergency Hospitals",
  },
  async (args) =>
    asToolResult({
      hospitals: await recommendEmergencyHospitalsForMcp({
        latitude: args.latitude,
        limit: args.limit,
        longitude: args.longitude,
        radiusMeters: args.radiusMeters,
        scenario: args.scenario,
        useDirections: args.useDirections,
      }),
      scenario: args.scenario,
    }),
);

const transport = new StdioServerTransport();
await server.connect(transport);
