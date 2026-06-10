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
  const origin = {
    latitude: Number(payload?.origin?.latitude),
    longitude: Number(payload?.origin?.longitude),
  };
  const destination = {
    latitude: Number(payload?.destination?.latitude),
    longitude: Number(payload?.destination?.longitude),
  };

  if (
    [origin, destination].some(
      (coordinate) =>
        coordinate.latitude < 32 ||
        coordinate.latitude > 39 ||
        coordinate.longitude < 124 ||
        coordinate.longitude > 132,
    )
  ) {
    return noStoreJson(
      { error: "현재 이송 경로는 대한민국 영역만 지원합니다." },
      { status: 400 },
    );
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
