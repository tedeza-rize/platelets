export type RoutingCoordinate = {
  latitude: number;
  longitude: number;
};

export type RoadNodeIndex = {
  cellDegrees: number;
  cells: Map<string, number[]>;
  nodes: Map<number, RoutingCoordinate>;
};

function cellId(latitude: number, longitude: number, cellDegrees: number) {
  return `${Math.floor(latitude / cellDegrees)}:${Math.floor(
    longitude / cellDegrees,
  )}`;
}

function radians(value: number) {
  return (value * Math.PI) / 180;
}

function haversineMeters(from: RoutingCoordinate, to: RoutingCoordinate) {
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

export function createRoadNodeIndex(
  nodes: Map<number, RoutingCoordinate>,
  cellDegrees = 0.01,
): RoadNodeIndex {
  const cells = new Map<string, number[]>();

  for (const [nodeId, coordinate] of nodes) {
    const key = cellId(coordinate.latitude, coordinate.longitude, cellDegrees);
    const values = cells.get(key) ?? [];
    values.push(nodeId);
    cells.set(key, values);
  }

  return { cellDegrees, cells, nodes };
}

export function nearestRoadNode(
  index: RoadNodeIndex,
  target: RoutingCoordinate,
  maxDistanceMeters = 2_500,
) {
  let bestId: number | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  const latitudeCell = Math.floor(target.latitude / index.cellDegrees);
  const longitudeCell = Math.floor(target.longitude / index.cellDegrees);

  for (let radius = 0; radius <= 4; radius += 1) {
    for (
      let lat = latitudeCell - radius;
      lat <= latitudeCell + radius;
      lat += 1
    ) {
      for (
        let lon = longitudeCell - radius;
        lon <= longitudeCell + radius;
        lon += 1
      ) {
        const nodeIds = index.cells.get(`${lat}:${lon}`) ?? [];

        for (const nodeId of nodeIds) {
          const coordinate = index.nodes.get(nodeId);
          if (!coordinate) continue;

          const distance = haversineMeters(target, coordinate);
          if (distance < bestDistance) {
            bestDistance = distance;
            bestId = nodeId;
          }
        }
      }
    }

    if (bestDistance <= radius * index.cellDegrees * 111_320) {
      break;
    }
  }

  if (bestId === null || bestDistance > maxDistanceMeters) {
    throw new Error("No routable road was found near the selected point.");
  }

  return bestId;
}
