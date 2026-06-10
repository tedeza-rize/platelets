import {
  type EmergencyScenario,
  findEmergencyDispatchStation,
  recommendEmergencyHospitals,
} from "@/lib/emergency-recommendation";
import { noStoreJson } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";

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
  const limited = enforceRateLimit(request, {
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
  const latitude = Number(payload?.latitude);
  const longitude = Number(payload?.longitude);
  const scenario = SCENARIOS.has(payload?.scenario as EmergencyScenario)
    ? (payload?.scenario as EmergencyScenario)
    : "general";

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < 32 ||
    latitude > 39 ||
    longitude < 124 ||
    longitude > 132
  ) {
    return noStoreJson(
      { error: "올바른 사고 위치가 필요합니다." },
      { status: 400 },
    );
  }

  try {
    const [hospitals, dispatchStation] = await Promise.all([
      recommendEmergencyHospitals({ latitude, longitude, scenario }),
      payload?.incidentType === "fire"
        ? findEmergencyDispatchStation({ latitude, longitude })
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
