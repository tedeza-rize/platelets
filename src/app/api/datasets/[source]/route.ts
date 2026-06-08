import { isDatasetSourceId } from "@/lib/dataset-sources";
import { getDatasetStatus } from "@/lib/points-db";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ source: string }> },
) {
  const { source } = await context.params;

  if (!isDatasetSourceId(source)) {
    return Response.json({ error: "Unknown source" }, { status: 404 });
  }

  const dataset = await getDatasetStatus(source);

  return Response.json({ dataset });
}
