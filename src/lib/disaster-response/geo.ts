import type { Coordinate } from "@/lib/disaster-response/types";

function radians(value: number) {
  return (value * Math.PI) / 180;
}

export function distanceMeters(from: Coordinate, to: Coordinate) {
  const earthRadius = 6_371_000;
  const latitudeDelta = radians(to.latitude - from.latitude);
  const longitudeDelta = radians(to.longitude - from.longitude);
  const fromLatitude = radians(from.latitude);
  const toLatitude = radians(to.latitude);
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(fromLatitude) *
      Math.cos(toLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;

  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function estimatedUrbanEtaMinutes(distance: number) {
  const metersPerMinute = 520;

  return Math.max(2, Math.round(distance / metersPerMinute));
}

export function assertKoreaCoordinate(coordinate: Coordinate) {
  if (
    !(
      Number.isFinite(coordinate.latitude) &&
      Number.isFinite(coordinate.longitude)
    ) ||
    coordinate.latitude < 32 ||
    coordinate.latitude > 39 ||
    coordinate.longitude < 124 ||
    coordinate.longitude > 132
  ) {
    throw new Error("대한민국 영역의 유효한 좌표가 필요합니다.");
  }
}

export function sortByDistance<T extends Coordinate>(
  origin: Coordinate,
  values: T[],
) {
  return [...values].sort(
    (left, right) =>
      distanceMeters(origin, left) - distanceMeters(origin, right),
  );
}
