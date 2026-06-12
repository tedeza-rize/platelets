import {
  KOREA_COORDINATE_ERROR,
  parseRequiredKoreaCoordinates,
} from "@/lib/coordinates";
import { calculateEmergencyRoute } from "@/lib/emergency-routing";
import { noStoreJson } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const limited = enforceRateLimit(request, {
    bucket: "emergency-route",
    limit: 20,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const payload = (await request.json().catch(() => null)) as {
    destination?: { latitude?: unknown; longitude?: unknown };
    origin?: { latitude?: unknown; longitude?: unknown };
    provider?: unknown;
  } | null;
  const provider = payload?.provider === "kakao" ? "kakao" : "astar";
  const origin = parseRequiredKoreaCoordinates({
    latitude: payload?.origin?.latitude,
    longitude: payload?.origin?.longitude,
  });
  const destination = parseRequiredKoreaCoordinates({
    latitude: payload?.destination?.latitude,
    longitude: payload?.destination?.longitude,
  });

  if (!origin || !destination) {
    return noStoreJson({ error: KOREA_COORDINATE_ERROR }, { status: 400 });
  }

  try {
    return noStoreJson({
      route: await calculateEmergencyRoute({ destination, origin, provider }),
    });
  } catch (error) {
    return noStoreJson(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 422 },
    );
  }
}
