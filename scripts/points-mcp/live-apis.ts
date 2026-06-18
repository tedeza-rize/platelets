import { runtimeApiKeys } from "./runtime.ts";

type TrafficItem = {
  createdDate?: unknown;
  roadName?: unknown;
  speed?: unknown;
};

const ITS_TRAFFIC_URL = "https://openapi.its.go.kr:9443/trafficInfo";
const FIRE_SAFETY_DATA_FAMILIES = [
  "national-ems",
  "national-ems-control",
  "fire-safety-targets",
  "multi-use-businesses",
  "national-fire-incidents",
  "119-call-reception",
  "rescue-operations",
  "fire-safety-target-detail",
  "fire-facility-detail",
] as const;

function numberValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;

  const parsed = Number(value.trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function textValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function collectTrafficItems(value: unknown, output: TrafficItem[] = []) {
  if (Array.isArray(value)) {
    for (const item of value) collectTrafficItems(item, output);
    return output;
  }

  if (!value || typeof value !== "object") return output;

  const record = value as Record<string, unknown>;
  if ("speed" in record) output.push(record);

  for (const nested of Object.values(record)) {
    if (nested && typeof nested === "object") {
      collectTrafficItems(nested, output);
    }
  }

  return output;
}

export function fireSafetyApiStatusForMcp() {
  return {
    configured: Boolean(runtimeApiKeys.fireSafetyApiKey),
    dataFamilies: Array.from(FIRE_SAFETY_DATA_FAMILIES),
    status: runtimeApiKeys.fireSafetyApiKey ? "configured" : "unconfigured",
    updatedAt: new Date().toISOString(),
  };
}

export async function itsTrafficSummaryForMcp(params: {
  latitude: number;
  longitude: number;
  radiusDegrees: number;
}) {
  if (!runtimeApiKeys.itsOpenApiKey) {
    return {
      averageSpeedKph: null,
      congestionLevel: "unknown",
      sampleCount: 0,
      status: "unconfigured",
      updatedAt: null,
    };
  }

  const radius = Math.max(0.005, Math.min(params.radiusDegrees, 0.2));
  const url = new URL(ITS_TRAFFIC_URL);
  url.searchParams.set("apiKey", runtimeApiKeys.itsOpenApiKey);
  url.searchParams.set("type", "all");
  url.searchParams.set("minX", (params.longitude - radius).toFixed(6));
  url.searchParams.set("maxX", (params.longitude + radius).toFixed(6));
  url.searchParams.set("minY", (params.latitude - radius).toFixed(6));
  url.searchParams.set("maxY", (params.latitude + radius).toFixed(6));
  url.searchParams.set("getType", "json");

  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(4500),
  });

  if (!response.ok) {
    return {
      averageSpeedKph: null,
      congestionLevel: "unknown",
      error: `ITS traffic failed with HTTP ${response.status}`,
      sampleCount: 0,
      status: "unavailable",
      updatedAt: new Date().toISOString(),
    };
  }

  const payload = (await response.json()) as unknown;
  const items = collectTrafficItems(payload)
    .map((item) => ({
      createdDate: textValue(item.createdDate),
      roadName: textValue(item.roadName),
      speed: numberValue(item.speed),
    }))
    .filter((item) => item.speed !== null && item.speed > 0);

  if (items.length === 0) {
    return {
      averageSpeedKph: null,
      congestionLevel: "unknown",
      sampleCount: 0,
      status: "unavailable",
      updatedAt: new Date().toISOString(),
    };
  }

  const averageSpeedKph =
    items.reduce((sum, item) => sum + (item.speed ?? 0), 0) / items.length;
  let congestionLevel = "smooth";
  if (averageSpeedKph < 22) {
    congestionLevel = "congested";
  } else if (averageSpeedKph < 42) {
    congestionLevel = "moderate";
  }

  return {
    averageSpeedKph: Number(averageSpeedKph.toFixed(1)),
    congestionLevel,
    roads: items
      .map((item) => item.roadName)
      .filter((value): value is string => Boolean(value))
      .slice(0, 5),
    sampleCount: items.length,
    status: "live",
    updatedAt:
      items
        .map((item) => item.createdDate)
        .filter((value): value is string => Boolean(value))
        .sort()
        .at(-1) ?? new Date().toISOString(),
  };
}
