import type { NextRequest } from "next/server";
import { requireAccessRole } from "@/lib/access-control";
import { type DatasetSourceId, isDatasetSourceId } from "@/lib/dataset-sources";
import { noStoreJson } from "@/lib/http";
import { decodeListingCursor } from "@/lib/listing-cursors";
import {
  listPointMarkerPage,
  listPointMarkers,
  listPointSummaries,
  listPointSummaryPage,
  listPoints,
  listRawPointPage,
  validatePointListCursor,
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

function parseSources(searchParams: URLSearchParams) {
  const values = searchParams
    .getAll("source")
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter(Boolean);
  const uniqueValues = [...new Set(values)];
  const sources: DatasetSourceId[] = [];

  for (const value of uniqueValues) {
    if (!isDatasetSourceId(value)) {
      return null;
    }

    sources.push(value);
  }

  return sources;
}

async function loadPoints(
  detail: string,
  includeRaw: boolean,
  options: Parameters<typeof listPoints>[0],
) {
  if (includeRaw) {
    return listPoints(options);
  }

  if (detail === "summary") {
    return listPointSummaries(options);
  }

  if (detail === "map") {
    return listPointMarkers(options);
  }

  return null;
}

async function loadPointPage(
  detail: string,
  includeRaw: boolean,
  options: Parameters<typeof listPoints>[0] & {
    cursor?: ReturnType<typeof validatePointListCursor> | null;
  },
) {
  if (includeRaw) {
    return listRawPointPage(options);
  }

  if (detail === "summary") {
    return listPointSummaryPage(options);
  }

  if (detail === "map") {
    return listPointMarkerPage(options);
  }

  return null;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const sources = parseSources(searchParams);
  const includeUnmapped = searchParams.get("includeUnmapped") === "true";
  const includeRaw = searchParams.get("includeRaw") === "true";
  const detail = searchParams.get("detail") ?? (includeRaw ? "raw" : "map");
  const cursorValue = searchParams.get("cursor");
  const limitParam = numberParam(searchParams, "limit");
  const minLatitude = numberParam(searchParams, "minLatitude");
  const maxLatitude = numberParam(searchParams, "maxLatitude");
  const minLongitude = numberParam(searchParams, "minLongitude");
  const maxLongitude = numberParam(searchParams, "maxLongitude");
  const centerLatitude = numberParam(searchParams, "centerLatitude");
  const centerLongitude = numberParam(searchParams, "centerLongitude");

  if (sources === null) {
    return noStoreJson({ error: "Unknown source" }, { status: 400 });
  }

  if (includeRaw || detail === "raw") {
    const [, accessError] = await requireAccessRole(request, "sudo");

    if (accessError !== null) {
      return noStoreJson(
        { error: accessError.message },
        { status: accessError.code === "unauthorized" ? 401 : 403 },
      );
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

  const decodedCursor = decodeListingCursor(
    cursorValue,
    validatePointListCursor,
  );

  if (!decodedCursor.ok) {
    return noStoreJson({ errorCode: "invalid_cursor" }, { status: 400 });
  }

  if (hasCenter && decodedCursor.cursor) {
    return noStoreJson(
      { errorCode: "cursor_center_sort_unsupported" },
      { status: 400 },
    );
  }

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
    source: sources.length === 1 ? sources[0] : null,
    sources: sources.length > 1 ? sources : undefined,
  };
  const page = hasCenter
    ? null
    : await loadPointPage(detail, includeRaw, {
        ...options,
        cursor: decodedCursor.cursor,
      });
  const points = page
    ? page.points
    : await loadPoints(detail, includeRaw, options);

  if (points === null) {
    return noStoreJson({ error: "Unknown detail level" }, { status: 400 });
  }

  return noStoreJson({ nextCursor: page?.nextCursor ?? null, points });
}
