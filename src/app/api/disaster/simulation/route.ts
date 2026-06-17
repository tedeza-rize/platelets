import { requireAccessRole } from "@/lib/access-control";
import {
  type DisasterSimulationInput,
  generateDisasterSimulation,
} from "@/lib/disaster-response/simulation";
import { noStoreJson } from "@/lib/http";
import { enforceSharedRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function inputText(payload: Record<string, unknown>, key: string) {
  return typeof payload[key] === "string" ? payload[key].slice(0, 1200) : "";
}

export async function POST(request: Request) {
  const [, accessError] = await requireAccessRole(request, "dispatcher");

  if (accessError !== null) {
    return noStoreJson(
      { error: accessError.message },
      { status: accessError.code === "unauthorized" ? 401 : 403 },
    );
  }
  const limited = await enforceSharedRateLimit(request, {
    bucket: "disaster-simulation",
    limit: 8,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const payload = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;

  if (!payload) {
    return noStoreJson({ errorCode: "invalid_request" }, { status: 400 });
  }

  const input: DisasterSimulationInput = {
    buildingContext: inputText(payload, "buildingContext"),
    incidentContext: inputText(payload, "incidentContext"),
    locationContext: inputText(payload, "locationContext"),
    riskContext: inputText(payload, "riskContext"),
    weatherContext: inputText(payload, "weatherContext"),
  };

  try {
    const scenario = await generateDisasterSimulation(input);

    if (scenario === null) {
      return noStoreJson({ errorCode: "ai_api_key_missing" }, { status: 503 });
    }

    return noStoreJson({ scenario });
  } catch (error) {
    console.error("Disaster simulation failed", error);
    return noStoreJson(
      { errorCode: "ai_provider_unavailable" },
      { status: 502 },
    );
  }
}
