import {
  type EmergencyScenario,
  findEmergencyDispatchStation,
  recommendEmergencyHospitals,
} from "@/lib/emergency-recommendation";
import { noStoreJson } from "@/lib/http";

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
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
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
