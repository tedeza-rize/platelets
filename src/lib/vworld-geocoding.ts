import {
  type CoordinatePair,
  isWithinKoreaCoordinates,
} from "@/lib/coordinates";
import type {
  MapCoordinateResult,
  MapGeocodingSource,
  MapSearchMode,
  MapSearchResult,
} from "@/lib/geocoding";
import { recordApiLog } from "@/lib/points-db";
import { getRuntimeApiKeys } from "@/lib/runtime-config";

type VworldAddressType = "parcel" | "road";

type VworldSearchRequest = {
  category?: string;
  source: MapGeocodingSource;
  type: "address" | "district" | "place";
};

type VworldAddressResponse = {
  response?: {
    error?: {
      code?: string;
      text?: string;
    };
    refined?: {
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

async function getVworldApiKey() {
  const { vworldApiKey } = await getRuntimeApiKeys();
  return vworldApiKey || null;
}

function numberCoordinate(point: { x?: string; y?: string } | undefined) {
  const longitude = Number(point?.x);
  const latitude = Number(point?.y);
  const coordinates = { latitude, longitude };

  return Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    isWithinKoreaCoordinates(coordinates)
    ? coordinates
    : null;
}

function vworldAddressSource(type: VworldAddressType): MapGeocodingSource {
  return type === "road" ? "vworld-address-road" : "vworld-address-parcel";
}

function vworldSearchRequests(
  searchMode: MapSearchMode,
): VworldSearchRequest[] {
  const addressRequests: VworldSearchRequest[] = [
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
  ];

  if (searchMode === "address") return addressRequests;

  return [
    { source: "vworld-search-place", type: "place" },
    ...addressRequests,
    { category: "L4", source: "vworld-search-district", type: "district" },
  ];
}

function vworldAddressText(item: {
  address?: { parcel?: string; road?: string };
  title?: string;
}) {
  return item.address?.road ?? item.address?.parcel ?? item.title ?? null;
}

export async function searchVworldAddressCoordinates(params: {
  action?: string;
  query: string;
  type?: VworldAddressType;
}): Promise<MapCoordinateResult | null> {
  const query = params.query.replace(/"/g, "").trim();
  const type = params.type ?? "road";
  const action = params.action ?? "geocode";
  const apiKey = await getVworldApiKey();

  if (!query) return null;

  if (!apiKey) {
    await recordApiLog({
      action,
      category: "geocoding",
      level: "warn",
      message: "VWorld geocoding skipped because API key is missing.",
      metadata: { query, searchKind: type },
      status: "skipped",
    });
    return null;
  }

  const url = new URL("https://api.vworld.kr/req/address");
  url.searchParams.set("service", "address");
  url.searchParams.set("request", "getCoord");
  url.searchParams.set("version", "2.0");
  url.searchParams.set("crs", "EPSG:4326");
  url.searchParams.set("format", "json");
  url.searchParams.set("errorformat", "json");
  url.searchParams.set("type", type);
  url.searchParams.set("address", query);
  url.searchParams.set("key", apiKey);

  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      await recordApiLog({
        action,
        category: "geocoding",
        level: "error",
        message: `VWorld geocoding failed with HTTP ${response.status}.`,
        metadata: { query, searchKind: type, statusCode: response.status },
        requestCount: 1,
        status: "failure",
      });
      return null;
    }

    const payload = (await response.json()) as VworldAddressResponse;
    const coordinates = numberCoordinate(
      Array.isArray(payload.response?.result)
        ? undefined
        : payload.response?.result?.point,
    );

    if (!coordinates || payload.response?.status !== "OK") {
      await recordApiLog({
        action,
        category: "geocoding",
        level: payload.response?.status === "ERROR" ? "error" : "warn",
        message: "VWorld geocoding returned no coordinate result.",
        metadata: {
          errorCode: payload.response?.error?.code,
          errorText: payload.response?.error?.text,
          query,
          searchKind: type,
          status: payload.response?.status,
        },
        requestCount: 1,
        status: payload.response?.status === "ERROR" ? "failure" : "skipped",
      });
      return null;
    }

    const matchedAddress = payload.response.refined?.text ?? query;
    await recordApiLog({
      action,
      category: "geocoding",
      level: "info",
      message: "VWorld geocoding returned a coordinate result.",
      metadata: {
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
        matchedAddress,
        query,
        searchKind: type,
      },
      requestCount: 1,
      status: "success",
    });

    return {
      ...coordinates,
      matchedAddress,
      query,
      source: vworldAddressSource(type),
    };
  } catch (error) {
    await recordApiLog({
      action,
      category: "geocoding",
      level: "error",
      message: error instanceof Error ? error.message : String(error),
      metadata: { query, searchKind: type },
      requestCount: 1,
      status: "failure",
    });
    throw error;
  }
}

export async function reverseVworldCoordinates(params: {
  action?: string;
  coordinates: CoordinatePair;
  type?: "both" | VworldAddressType;
}) {
  const action = params.action ?? "reverse-geocode";
  const apiKey = await getVworldApiKey();
  const type = params.type ?? "both";
  const coordinates = params.coordinates;

  if (!apiKey) {
    return { error: "vworld-api-key-missing", result: null };
  }

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
  url.searchParams.set("type", type);
  url.searchParams.set(
    "point",
    `${coordinates.longitude},${coordinates.latitude}`,
  );
  url.searchParams.set("key", apiKey);

  const response = await fetch(url, {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    await recordApiLog({
      action,
      category: "geocoding",
      level: "error",
      message: `VWorld reverse geocoding failed with HTTP ${response.status}.`,
      metadata: { statusCode: response.status, type },
      requestCount: 1,
      status: "failure",
    });

    return {
      error: `VWorld failed with HTTP ${response.status}`,
      result: null,
    };
  }

  const payload = (await response.json()) as VworldAddressResponse;
  const result = Array.isArray(payload.response?.result)
    ? payload.response.result
        .map((entry) => entry.text?.trim())
        .filter((value): value is string => Boolean(value))
    : [];

  if (payload.response?.status !== "OK" || result.length === 0) {
    return {
      error:
        payload.response?.error?.text ??
        payload.response?.status ??
        "no-address-result",
      result: null,
    };
  }

  await recordApiLog({
    action,
    category: "geocoding",
    level: "info",
    message: "VWorld reverse geocoding returned address results.",
    metadata: { resultCount: result.length, type },
    requestCount: 1,
    status: "success",
  });

  return {
    error: null,
    result: {
      addresses: result.slice(0, 5),
      coordinates,
      provider: "vworld",
    },
  };
}

export async function searchVworldLocations(params: {
  action?: string;
  limit?: number;
  query: string;
  searchMode?: MapSearchMode;
}): Promise<MapSearchResult[]> {
  const query = params.query.replace(/"/g, "").trim();
  const action = params.action ?? "map-search";
  const apiKey = await getVworldApiKey();
  const limit = Math.min(Math.max(params.limit ?? 5, 1), 20);
  const searchMode = params.searchMode ?? "both";

  if (!(query && apiKey)) return [];

  const results: MapSearchResult[] = [];
  const seen = new Set<string>();

  for (const request of vworldSearchRequests(searchMode)) {
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
      cache: "no-store",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      await recordApiLog({
        action,
        category: "geocoding",
        level: "error",
        message: `VWorld search failed with HTTP ${response.status}.`,
        metadata: { query, searchType: request.type },
        requestCount: 1,
        status: "failure",
      });
      continue;
    }

    const payload = (await response.json()) as VworldSearchResponse;
    const items = payload.response?.result?.items ?? [];

    for (const item of items) {
      const coordinates = numberCoordinate(item.point);
      if (!coordinates) continue;

      const matchedAddress = vworldAddressText(item);
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

  await recordApiLog({
    action,
    category: "geocoding",
    level: results.length > 0 ? "info" : "warn",
    message:
      results.length > 0
        ? "VWorld search returned map results."
        : "VWorld search returned no map results.",
    metadata: { query, resultCount: results.length, searchMode },
    requestCount: results.length > 0 ? 1 : 0,
    status: results.length > 0 ? "success" : "skipped",
  });

  return results;
}
