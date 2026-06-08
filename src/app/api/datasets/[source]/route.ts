import { isDatasetSourceId } from "@/lib/dataset-sources";
import { noStoreJson } from "@/lib/http";
import { getDatasetStatus } from "@/lib/points-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ source: string }> },
) {
  const { source } = await context.params;

  if (!isDatasetSourceId(source)) {
    return noStoreJson({ error: "Unknown source" }, { status: 404 });
  }

  const dataset = await getDatasetStatus(source);

  return noStoreJson({ dataset });
}
