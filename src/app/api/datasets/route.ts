import { updateAllDatasets } from "@/lib/dataset-import";
import { noStoreJson } from "@/lib/http";
import { listDatasetStatuses } from "@/lib/points-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const datasets = await listDatasetStatuses();

  return noStoreJson({ datasets });
}

export async function POST() {
  const datasets = await updateAllDatasets();

  return noStoreJson({ datasets });
}
