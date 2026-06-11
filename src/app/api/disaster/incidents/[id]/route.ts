import { incidentService } from "@/lib/disaster-response/incident-service";
import type { IncidentStatus } from "@/lib/disaster-response/types";
import { noStoreJson } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function incidentStatus(value: unknown): IncidentStatus | null {
  return value === "reported" || value === "dispatched" || value === "closed"
    ? value
    : null;
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

  return noStoreJson({ incident });
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
  const payload = (await request.json().catch(() => null)) as {
    status?: unknown;
  } | null;
  const status = incidentStatus(payload?.status);

  if (!status) {
    return noStoreJson(
      { error: "status는 reported, dispatched, closed 중 하나여야 합니다." },
      { status: 400 },
    );
  }

  try {
    const incident = await incidentService.updateIncidentStatus(id, status);

    if (!incident) {
      return noStoreJson(
        { error: "사고 정보를 찾을 수 없습니다." },
        { status: 404 },
      );
    }

    return noStoreJson({ incident });
  } catch (error) {
    return noStoreJson(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 400 },
    );
  }
}
