import type { NextRequest } from "next/server";
import { isDatasetSourceId } from "@/lib/dataset-sources";
import { noStoreJson } from "@/lib/http";
import { listPoints } from "@/lib/points-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const source = request.nextUrl.searchParams.get("source");
  const includeUnmapped =
    request.nextUrl.searchParams.get("includeUnmapped") === "true";

  if (source && !isDatasetSourceId(source)) {
    return noStoreJson({ error: "Unknown source" }, { status: 400 });
  }

  const selectedSource = source && isDatasetSourceId(source) ? source : null;
  const points = await listPoints({
    includeUnmapped,
    source: selectedSource,
  });

  return noStoreJson({ points });
}
