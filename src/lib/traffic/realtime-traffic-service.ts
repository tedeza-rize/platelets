import type { Coordinate } from "@/lib/disaster-response/types";
import { getIntegrationSettings } from "@/lib/integration-settings";

export type TrafficCongestionLevel =
  | "congested"
  | "moderate"
  | "smooth"
  | "unknown";

export type TrafficSummary = {
  averageSpeedKph: number | null;
  baseDurationSeconds: number | null;
  congestionLevel: TrafficCongestionLevel;
  durationMultiplier: number;
  message: string;
  provider: "its" | "kakao" | "none";
  sampleCount: number;
  status: "live" | "unavailable" | "unconfigured";
  updatedAt: string | null;
};

type TrafficItem = {
  createdDate?: unknown;
  roadName?: unknown;
  speed?: unknown;
  travelTime?: unknown;
};

type NormalizedTrafficItem = {
  createdDate: string | null;
  roadName: string | null;
  speed: number | null;
  travelTime: number | null;
};

type TrafficBounds = {
  maxLatitude: number;
  maxLongitude: number;
  minLatitude: number;
  minLongitude: number;
};

const ITS_TRAFFIC_URL = "https://openapi.its.go.kr:9443/trafficInfo";
const DEFAULT_AREA_RADIUS_DEGREES = 0.035;

function numberValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function textValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function collectTrafficItems(value: unknown, output: TrafficItem[] = []) {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectTrafficItems(item, output);
    }
    return output;
  }

  if (!value || typeof value !== "object") {
    return output;
  }

  const record = value as Record<string, unknown>;

  if ("speed" in record || "travelTime" in record) {
    output.push(record);
  }

  for (const nested of Object.values(record)) {
    if (nested && typeof nested === "object") {
      collectTrafficItems(nested, output);
    }
  }

  return output;
}

function routeBounds(
  origin: Coordinate,
  destination: Coordinate,
): TrafficBounds {
  const minLatitude = Math.min(origin.latitude, destination.latitude);
  const maxLatitude = Math.max(origin.latitude, destination.latitude);
  const minLongitude = Math.min(origin.longitude, destination.longitude);
  const maxLongitude = Math.max(origin.longitude, destination.longitude);
  const latitudePadding = Math.max(0.015, (maxLatitude - minLatitude) * 0.35);
  const longitudePadding = Math.max(
    0.015,
    (maxLongitude - minLongitude) * 0.35,
  );

  return {
    maxLatitude: Math.min(39, maxLatitude + latitudePadding),
    maxLongitude: Math.min(132, maxLongitude + longitudePadding),
    minLatitude: Math.max(32, minLatitude - latitudePadding),
    minLongitude: Math.max(124, minLongitude - longitudePadding),
  };
}

function areaBounds(params: {
  latitude: number;
  longitude: number;
  radiusDegrees?: number;
}): TrafficBounds {
  const radius = Math.max(
    0.005,
    Math.min(params.radiusDegrees ?? DEFAULT_AREA_RADIUS_DEGREES, 0.2),
  );

  return {
    maxLatitude: Math.min(39, params.latitude + radius),
    maxLongitude: Math.min(132, params.longitude + radius),
    minLatitude: Math.max(32, params.latitude - radius),
    minLongitude: Math.max(124, params.longitude - radius),
  };
}

function congestionLevel(averageSpeedKph: number): TrafficCongestionLevel {
  if (averageSpeedKph < 22) {
    return "congested";
  }

  if (averageSpeedKph < 42) {
    return "moderate";
  }

  return "smooth";
}

function multiplierFromSpeed(
  baseDurationSeconds: number,
  distanceMeters: number,
  averageSpeedKph: number | null,
) {
  if (!averageSpeedKph || baseDurationSeconds <= 0 || distanceMeters <= 0) {
    return 1;
  }

  const baseSpeedKph = (distanceMeters / baseDurationSeconds) * 3.6;
  const expectedSpeedKph = Math.max(18, Math.min(72, baseSpeedKph));

  return Math.max(0.75, Math.min(2.35, expectedSpeedKph / averageSpeedKph));
}

function buildItsTrafficUrl(apiKey: string, bounds: TrafficBounds) {
  const url = new URL(ITS_TRAFFIC_URL);

  url.searchParams.set("apiKey", apiKey);
  url.searchParams.set("type", "all");
  url.searchParams.set("minX", bounds.minLongitude.toFixed(6));
  url.searchParams.set("maxX", bounds.maxLongitude.toFixed(6));
  url.searchParams.set("minY", bounds.minLatitude.toFixed(6));
  url.searchParams.set("maxY", bounds.maxLatitude.toFixed(6));
  url.searchParams.set("getType", "json");

  return url;
}

async function fetchItsTrafficItems(bounds: TrafficBounds) {
  const { itsOpenApiKey: apiKey } = await getIntegrationSettings();

  if (!apiKey) {
    return null;
  }

  const response = await fetch(buildItsTrafficUrl(apiKey, bounds), {
    cache: "no-store",
    signal: AbortSignal.timeout(4500),
  });

  if (!response.ok) {
    throw new Error(`ITS traffic request failed (${response.status}).`);
  }

  const payload = (await response.json()) as unknown;

  return collectTrafficItems(payload)
    .map(
      (item): NormalizedTrafficItem => ({
        createdDate: textValue(item.createdDate),
        roadName: textValue(item.roadName),
        speed: numberValue(item.speed),
        travelTime: numberValue(item.travelTime),
      }),
    )
    .filter((item) => item.speed !== null && item.speed > 0);
}

function summarizeItems(params: {
  baseDurationSeconds: number | null;
  distanceMeters?: number;
  items: NormalizedTrafficItem[];
}) {
  const sampleCount = params.items.length;

  if (sampleCount === 0) {
    return {
      averageSpeedKph: null,
      congestionLevel: "unknown" as const,
      durationMultiplier: 1,
      frequentRoads: [] as string[],
      latestTimestamp: new Date().toISOString(),
      sampleCount,
    };
  }

  const averageSpeedKph =
    params.items.reduce((sum, item) => sum + (item.speed ?? 0), 0) /
    sampleCount;
  const durationMultiplier =
    params.baseDurationSeconds !== null && params.distanceMeters
      ? multiplierFromSpeed(
          params.baseDurationSeconds,
          params.distanceMeters,
          averageSpeedKph,
        )
      : 1;
  const latestTimestamp =
    params.items
      .map((item) => item.createdDate)
      .filter((value): value is string => Boolean(value))
      .sort()
      .at(-1) ?? new Date().toISOString();
  const frequentRoads = params.items
    .map((item) => item.roadName)
    .filter((value): value is string => Boolean(value))
    .slice(0, 3);

  return {
    averageSpeedKph,
    congestionLevel: congestionLevel(averageSpeedKph),
    durationMultiplier,
    frequentRoads,
    latestTimestamp,
    sampleCount,
  };
}

function liveTrafficSummary(params: {
  baseDurationSeconds: number | null;
  durationMultiplier: number;
  frequentRoads: string[];
  speed: number;
  sampleCount: number;
  updatedAt: string;
}): TrafficSummary {
  return {
    averageSpeedKph: Number(params.speed.toFixed(1)),
    baseDurationSeconds: params.baseDurationSeconds,
    congestionLevel: congestionLevel(params.speed),
    durationMultiplier: Number(params.durationMultiplier.toFixed(2)),
    message: `ITS traffic ${params.sampleCount} samples average ${params.speed.toFixed(
      1,
    )}km/h${
      params.frequentRoads.length > 0
        ? ` (${params.frequentRoads.join(", ")})`
        : ""
    }`,
    provider: "its",
    sampleCount: params.sampleCount,
    status: "live",
    updatedAt: params.updatedAt,
  };
}

export function kakaoTrafficSummary(
  baseDurationSeconds: number,
): TrafficSummary {
  return {
    averageSpeedKph: null,
    baseDurationSeconds,
    congestionLevel: "unknown",
    durationMultiplier: 1,
    message: "Kakao Mobility route duration already reflects live traffic.",
    provider: "kakao",
    sampleCount: 0,
    status: "live",
    updatedAt: new Date().toISOString(),
  };
}

export function unconfiguredTrafficSummary(
  baseDurationSeconds: number | null,
): TrafficSummary {
  return {
    averageSpeedKph: null,
    baseDurationSeconds,
    congestionLevel: "unknown",
    durationMultiplier: 1,
    message: "ITS traffic API key is not configured.",
    provider: "none",
    sampleCount: 0,
    status: "unconfigured",
    updatedAt: null,
  };
}

export async function fetchItsTrafficAreaSummary(params: {
  latitude: number;
  longitude: number;
  radiusDegrees?: number;
}): Promise<TrafficSummary> {
  try {
    const items = await fetchItsTrafficItems(areaBounds(params));

    if (items === null) {
      return unconfiguredTrafficSummary(null);
    }

    const summary = summarizeItems({ baseDurationSeconds: null, items });

    if (summary.averageSpeedKph === null) {
      return {
        averageSpeedKph: null,
        baseDurationSeconds: null,
        congestionLevel: "unknown",
        durationMultiplier: 1,
        message: "ITS traffic responded with no usable speed samples.",
        provider: "its",
        sampleCount: 0,
        status: "unavailable",
        updatedAt: summary.latestTimestamp,
      };
    }

    return liveTrafficSummary({
      baseDurationSeconds: null,
      durationMultiplier: summary.durationMultiplier,
      frequentRoads: summary.frequentRoads,
      sampleCount: summary.sampleCount,
      speed: summary.averageSpeedKph,
      updatedAt: summary.latestTimestamp,
    });
  } catch (error) {
    return {
      averageSpeedKph: null,
      baseDurationSeconds: null,
      congestionLevel: "unknown",
      durationMultiplier: 1,
      message: `ITS traffic unavailable: ${
        error instanceof Error ? error.message : String(error)
      }`,
      provider: "its",
      sampleCount: 0,
      status: "unavailable",
      updatedAt: new Date().toISOString(),
    };
  }
}

export async function fetchItsTrafficSummary(params: {
  baseDurationSeconds: number;
  destination: Coordinate;
  distanceMeters: number;
  origin: Coordinate;
}): Promise<TrafficSummary> {
  try {
    const items = await fetchItsTrafficItems(
      routeBounds(params.origin, params.destination),
    );

    if (items === null) {
      return unconfiguredTrafficSummary(params.baseDurationSeconds);
    }

    const summary = summarizeItems({
      baseDurationSeconds: params.baseDurationSeconds,
      distanceMeters: params.distanceMeters,
      items,
    });

    if (summary.averageSpeedKph === null) {
      return {
        averageSpeedKph: null,
        baseDurationSeconds: params.baseDurationSeconds,
        congestionLevel: "unknown",
        durationMultiplier: 1,
        message: "ITS traffic responded with no usable speed samples.",
        provider: "its",
        sampleCount: 0,
        status: "unavailable",
        updatedAt: summary.latestTimestamp,
      };
    }

    return liveTrafficSummary({
      baseDurationSeconds: params.baseDurationSeconds,
      durationMultiplier: summary.durationMultiplier,
      frequentRoads: summary.frequentRoads,
      sampleCount: summary.sampleCount,
      speed: summary.averageSpeedKph,
      updatedAt: summary.latestTimestamp,
    });
  } catch (error) {
    return {
      averageSpeedKph: null,
      baseDurationSeconds: params.baseDurationSeconds,
      congestionLevel: "unknown",
      durationMultiplier: 1,
      message: `ITS traffic unavailable; using base route duration: ${
        error instanceof Error ? error.message : String(error)
      }`,
      provider: "its",
      sampleCount: 0,
      status: "unavailable",
      updatedAt: new Date().toISOString(),
    };
  }
}
