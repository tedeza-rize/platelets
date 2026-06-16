import {
  createRoadNodeIndex,
  type RoadNodeIndex,
  type RoutingCoordinate,
} from "@/lib/emergency-routing-spatial-index";

export type OverpassElement = {
  id: number;
  lat?: number;
  lon?: number;
  nodes?: number[];
  tags?: Record<string, string>;
  type: "node" | "way";
};

export type RoadGraph = {
  adjacency: Map<number, Array<{ nodeId: number; seconds: number }>>;
  nodeIndex: RoadNodeIndex;
  nodes: Map<number, RoutingCoordinate>;
};

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

function highwaySpeedKph(highway: string | undefined) {
  const speeds: Record<string, number> = {
    motorway: 90,
    motorway_link: 55,
    primary: 60,
    primary_link: 45,
    residential: 30,
    secondary: 50,
    secondary_link: 40,
    service: 20,
    tertiary: 40,
    tertiary_link: 35,
    trunk: 75,
    trunk_link: 50,
    unclassified: 30,
  };

  return speeds[highway ?? ""] ?? 25;
}

function parseMaxSpeed(value: string | undefined, fallback: number) {
  const match = value?.match(/\d+(?:\.\d+)?/);
  const parsed = match ? Number(match[0]) : Number.NaN;

  return Number.isFinite(parsed)
    ? Math.min(130, Math.max(10, parsed))
    : fallback;
}

function connect(
  adjacency: RoadGraph["adjacency"],
  fromId: number,
  toId: number,
  seconds: number,
) {
  const edges = adjacency.get(fromId) ?? [];
  edges.push({ nodeId: toId, seconds });
  adjacency.set(fromId, edges);
}

function collectNodes(elements: OverpassElement[]) {
  const nodes = new Map<number, RoutingCoordinate>();

  for (const element of elements) {
    if (
      element.type === "node" &&
      typeof element.lat === "number" &&
      typeof element.lon === "number"
    ) {
      nodes.set(element.id, {
        latitude: element.lat,
        longitude: element.lon,
      });
    }
  }

  return nodes;
}

function connectWay(
  adjacency: RoadGraph["adjacency"],
  nodes: RoadGraph["nodes"],
  way: OverpassElement,
) {
  if (way.type !== "way" || !way.nodes || way.nodes.length < 2) {
    return;
  }

  const tags = way.tags ?? {};
  const fallbackSpeed = highwaySpeedKph(tags.highway);
  const speedMetersPerSecond =
    parseMaxSpeed(tags.maxspeed, fallbackSpeed) / 3.6;
  const reverseOnly = tags.oneway === "-1";
  const forwardOnly =
    tags.oneway === "yes" ||
    tags.oneway === "1" ||
    tags.junction === "roundabout" ||
    tags.highway === "motorway";

  for (let index = 1; index < way.nodes.length; index += 1) {
    const previousId = way.nodes[index - 1];
    const currentId = way.nodes[index];
    const previous = nodes.get(previousId);
    const current = nodes.get(currentId);

    if (!(previous && current)) {
      continue;
    }

    const seconds = haversineMeters(previous, current) / speedMetersPerSecond;

    if (!reverseOnly) {
      connect(adjacency, previousId, currentId, seconds);
    }

    if (!forwardOnly) {
      connect(adjacency, currentId, previousId, seconds);
    }
  }
}

export function buildRoadGraphFromOverpass(
  elements: OverpassElement[],
): RoadGraph {
  const nodes = collectNodes(elements);
  const adjacency: RoadGraph["adjacency"] = new Map();

  for (const way of elements) {
    connectWay(adjacency, nodes, way);
  }

  return { adjacency, nodeIndex: createRoadNodeIndex(nodes), nodes };
}
