import { updateDataset } from "@/lib/dataset-import";
import { isDatasetSourceId } from "@/lib/dataset-sources";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  context: { params: Promise<{ source: string }> },
) {
  const { source } = await context.params;

  if (!isDatasetSourceId(source)) {
    return Response.json({ error: "Unknown source" }, { status: 404 });
  }

  const dataset = await updateDataset(source);

  return Response.json({ dataset });
}
