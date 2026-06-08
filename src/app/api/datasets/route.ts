import { updateAllDatasets } from "@/lib/dataset-import";
import { listDatasetStatuses } from "@/lib/points-db";

export const runtime = "nodejs";

export async function GET() {
  const datasets = await listDatasetStatuses();

  return Response.json({ datasets });
}

export async function POST() {
  const datasets = await updateAllDatasets();

  return Response.json({ datasets });
}
