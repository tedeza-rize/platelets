import { updateDataset } from "@/lib/dataset-import";
import { isDatasetSourceId } from "@/lib/dataset-sources";
import { noStoreJson } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  context: { params: Promise<{ source: string }> },
) {
  const { source } = await context.params;

  if (!isDatasetSourceId(source)) {
    return noStoreJson({ error: "Unknown source" }, { status: 404 });
  }

  const dataset = await updateDataset(source);

  return noStoreJson({ dataset });
}
