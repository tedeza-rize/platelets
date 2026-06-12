import { incidentService } from "@/lib/disaster-response/incident-service";
import type {
  IncidentStatus,
  IncidentType,
  RiskLevel,
  UpdateIncidentInput,
} from "@/lib/disaster-response/types";
import { noStoreJson } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function incidentStatus(value: unknown): IncidentStatus | null {
  return value === "reported" || value === "dispatched" || value === "closed"
    ? value
    : null;
}

function incidentType(value: unknown): IncidentType | undefined {
  return value === "rescue" ||
    value === "medical" ||
    value === "traffic" ||
    value === "fire"
    ? value
    : undefined;
}

function riskLevel(value: unknown): RiskLevel | undefined {
  return value === "low" || value === "medium" || value === "high"
    ? value
    : undefined;
}

function hasUpdateField(payload: Record<string, unknown>) {
  return [
    "address",
    "description",
    "latitude",
    "longitude",
    "occurredAt",
    "riskLevel",
    "title",
    "type",
  ].some((key) => key in payload);
}

function updateInput(payload: Record<string, unknown>): UpdateIncidentInput {
  return {
    address: typeof payload.address === "string" ? payload.address : undefined,
    description:
      typeof payload.description === "string" ? payload.description : undefined,
    latitude: "latitude" in payload ? Number(payload.latitude) : undefined,
    longitude: "longitude" in payload ? Number(payload.longitude) : undefined,
    occurredAt:
      typeof payload.occurredAt === "string" ? payload.occurredAt : undefined,
    riskLevel: riskLevel(payload.riskLevel),
    title: typeof payload.title === "string" ? payload.title : undefined,
    type: incidentType(payload.type),
  };
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const incident = await incidentService.getIncident(id);

  if (!incident) {
    return noStoreJson(
      { error: "사고 정보를 찾을 수 없습니다." },
      { status: 404 },
    );
  }

  return noStoreJson({
    events: await incidentService.listIncidentEvents(id),
    incident,
  });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const limited = enforceRateLimit(request, {
    bucket: "disaster-incident-status",
    limit: 40,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const { id } = await context.params;
  const payload = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;

  if (!payload) {
    return noStoreJson({ error: "수정 정보가 필요합니다." }, { status: 400 });
  }

  const status = incidentStatus(payload.status);
  const shouldUpdateIncident = hasUpdateField(payload);

  if ("status" in payload && !status) {
    return noStoreJson(
      { error: "status는 reported, dispatched, closed 중 하나여야 합니다." },
      { status: 400 },
    );
  }

  if (!status && !shouldUpdateIncident) {
    return noStoreJson(
      {
        error:
          "status 또는 title, type, riskLevel, address, latitude, longitude 등의 수정 정보가 필요합니다.",
      },
      { status: 400 },
    );
  }

  try {
    let incident = shouldUpdateIncident
      ? await incidentService.updateIncident(id, updateInput(payload))
      : await incidentService.getIncident(id);

    if (incident && status && incident.status !== status) {
      incident = await incidentService.updateIncidentStatus(id, status);
    }

    if (!incident) {
      return noStoreJson(
        { error: "사고 정보를 찾을 수 없습니다." },
        { status: 404 },
      );
    }

    return noStoreJson({
      events: await incidentService.listIncidentEvents(id),
      incident,
    });
  } catch (error) {
    return noStoreJson(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 400 },
    );
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const limited = enforceRateLimit(request, {
    bucket: "disaster-incident-delete",
    limit: 20,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const { id } = await context.params;
  const deleted = await incidentService.deleteIncident(id);

  if (!deleted) {
    return noStoreJson(
      { error: "사고 정보를 찾을 수 없습니다." },
      { status: 404 },
    );
  }

  return noStoreJson({ deleted: true });
}
