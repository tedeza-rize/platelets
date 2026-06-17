import fs from "node:fs/promises";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod/v4";
import { ASSEMBLY_SOURCE_IDS, DATASET_SOURCE_IDS } from "./constants.ts";
import {
  isKakaoDirectionSummary,
  kakaoDirectionSummary,
  kakaoLocalCoordinate,
  vworldAddressCoordinate,
  vworldReverseCoordinate,
  vworldSearchLocations,
} from "./geocoding.ts";
import { registerLiveApiTools } from "./live-api-tools.ts";
import {
  datasetStatuses,
  listAssemblyProtestsForMcp,
  listPointSummaries,
  nearestPoints,
  searchPointSummaries,
} from "./points.ts";
import { recommendEmergencyHospitalsForMcp } from "./recommendations.ts";
import { forecastDocPath } from "./runtime.ts";
import { asToolResult } from "./tool-result.ts";
import type { PointBounds, RankedResponsePoint } from "./types.ts";

const sourceSchema = z
  .enum(DATASET_SOURCE_IDS)
  .optional()
  .describe("Dataset source id. Defaults vary by tool.");
export function registerPointsMcpTools(server: McpServer) {
  registerResources(server);
  registerDatasetTools(server);
  registerGeocodingTools(server);
  registerAssemblyTools(server);
  registerLiveApiTools(server);
  registerPointTools(server);
  registerResponseRankingTool(server);
  registerHospitalRecommendationTool(server);
}

function registerResources(server: McpServer) {
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
}

function registerDatasetTools(server: McpServer) {
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
}

function registerGeocodingTools(server: McpServer) {
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
}

function registerAssemblyTools(server: McpServer) {
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
}

function registerPointTools(server: McpServer) {
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
}

function registerResponseRankingTool(server: McpServer) {
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
}

function registerHospitalRecommendationTool(server: McpServer) {
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
}
