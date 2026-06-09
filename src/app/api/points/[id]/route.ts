import { noStoreJson } from "@/lib/http";
import { getPointSummary } from "@/lib/points-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const pointId = Number(id);

  if (!Number.isInteger(pointId) || pointId < 1) {
    return noStoreJson({ error: "Invalid point id" }, { status: 400 });
  }

  const point = await getPointSummary(pointId);

  if (!point) {
    return noStoreJson({ error: "Point not found" }, { status: 404 });
  }

  return noStoreJson({ point });
}
