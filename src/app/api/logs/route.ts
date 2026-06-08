import type { NextRequest } from "next/server";
import { isDatasetSourceId } from "@/lib/dataset-sources";
import { noStoreJson } from "@/lib/http";
import { listApiLogs } from "@/lib/points-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type LogCategory = "dataset" | "geocoding" | "system" | "ui";

const LOG_CATEGORIES = new Set<LogCategory>([
  "dataset",
  "geocoding",
  "system",
  "ui",
]);

function isLogCategory(value: string): value is LogCategory {
  return LOG_CATEGORIES.has(value as LogCategory);
}

export async function GET(request: NextRequest) {
  const category = request.nextUrl.searchParams.get("category");
  const source = request.nextUrl.searchParams.get("source");
  const limitValue = Number(request.nextUrl.searchParams.get("limit") ?? 200);

  if (category && !isLogCategory(category)) {
    return noStoreJson({ error: "Unknown log category" }, { status: 400 });
  }

  if (source && !isDatasetSourceId(source)) {
    return noStoreJson({ error: "Unknown source" }, { status: 400 });
  }

  const selectedCategory =
    category && isLogCategory(category) ? category : null;
  const selectedSource = source && isDatasetSourceId(source) ? source : null;
  const logs = await listApiLogs({
    category: selectedCategory,
    limit: Number.isFinite(limitValue) ? limitValue : 200,
    source: selectedSource,
  });

  return noStoreJson({ logs });
}
