import type { Coordinate } from "@/lib/disaster-response/types";

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

const ITS_TRAFFIC_URL = "https://openapi.its.go.kr:9443/trafficInfo";

function trafficApiKey() {
  return (
    process.env.ITS_OPEN_API_KEY?.trim() ||
    process.env.MOLIT_ITS_API_KEY?.trim() ||
    ""
  );
}

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

function routeBounds(origin: Coordinate, destination: Coordinate) {
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

function congestionLevel(
  averageSpeedKph: number | null,
): TrafficCongestionLevel {
  if (averageSpeedKph === null) {
    return "unknown";
  }

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

export function kakaoTrafficSummary(
  baseDurationSeconds: number,
): TrafficSummary {
  return {
    averageSpeedKph: null,
    baseDurationSeconds,
    congestionLevel: "unknown",
    durationMultiplier: 1,
    message:
      "카카오 Mobility TIME 우선 경로 결과를 실시간 도로 상황 반영 값으로 사용",
    provider: "kakao",
    sampleCount: 0,
    status: "live",
    updatedAt: new Date().toISOString(),
  };
}

export function unconfiguredTrafficSummary(
  baseDurationSeconds: number,
): TrafficSummary {
  return {
    averageSpeedKph: null,
    baseDurationSeconds,
    congestionLevel: "unknown",
    durationMultiplier: 1,
    message:
      "ITS_OPEN_API_KEY가 없어 실시간 교통 보정 없이 기준 경로 시간을 사용",
    provider: "none",
    sampleCount: 0,
    status: "unconfigured",
    updatedAt: null,
  };
}

export async function fetchItsTrafficSummary(params: {
  baseDurationSeconds: number;
  destination: Coordinate;
  distanceMeters: number;
  origin: Coordinate;
}): Promise<TrafficSummary> {
  const apiKey = trafficApiKey();

  if (!apiKey) {
    return unconfiguredTrafficSummary(params.baseDurationSeconds);
  }

  const bounds = routeBounds(params.origin, params.destination);
  const url = new URL(ITS_TRAFFIC_URL);
  url.searchParams.set("apiKey", apiKey);
  url.searchParams.set("type", "all");
  url.searchParams.set("minX", bounds.minLongitude.toFixed(6));
  url.searchParams.set("maxX", bounds.maxLongitude.toFixed(6));
  url.searchParams.set("minY", bounds.minLatitude.toFixed(6));
  url.searchParams.set("maxY", bounds.maxLatitude.toFixed(6));
  url.searchParams.set("getType", "json");

  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(4500),
    });

    if (!response.ok) {
      throw new Error(`ITS traffic request failed (${response.status}).`);
    }

    const payload = (await response.json()) as unknown;
    const items = collectTrafficItems(payload)
      .map((item) => ({
        createdDate: textValue(item.createdDate),
        roadName: textValue(item.roadName),
        speed: numberValue(item.speed),
        travelTime: numberValue(item.travelTime),
      }))
      .filter((item) => item.speed !== null && item.speed > 0);
    const sampleCount = items.length;

    if (sampleCount === 0) {
      return {
        averageSpeedKph: null,
        baseDurationSeconds: params.baseDurationSeconds,
        congestionLevel: "unknown",
        durationMultiplier: 1,
        message: "ITS 교통소통정보 응답에 사용 가능한 속도 표본이 없음",
        provider: "its",
        sampleCount,
        status: "unavailable",
        updatedAt: new Date().toISOString(),
      };
    }

    const averageSpeedKph =
      items.reduce((sum, item) => sum + (item.speed ?? 0), 0) / sampleCount;
    const durationMultiplier = multiplierFromSpeed(
      params.baseDurationSeconds,
      params.distanceMeters,
      averageSpeedKph,
    );
    const latestTimestamp =
      items
        .map((item) => item.createdDate)
        .filter((value): value is string => Boolean(value))
        .sort()
        .at(-1) ?? new Date().toISOString();
    const frequentRoads = items
      .map((item) => item.roadName)
      .filter((value): value is string => Boolean(value))
      .slice(0, 3);

    return {
      averageSpeedKph: Number(averageSpeedKph.toFixed(1)),
      baseDurationSeconds: params.baseDurationSeconds,
      congestionLevel: congestionLevel(averageSpeedKph),
      durationMultiplier: Number(durationMultiplier.toFixed(2)),
      message: `ITS 교통소통정보 ${sampleCount}개 구간 평균 ${averageSpeedKph.toFixed(
        1,
      )}km/h${frequentRoads.length ? ` (${frequentRoads.join(", ")})` : ""}`,
      provider: "its",
      sampleCount,
      status: "live",
      updatedAt: latestTimestamp,
    };
  } catch (error) {
    return {
      averageSpeedKph: null,
      baseDurationSeconds: params.baseDurationSeconds,
      congestionLevel: "unknown",
      durationMultiplier: 1,
      message: `ITS 교통소통정보를 사용할 수 없어 기준 경로 시간을 사용: ${
        error instanceof Error ? error.message : String(error)
      }`,
      provider: "its",
      sampleCount: 0,
      status: "unavailable",
      updatedAt: new Date().toISOString(),
    };
  }
}
