import { getFireSafetyApiSummary } from "@/lib/fire-safety-api";
import {
  findNearestPoints,
  listDatasetStatuses,
  listHazardEvents,
  searchPointSummaries,
} from "@/lib/points-db";
import { fetchItsTrafficAreaSummary } from "@/lib/traffic/realtime-traffic-service";

function compactPoint(point: {
  address: string;
  category: string;
  distanceMeters?: number;
  fetchedAt: string | null;
  latitude: number | null;
  longitude: number | null;
  name: string;
  phone: string | null;
  source: string;
  sourceUpdatedAt: string | null;
}) {
  return {
    address: point.address,
    category: point.category,
    distanceMeters: point.distanceMeters,
    fetchedAt: point.fetchedAt,
    latitude: point.latitude,
    longitude: point.longitude,
    name: point.name,
    phone: point.phone,
    source: point.source,
    sourceUpdatedAt: point.sourceUpdatedAt,
  };
}

export async function buildAiGrounding(params: {
  latitude?: number;
  longitude?: number;
  question: string;
}) {
  const hasCoordinate =
    Number.isFinite(params.latitude) && Number.isFinite(params.longitude);
  const searchTerms = Array.from(
    new Set(
      params.question
        .split(/[^0-9A-Za-z가-힣]+/)
        .map((term) => term.trim())
        .filter((term) => term.length >= 2)
        .filter(
          (term) =>
            ![
              "알려줘",
              "설명",
              "현재",
              "저장된",
              "가까운",
              "근처",
              "어디",
            ].includes(term),
        )
        .slice(0, 6),
    ),
  );
  const [datasets, fireSafetyApi, hazards, termMatches, nearby, traffic] =
    await Promise.all([
      listDatasetStatuses(),
      getFireSafetyApiSummary(),
      listHazardEvents({ limit: 12 }),
      Promise.all(searchTerms.map((term) => searchPointSummaries(term, 12))),
      hasCoordinate
        ? findNearestPoints({
            latitude: params.latitude as number,
            limit: 20,
            longitude: params.longitude as number,
            radiusMeters: 30_000,
          })
        : Promise.resolve([]),
      hasCoordinate
        ? fetchItsTrafficAreaSummary({
            latitude: params.latitude as number,
            longitude: params.longitude as number,
          })
        : Promise.resolve(null),
    ]);
  const matches = Array.from(
    new Map(termMatches.flat().map((point) => [point.id, point])).values(),
  ).slice(0, 20);

  return {
    generatedAt: new Date().toISOString(),
    externalApis: {
      fireSafetyApi,
      itsTraffic: traffic,
    },
    location: hasCoordinate
      ? { latitude: params.latitude, longitude: params.longitude }
      : null,
    datasets: datasets.map((dataset) => ({
      fetchedAt: dataset.fetchedAt,
      geocodedCount: dataset.geocodedCount,
      id: dataset.id,
      label: dataset.label,
      recordCount: dataset.recordCount,
    })),
    recentHazards: hazards.map((hazard) => ({
      eventType: hazard.eventType,
      issuedAt: hazard.issuedAt,
      latitude: hazard.latitude,
      location: hazard.location,
      longitude: hazard.longitude,
      magnitude: hazard.magnitude,
      title: hazard.title,
    })),
    matchingFacilities: matches.map(compactPoint),
    nearbyFacilities: nearby.map(compactPoint),
  };
}
