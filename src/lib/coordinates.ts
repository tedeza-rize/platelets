export type CoordinatePair = {
  latitude: number;
  longitude: number;
};

export const KOREA_COORDINATE_BOUNDS = {
  maxLatitude: 39,
  maxLongitude: 132,
  minLatitude: 32,
  minLongitude: 124,
} as const;

export const KOREA_COORDINATE_ERROR =
  "Valid latitude and longitude within Korea are required.";

function isBlankCoordinate(value: unknown) {
  return value === null || value === undefined || String(value).trim() === "";
}

function toFiniteNumber(value: unknown) {
  const parsed = Number(String(value).trim());
  return Number.isFinite(parsed) ? parsed : null;
}

export function isWithinKoreaCoordinates(coordinates: CoordinatePair) {
  return (
    coordinates.latitude >= KOREA_COORDINATE_BOUNDS.minLatitude &&
    coordinates.latitude <= KOREA_COORDINATE_BOUNDS.maxLatitude &&
    coordinates.longitude >= KOREA_COORDINATE_BOUNDS.minLongitude &&
    coordinates.longitude <= KOREA_COORDINATE_BOUNDS.maxLongitude
  );
}

export function parseRequiredKoreaCoordinates(params: {
  latitude: unknown;
  longitude: unknown;
}): CoordinatePair | null {
  const latitude = toFiniteNumber(params.latitude);
  const longitude = toFiniteNumber(params.longitude);

  if (latitude === null || longitude === null) return null;

  const coordinates = { latitude, longitude };
  return isWithinKoreaCoordinates(coordinates) ? coordinates : null;
}

export function parseOptionalKoreaCoordinates(params: {
  latitude: unknown;
  longitude: unknown;
}): CoordinatePair | null | undefined {
  const hasLatitude = !isBlankCoordinate(params.latitude);
  const hasLongitude = !isBlankCoordinate(params.longitude);

  if (!hasLatitude && !hasLongitude) return undefined;
  if (!hasLatitude || !hasLongitude) return null;

  return parseRequiredKoreaCoordinates(params);
}
