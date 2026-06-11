import type { NextRequest } from "next/server";
import { requireAccessRole } from "@/lib/access-control";
import { isDatasetSourceId } from "@/lib/dataset-sources";
import { noStoreJson } from "@/lib/http";
import {
  listPointMarkers,
  listPointSummaries,
  listPoints,
} from "@/lib/points-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function numberParam(searchParams: URLSearchParams, name: string) {
  const raw = searchParams.get(name);

  if (raw === null) {
    return null;
  }

  const value = Number(raw);

  return Number.isFinite(value) ? value : Number.NaN;
}

export async function GET(request: NextRequest) {
  const source = request.nextUrl.searchParams.get("source");
  const searchParams = request.nextUrl.searchParams;
  const includeUnmapped = searchParams.get("includeUnmapped") === "true";
  const includeRaw = searchParams.get("includeRaw") === "true";
  const detail = searchParams.get("detail") ?? (includeRaw ? "raw" : "map");
  const limitParam = numberParam(searchParams, "limit");
  const minLatitude = numberParam(searchParams, "minLatitude");
  const maxLatitude = numberParam(searchParams, "maxLatitude");
  const minLongitude = numberParam(searchParams, "minLongitude");
  const maxLongitude = numberParam(searchParams, "maxLongitude");
  const centerLatitude = numberParam(searchParams, "centerLatitude");
  const centerLongitude = numberParam(searchParams, "centerLongitude");

  if (source && !isDatasetSourceId(source)) {
    return noStoreJson({ error: "Unknown source" }, { status: 400 });
  }

  if (includeRaw || detail === "raw") {
    const forbidden = await requireAccessRole(request, "sudo");

    if (forbidden) {
      return forbidden;
    }
  }

  if (
    [
      limitParam,
      minLatitude,
      maxLatitude,
      minLongitude,
      maxLongitude,
      centerLatitude,
      centerLongitude,
    ].some(Number.isNaN)
  ) {
    return noStoreJson(
      { error: "Invalid numeric query parameter" },
      {
        status: 400,
      },
    );
  }

  const hasBounds =
    minLatitude !== null ||
    maxLatitude !== null ||
    minLongitude !== null ||
    maxLongitude !== null;

  if (
    hasBounds &&
    (minLatitude === null ||
      maxLatitude === null ||
      minLongitude === null ||
      maxLongitude === null)
  ) {
    return noStoreJson({ error: "Incomplete bounding box" }, { status: 400 });
  }

  const hasCenter = centerLatitude !== null || centerLongitude !== null;

  if (hasCenter && (centerLatitude === null || centerLongitude === null)) {
    return noStoreJson(
      { error: "Incomplete center coordinate" },
      { status: 400 },
    );
  }

  const selectedSource = source && isDatasetSourceId(source) ? source : null;
  const options = {
    bounds:
      minLatitude !== null &&
      maxLatitude !== null &&
      minLongitude !== null &&
      maxLongitude !== null
        ? { maxLatitude, maxLongitude, minLatitude, minLongitude }
        : undefined,
    center:
      centerLatitude !== null && centerLongitude !== null
        ? { latitude: centerLatitude, longitude: centerLongitude }
        : undefined,
    includeUnmapped,
    limit: limitParam ?? undefined,
    source: selectedSource,
  };
  const points = includeRaw
    ? await listPoints(options)
    : detail === "summary"
      ? await listPointSummaries(options)
      : detail === "map"
        ? await listPointMarkers(options)
        : null;

  if (points === null) {
    return noStoreJson({ error: "Unknown detail level" }, { status: 400 });
  }

  return noStoreJson({ points });
}
