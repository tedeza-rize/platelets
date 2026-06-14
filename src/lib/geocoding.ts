import {
  type CoordinatePair,
  isWithinKoreaCoordinates,
} from "@/lib/coordinates";
import { consumeKakaoLocalQuota, recordApiLog } from "@/lib/points-db";
import { getRuntimeApiKeys } from "@/lib/runtime-config";
import {
  searchVworldAddressCoordinates,
  searchVworldLocations,
} from "@/lib/vworld-geocoding";

export {
  reverseVworldCoordinates,
  searchVworldAddressCoordinates,
  searchVworldLocations,
} from "@/lib/vworld-geocoding";

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
    is_end?: boolean;
    pageable_count?: number;
    total_count?: number;
  };
};

export type KakaoLocalSearchKind = "address" | "keyword";

export type MapGeocodingProvider = "auto" | "kakao" | "vworld";
export type MapSearchMode = "address" | "both" | "keyword";
export type MapGeocodingSource =
  | "kakao-local-address"
  | "kakao-local-keyword"
  | "vworld-address-parcel"
  | "vworld-address-road"
  | "vworld-search-address-parcel"
  | "vworld-search-address-road"
  | "vworld-search-district"
  | "vworld-search-place";

export type MapCoordinateResult = CoordinatePair & {
  matchedAddress: string | null;
  query: string;
  source: MapGeocodingSource;
};

export type KakaoLocalCoordinateResult = MapCoordinateResult & {
  source: "kakao-local-address" | "kakao-local-keyword";
};

export type MapSearchResult = MapCoordinateResult & {
  title: string | null;
};

async function getKakaoRestApiKey() {
  const { kakaoRestApiKey } = await getRuntimeApiKeys();
  return kakaoRestApiKey || null;
}

function kakaoLocalEndpoint(kind: KakaoLocalSearchKind) {
  return kind === "address"
    ? "https://dapi.kakao.com/v2/local/search/address.json"
    : "https://dapi.kakao.com/v2/local/search/keyword.json";
}

function resultSource(kind: KakaoLocalSearchKind) {
  return kind === "address" ? "kakao-local-address" : "kakao-local-keyword";
}

function isQuotaExceededError(error: unknown) {
  return (
    error instanceof Error &&
    error.message.toLowerCase().includes("quota exceeded")
  );
}

export async function searchKakaoLocalCoordinates(params: {
  action?: string;
  kind?: KakaoLocalSearchKind;
  query: string;
}): Promise<KakaoLocalCoordinateResult | null> {
  const query = params.query.trim();
  const kind = params.kind ?? "address";
  const action = params.action ?? "geocode";
  const restApiKey = await getKakaoRestApiKey();

  if (!query) return null;

  if (!restApiKey) {
    await recordApiLog({
      action,
      category: "geocoding",
      level: "warn",
      message: "Kakao Local geocoding skipped because REST API key is missing.",
      metadata: { query, searchKind: kind },
      status: "skipped",
    });
    return null;
  }

  await consumeKakaoLocalQuota();

  const url = new URL(kakaoLocalEndpoint(kind));
  url.searchParams.set("query", query);
  url.searchParams.set("size", "1");

  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: {
        Accept: "application/json",
        Authorization: `KakaoAK ${restApiKey}`,
      },
    });

    if (!response.ok) {
      await recordApiLog({
        action,
        category: "geocoding",
        level: "error",
        message: `Kakao Local geocoding failed with HTTP ${response.status}.`,
        metadata: {
          kakaoHint:
            response.status === 401 || response.status === 403
              ? "Check KAKAO_REST_API_KEY and Kakao Map/Local API activation for the app."
              : null,
          query,
          searchKind: kind,
          statusCode: response.status,
          usedHeaders: ["Authorization: KakaoAK"],
        },
        requestCount: 1,
        status: "failure",
      });
      return null;
    }

    const payload = (await response.json()) as KakaoLocalSearchResponse;
    const first = payload.documents?.[0];
    const longitude = Number(first?.x);
    const latitude = Number(first?.y);
    const coordinates = { latitude, longitude };

    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      !isWithinKoreaCoordinates(coordinates)
    ) {
      await recordApiLog({
        action,
        category: "geocoding",
        level: "warn",
        message: "Kakao Local geocoding returned no coordinate result.",
        metadata: {
          errorMessage: payload.message,
          errorType: payload.errorType,
          query,
          searchKind: kind,
          totalCount: payload.meta?.total_count,
        },
        requestCount: 1,
        status: "skipped",
      });
      return null;
    }

    const matchedAddress =
      first?.road_address?.address_name ??
      first?.address?.address_name ??
      first?.address_name ??
      first?.place_name ??
      null;

    await recordApiLog({
      action,
      category: "geocoding",
      level: "info",
      message: "Kakao Local geocoding returned a coordinate result.",
      metadata: {
        latitude,
        longitude,
        matchedAddress,
        query,
        searchKind: kind,
      },
      requestCount: 1,
      status: "success",
    });

    return {
      latitude,
      longitude,
      matchedAddress,
      query,
      source: resultSource(kind),
    };
  } catch (error) {
    await recordApiLog({
      action,
      category: "geocoding",
      level: "error",
      message: error instanceof Error ? error.message : String(error),
      metadata: { query, searchKind: kind },
      requestCount: 1,
      status: "failure",
    });
    throw error;
  }
}

export async function searchMapCoordinates(params: {
  action?: string;
  kind?: KakaoLocalSearchKind;
  provider?: MapGeocodingProvider;
  query: string;
}): Promise<MapCoordinateResult | null> {
  const provider = params.provider ?? "auto";
  const kind = params.kind ?? "address";

  if (provider === "kakao") {
    return searchKakaoLocalCoordinates({ ...params, kind });
  }

  if (provider === "vworld") {
    return searchVworldAddressCoordinates({
      action: params.action,
      query: params.query,
      type: kind === "address" ? "road" : "parcel",
    });
  }

  try {
    const kakao = await searchKakaoLocalCoordinates({ ...params, kind });
    if (kakao) return kakao;
  } catch (error) {
    if (!isQuotaExceededError(error)) throw error;

    await recordApiLog({
      action: params.action ?? "geocode",
      category: "geocoding",
      level: "warn",
      message:
        "Kakao Local daily quota exceeded; falling back to VWorld geocoding.",
      metadata: { query: params.query.trim(), searchKind: kind },
      status: "skipped",
    });
  }

  return searchVworldAddressCoordinates({
    action: params.action,
    query: params.query,
    type: kind === "address" ? "road" : "parcel",
  });
}

export async function searchMapLocations(params: {
  action?: string;
  limit?: number;
  provider?: MapGeocodingProvider;
  query: string;
  searchMode?: MapSearchMode;
}): Promise<MapSearchResult[]> {
  const provider = params.provider ?? "auto";
  const searchMode = params.searchMode ?? "both";
  const limit = Math.min(Math.max(params.limit ?? 5, 1), 20);
  const results: MapSearchResult[] = [];

  if (provider !== "vworld") {
    const kinds: KakaoLocalSearchKind[] =
      searchMode === "both" ? ["keyword", "address"] : [searchMode];

    for (const kind of kinds) {
      try {
        const result = await searchKakaoLocalCoordinates({
          action: params.action ?? "map-search",
          kind,
          query: params.query,
        });
        if (result) {
          results.push({ ...result, title: result.matchedAddress });
        }
      } catch (error) {
        if (!isQuotaExceededError(error) || provider === "kakao") {
          throw error;
        }
        break;
      }

      if (provider === "kakao" || results.length >= limit) {
        return results.slice(0, limit);
      }
    }
  }

  if (provider === "kakao") {
    return results.slice(0, limit);
  }

  const vworldResults = await searchVworldLocations({
    action: params.action,
    limit: limit - results.length,
    query: params.query,
    searchMode,
  });

  return [...results, ...vworldResults].slice(0, limit);
}

export async function geocodeAddress(address: string) {
  return searchMapCoordinates({ kind: "address", query: address });
}
