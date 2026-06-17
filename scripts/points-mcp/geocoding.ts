import { clamp, isWithinKoreaCoordinates } from "./points.ts";
import { runtimeApiKeys } from "./runtime.ts";
import type {
  Coordinate,
  KakaoDirectionResult,
  KakaoDirectionSummary,
  KakaoDirectionsResponse,
  KakaoLocalSearchKind,
  KakaoLocalSearchResponse,
  VworldAddressResponse,
  VworldSearchMode,
  VworldSearchResponse,
  VworldSearchResult,
} from "./types.ts";

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

export async function kakaoLocalCoordinate(params: {
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

export async function vworldAddressCoordinate(params: {
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

export async function vworldSearchLocations(params: {
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

export async function vworldReverseCoordinate(params: {
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

export function isKakaoDirectionSummary(
  route: KakaoDirectionResult,
): route is KakaoDirectionSummary {
  return route !== null && !("error" in route);
}

export async function kakaoDirectionSummary(
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
