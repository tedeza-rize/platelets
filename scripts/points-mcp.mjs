#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import sqlite3 from "sqlite3";
import { z } from "zod/v4";

const DATASET_SOURCE_IDS = ["fire-stations", "police-stations", "aeds"];
const DATASET_SOURCES = {
  aeds: {
    label: "AED",
    type: "aed",
  },
  "fire-stations": {
    label: "소방서/119안전센터",
    type: "fire",
  },
  "police-stations": {
    label: "경찰서/지구대/파출소",
    type: "police",
  },
};
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
const databasePath = path.join(projectRoot, "data", "points.sqlite");
const forecastDocPath = path.join(
  projectRoot,
  "docs",
  "AI_FORECAST_AND_RESPONSE.md",
);

function getDatabase() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(
      databasePath,
      sqlite3.OPEN_READONLY,
      (error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(db);
      },
    );
  });
}

function all(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (error, rows) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(rows);
    });
  });
}

function closeDatabase(db) {
  return new Promise((resolve, reject) => {
    db.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

async function withDatabase(callback) {
  const db = await getDatabase();

  try {
    return await callback(db);
  } finally {
    await closeDatabase(db);
  }
}

function clamp(value, min, max) {
  return Math.min(Math.max(Math.trunc(value), min), max);
}

function pointFromRow(row) {
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

function buildPointWhere(options) {
  const conditions = [];
  const params = [];

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

async function listPointSummaries(options = {}) {
  const limit = clamp(options.limit ?? 100, 1, 1_000);
  const { params, where } = buildPointWhere(options);

  return withDatabase(async (db) => {
    const rows = await all(
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

async function datasetStatuses() {
  return withDatabase(async (db) => {
    const rows = await all(
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

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function distanceMeters(from, to) {
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

async function nearestPoints(options) {
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
    .slice(0, clamp(options.limit ?? 10, 1, 50));
}

function kakaoRestApiKey() {
  return (
    process.env.KAKAO_REST_API_KEY?.trim() ??
    process.env.KAKAO_LOCAL_REST_API_KEY?.trim() ??
    null
  );
}

async function kakaoDirectionSummary(origin, destination, priority) {
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

  const payload = await response.json();
  const route = payload.routes?.[0];

  if (!route || route.result_code !== 0) {
    return {
      error: route?.result_msg ?? "Kakao directions returned no route",
      resultCode: route?.result_code ?? null,
    };
  }

  return {
    distanceMeters: route.summary.distance,
    durationSeconds: route.summary.duration,
    fare: route.summary.fare,
    priority: route.summary.priority,
  };
}

function asToolResult(payload) {
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

    if (
      hasAnyBound &&
      [
        args.minLatitude,
        args.maxLatitude,
        args.minLongitude,
        args.maxLongitude,
      ].some((value) => value === undefined)
    ) {
      return asToolResult({
        error: "Provide all four bounding box values or none.",
      });
    }

    return asToolResult({
      points: await listPointSummaries({
        bounds: hasAnyBound
          ? {
              maxLatitude: args.maxLatitude,
              maxLongitude: args.maxLongitude,
              minLatitude: args.minLatitude,
              minLongitude: args.minLongitude,
            }
          : undefined,
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
      "Rank nearby response points for an incident. If KAKAO_REST_API_KEY is set, route duration is used; otherwise straight-line distance is used.",
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
          "Hospital capability ranking is future work until ER/hospital capacity data is ingested.",
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
    const ranked = [];

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
        scoreBasis: route?.durationSeconds
          ? "kakao-route-duration"
          : "straight-line-distance",
      });
    }

    ranked.sort((a, b) => {
      const aDuration = a.route?.durationSeconds;
      const bDuration = b.route?.durationSeconds;

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
      note: "Hospital/ER suitability needs a hospital capability dataset. Current ranking covers existing response points only.",
      points: ranked.slice(0, args.limit),
    });
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
