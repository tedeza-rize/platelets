import {
  type MapGeocodingProvider,
  type MapSearchMode,
  searchMapLocations,
} from "@/lib/geocoding";
import { noStoreJson } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PROVIDERS = new Set<MapGeocodingProvider>(["auto", "kakao", "vworld"]);
const SEARCH_MODES = new Set<MapSearchMode>(["address", "both", "keyword"]);

function boundedLimit(value: unknown) {
  const parsed = Number(value ?? 5);
  return Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), 20) : null;
}

function provider(value: unknown): MapGeocodingProvider {
  return PROVIDERS.has(value as MapGeocodingProvider)
    ? (value as MapGeocodingProvider)
    : "auto";
}

function searchMode(value: unknown): MapSearchMode {
  return SEARCH_MODES.has(value as MapSearchMode)
    ? (value as MapSearchMode)
    : "both";
}

export async function GET(request: Request) {
  const limited = enforceRateLimit(request, {
    bucket: "geocoding-search",
    limit: 60,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const url = new URL(request.url);
  const query = (url.searchParams.get("query") ?? "").trim().slice(0, 160);
  const limit = boundedLimit(url.searchParams.get("limit"));

  if (!query) {
    return noStoreJson({ error: "Query is required." }, { status: 400 });
  }

  if (limit === null) {
    return noStoreJson({ error: "Invalid limit." }, { status: 400 });
  }

  const results = await searchMapLocations({
    action: "api:geocoding-search",
    limit,
    provider: provider(url.searchParams.get("provider")),
    query,
    searchMode: searchMode(url.searchParams.get("mode")),
  });

  return noStoreJson({ query, results });
}
