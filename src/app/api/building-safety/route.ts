import { buildingSafetyService } from "@/lib/building-safety/building-safety-service";
import { noStoreJson } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function numberParam(searchParams: URLSearchParams, key: string) {
  const value = searchParams.get(key);

  if (!value) {
    return null;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : null;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const latitude = numberParam(url.searchParams, "latitude");
  const longitude = numberParam(url.searchParams, "longitude");

  if (latitude === null || longitude === null) {
    return noStoreJson({
      profile: null,
      profiles: buildingSafetyService.listProfiles(),
      sources: buildingSafetyService.listSources(),
    });
  }

  const nearest = buildingSafetyService.findNearestProfile({
    latitude,
    longitude,
  });

  return noStoreJson({
    distanceMeters: nearest ? Math.round(nearest.distanceMeters) : null,
    profile: nearest?.profile ?? null,
    sources: buildingSafetyService.listSources(nearest?.profile.sourceIds),
  });
}
