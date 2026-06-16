import {
  KOREA_COORDINATE_ERROR,
  parseRequiredKoreaCoordinates,
} from "@/lib/coordinates";
import { noStoreJson } from "@/lib/http";
import { enforceSharedRateLimit } from "@/lib/rate-limit";
import { reverseVworldCoordinates } from "@/lib/vworld-geocoding";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const limited = await enforceSharedRateLimit(request, {
    bucket: "geocoding-reverse",
    limit: 60,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const url = new URL(request.url);
  const coordinates = parseRequiredKoreaCoordinates({
    latitude: url.searchParams.get("latitude"),
    longitude: url.searchParams.get("longitude"),
  });

  if (!coordinates) {
    return noStoreJson(
      { errorCode: "invalid_coordinates", error: KOREA_COORDINATE_ERROR },
      { status: 400 },
    );
  }

  const reverse = await reverseVworldCoordinates({
    action: "api:geocoding-reverse",
    coordinates,
  });

  if (reverse.error || !reverse.result) {
    return noStoreJson(
      {
        addresses: [],
        errorCode: reverse.error ?? "address_unavailable",
      },
      { status: reverse.error === "vworld-api-key-missing" ? 503 : 422 },
    );
  }

  return noStoreJson(reverse.result);
}
