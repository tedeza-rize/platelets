import {
  KOREA_COORDINATE_ERROR,
  parseRequiredKoreaCoordinates,
} from "@/lib/coordinates";
import {
  type EmergencyScenario,
  findEmergencyDispatchStation,
  recommendEmergencyHospitals,
} from "@/lib/emergency-recommendation";
import { noStoreJson } from "@/lib/http";
import { enforceSharedRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SCENARIOS = new Set<EmergencyScenario>([
  "general",
  "pediatric-respiratory",
  "cardiac",
  "stroke",
  "trauma",
  "burn",
  "delivery",
  "elderly-fall",
]);

export async function POST(request: Request) {
  const limited = await enforceSharedRateLimit(request, {
    bucket: "emergency-recommendations",
    limit: 30,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const payload = (await request.json().catch(() => null)) as {
    incidentType?: unknown;
    latitude?: unknown;
    longitude?: unknown;
    scenario?: unknown;
  } | null;
  const coordinates = parseRequiredKoreaCoordinates({
    latitude: payload?.latitude,
    longitude: payload?.longitude,
  });
  const scenario = SCENARIOS.has(payload?.scenario as EmergencyScenario)
    ? (payload?.scenario as EmergencyScenario)
    : "general";

  if (!coordinates) {
    return noStoreJson({ error: KOREA_COORDINATE_ERROR }, { status: 400 });
  }

  try {
    const [hospitals, dispatchStation] = await Promise.all([
      recommendEmergencyHospitals({ ...coordinates, scenario }),
      payload?.incidentType === "fire"
        ? findEmergencyDispatchStation(coordinates)
        : Promise.resolve(null),
    ]);

    return noStoreJson({ dispatchStation, hospitals, scenario });
  } catch (error) {
    return noStoreJson(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 422 },
    );
  }
}
