import type { NextRequest } from "next/server";
import { noStoreJson } from "@/lib/http";
import { fetchItsTrafficAreaSummary } from "@/lib/traffic/realtime-traffic-service";

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
  const searchParams = request.nextUrl.searchParams;
  const latitude = numberParam(searchParams, "latitude");
  const longitude = numberParam(searchParams, "longitude");
  const radiusDegrees = numberParam(searchParams, "radiusDegrees");

  if (
    latitude === null ||
    longitude === null ||
    Number.isNaN(latitude) ||
    Number.isNaN(longitude) ||
    Number.isNaN(radiusDegrees)
  ) {
    return noStoreJson({ errorCode: "invalid_coordinates" }, { status: 400 });
  }

  if (latitude < 32 || latitude > 39 || longitude < 124 || longitude > 132) {
    return noStoreJson(
      { errorCode: "coordinate_outside_korea" },
      { status: 400 },
    );
  }

  return noStoreJson({
    traffic: await fetchItsTrafficAreaSummary({
      latitude,
      longitude,
      radiusDegrees: radiusDegrees ?? undefined,
    }),
  });
}
