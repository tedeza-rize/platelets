import { incidentService } from "@/lib/disaster-response/incident-service";
import type {
  CreateIncidentInput,
  IncidentType,
  RiskLevel,
} from "@/lib/disaster-response/types";
import { noStoreJson } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function incidentType(value: unknown): IncidentType {
  return value === "rescue" ||
    value === "medical" ||
    value === "traffic" ||
    value === "fire"
    ? value
    : "fire";
}

function riskLevel(value: unknown): RiskLevel {
  return value === "low" || value === "medium" || value === "high"
    ? value
    : "medium";
}

export async function GET() {
  return noStoreJson({ incidents: await incidentService.listIncidents() });
}

export async function POST(request: Request) {
  const limited = enforceRateLimit(request, {
    bucket: "disaster-incidents",
    limit: 20,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const payload = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;

  if (!payload) {
    return noStoreJson({ error: "사고 정보가 필요합니다." }, { status: 400 });
  }

  try {
    const input: CreateIncidentInput = {
      address:
        typeof payload.address === "string" ? payload.address : undefined,
      description:
        typeof payload.description === "string"
          ? payload.description
          : undefined,
      latitude: Number(payload.latitude),
      longitude: Number(payload.longitude),
      occurredAt:
        typeof payload.occurredAt === "string" ? payload.occurredAt : undefined,
      riskLevel: riskLevel(payload.riskLevel),
      title: typeof payload.title === "string" ? payload.title : undefined,
      type: incidentType(payload.type),
    };
    const incident = await incidentService.createIncident(input);

    return noStoreJson({ incident }, { status: 201 });
  } catch (error) {
    return noStoreJson(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 400 },
    );
  }
}
