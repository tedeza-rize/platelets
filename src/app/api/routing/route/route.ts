import { calculateEmergencyRoute } from "@/lib/emergency-routing";
import { noStoreJson } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
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
