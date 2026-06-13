import {
  type CoordinatePair,
  isWithinKoreaCoordinates,
} from "@/lib/coordinates";
import { consumeKakaoLocalQuota, recordApiLog } from "@/lib/points-db";
import { getRuntimeApiKeys } from "@/lib/runtime-config";

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

export type KakaoLocalCoordinateResult = CoordinatePair & {
  matchedAddress: string | null;
  query: string;
  source: "kakao-local-address" | "kakao-local-keyword";
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

export async function geocodeAddress(address: string) {
  return searchKakaoLocalCoordinates({ kind: "address", query: address });
}
