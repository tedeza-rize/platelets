import { getOperationalSettings } from "@/lib/operational-settings";
import { getRuntimeApiKeys } from "@/lib/runtime-config";
import {
  fetchItsTrafficSummary,
  kakaoTrafficSummary,
  type TrafficSummary,
} from "@/lib/traffic/realtime-traffic-service";

type Coordinate = {
  latitude: number;
  longitude: number;
};

export type RouteProvider = "astar" | "kakao";

export type EmergencyRoute = {
  baseDurationSeconds: number;
  coordinates: [number, number][];
  distanceMeters: number;
  durationSeconds: number;
  provider: RouteProvider;
  traffic: TrafficSummary;
};

type OverpassElement = {
  id: number;
  lat?: number;
  lon?: number;
  nodes?: number[];
  tags?: Record<string, string>;
  type: "node" | "way";
};

type RoadGraph = {
  adjacency: Map<number, Array<{ nodeId: number; seconds: number }>>;
  nodes: Map<number, Coordinate>;
};

type QueueItem = {
  nodeId: number;
  score: number;
};

const MAX_ASTAR_DISTANCE_METERS = 70_000;
const graphCache = new Map<string, { expiresAt: number; graph: RoadGraph }>();

class MinPriorityQueue {
  private readonly items: QueueItem[] = [];

  get size() {
    return this.items.length;
  }

  push(item: QueueItem) {
    this.items.push(item);
    this.bubbleUp(this.items.length - 1);
  }

  pop() {
    if (this.items.length === 0) {
      return null;
    }

    const first = this.items[0];
    const last = this.items.pop() as QueueItem;

    if (this.items.length > 0) {
      this.items[0] = last;
      this.bubbleDown(0);
    }

    return first;
  }

  private bubbleUp(index: number) {
    let current = index;

    while (current > 0) {
      const parent = Math.floor((current - 1) / 2);

      if (this.items[parent].score <= this.items[current].score) {
        break;
      }

      [this.items[parent], this.items[current]] = [
        this.items[current],
        this.items[parent],
      ];
      current = parent;
    }
  }

  private bubbleDown(index: number) {
    let current = index;
    let settled = false;

    while (!settled) {
      const left = current * 2 + 1;
      const right = left + 1;
      let smallest = current;

      if (
        left < this.items.length &&
        this.items[left].score < this.items[smallest].score
      ) {
        smallest = left;
      }

      if (
        right < this.items.length &&
        this.items[right].score < this.items[smallest].score
      ) {
        smallest = right;
      }

      if (smallest === current) {
        settled = true;
        continue;
      }

      [this.items[current], this.items[smallest]] = [
        this.items[smallest],
        this.items[current],
      ];
      current = smallest;
    }
  }
}

async function overpassEndpoint() {
  return (await getOperationalSettings()).overpassApiUrl;
}

function radians(value: number) {
  return (value * Math.PI) / 180;
}

export function haversineMeters(from: Coordinate, to: Coordinate) {
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

function assertCoordinate(value: Coordinate) {
  if (
    !(Number.isFinite(value.latitude) && Number.isFinite(value.longitude)) ||
    value.latitude < -90 ||
    value.latitude > 90 ||
    value.longitude < -180 ||
    value.longitude > 180
  ) {
    throw new Error("Invalid route coordinate.");
  }
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

function graphBounds(origin: Coordinate, destination: Coordinate) {
  const padding = Math.max(
    0.012,
    Math.min(0.08, haversineMeters(origin, destination) / 350_000),
  );

  return {
    east: Math.max(origin.longitude, destination.longitude) + padding,
    north: Math.max(origin.latitude, destination.latitude) + padding,
    south: Math.min(origin.latitude, destination.latitude) - padding,
    west: Math.min(origin.longitude, destination.longitude) - padding,
  };
}

function graphCacheKey(bounds: ReturnType<typeof graphBounds>) {
  return [bounds.south, bounds.west, bounds.north, bounds.east]
    .map((value) => value.toFixed(2))
    .join(":");
}

async function fetchRoadGraph(
  origin: Coordinate,
  destination: Coordinate,
): Promise<RoadGraph> {
  const bounds = graphBounds(origin, destination);
  const key = graphCacheKey(bounds);
  const cached = graphCache.get(key);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.graph;
  }

  const query = `[out:json][timeout:25];way["highway"]["highway"!~"footway|path|cycleway|steps|pedestrian|bridleway"]["access"!="private"](${bounds.south},${bounds.west},${bounds.north},${bounds.east});(._;>;);out body;`;
  const response = await fetch(await overpassEndpoint(), {
    body: new URLSearchParams({ data: query }),
    cache: "no-store",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "platelets/0.1 emergency-routing",
    },
    method: "POST",
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    throw new Error(`Overpass road request failed (${response.status}).`);
  }

  const payload = (await response.json()) as { elements?: OverpassElement[] };
  const elements = payload.elements ?? [];
  const nodes = new Map<number, Coordinate>();
  const adjacency = new Map<
    number,
    Array<{ nodeId: number; seconds: number }>
  >();

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

  function connect(fromId: number, toId: number, seconds: number) {
    const edges = adjacency.get(fromId) ?? [];
    edges.push({ nodeId: toId, seconds });
    adjacency.set(fromId, edges);
  }

  for (const way of elements) {
    if (way.type !== "way" || !way.nodes || way.nodes.length < 2) {
      continue;
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
        connect(previousId, currentId, seconds);
      }

      if (!forwardOnly) {
        connect(currentId, previousId, seconds);
      }
    }
  }

  const graph = { adjacency, nodes };
  graphCache.set(key, { expiresAt: Date.now() + 10 * 60 * 1000, graph });

  return graph;
}

function nearestNode(nodes: Map<number, Coordinate>, target: Coordinate) {
  let bestId: number | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const [nodeId, coordinate] of nodes) {
    const distance = haversineMeters(target, coordinate);

    if (distance < bestDistance) {
      bestDistance = distance;
      bestId = nodeId;
    }
  }

  if (bestId === null || bestDistance > 2_500) {
    throw new Error("No routable road was found near the selected point.");
  }

  return bestId;
}

function reconstructPath(cameFrom: Map<number, number>, current: number) {
  let cursor = current;
  const path = [cursor];

  while (cameFrom.has(cursor)) {
    cursor = cameFrom.get(cursor) as number;
    path.push(cursor);
  }

  return path.reverse();
}

async function routeWithAstar(
  origin: Coordinate,
  destination: Coordinate,
): Promise<EmergencyRoute> {
  if (haversineMeters(origin, destination) > MAX_ASTAR_DISTANCE_METERS) {
    throw new Error("A* routing is limited to 70 km per request.");
  }

  const graph = await fetchRoadGraph(origin, destination);
  const startId = nearestNode(graph.nodes, origin);
  const goalId = nearestNode(graph.nodes, destination);
  const open = new MinPriorityQueue();
  const cameFrom = new Map<number, number>();
  const gScore = new Map<number, number>([[startId, 0]]);
  const fScore = new Map<number, number>([
    [
      startId,
      haversineMeters(graph.nodes.get(startId) as Coordinate, destination) / 25,
    ],
  ]);
  open.push({ nodeId: startId, score: fScore.get(startId) as number });

  while (open.size > 0) {
    const next = open.pop();

    if (!next) {
      break;
    }

    const current = next.nodeId;
    const knownScore = fScore.get(current) ?? Number.POSITIVE_INFINITY;

    if (next.score > knownScore) {
      continue;
    }

    if (current === goalId) {
      const nodeIds = reconstructPath(cameFrom, current);
      const coordinates = nodeIds.map((nodeId) => {
        const node = graph.nodes.get(nodeId) as Coordinate;
        return [node.longitude, node.latitude] as [number, number];
      });
      let distanceMeters = 0;

      for (let index = 1; index < nodeIds.length; index += 1) {
        distanceMeters += haversineMeters(
          graph.nodes.get(nodeIds[index - 1]) as Coordinate,
          graph.nodes.get(nodeIds[index]) as Coordinate,
        );
      }

      return {
        baseDurationSeconds: Math.round(gScore.get(goalId) ?? 0),
        coordinates: [
          [origin.longitude, origin.latitude],
          ...coordinates,
          [destination.longitude, destination.latitude],
        ],
        distanceMeters: Math.round(distanceMeters),
        durationSeconds: Math.round(gScore.get(goalId) ?? 0),
        provider: "astar",
        traffic: {
          averageSpeedKph: null,
          baseDurationSeconds: Math.round(gScore.get(goalId) ?? 0),
          congestionLevel: "unknown",
          durationMultiplier: 1,
          message: "실시간 교통 보정 전 기준 A* 경로",
          provider: "none",
          sampleCount: 0,
          status: "unconfigured",
          updatedAt: null,
        },
      };
    }

    for (const edge of graph.adjacency.get(current) ?? []) {
      const tentative =
        (gScore.get(current) ?? Number.POSITIVE_INFINITY) + edge.seconds;

      if (tentative >= (gScore.get(edge.nodeId) ?? Number.POSITIVE_INFINITY)) {
        continue;
      }

      cameFrom.set(edge.nodeId, current);
      gScore.set(edge.nodeId, tentative);
      const node = graph.nodes.get(edge.nodeId) as Coordinate;
      fScore.set(
        edge.nodeId,
        tentative + haversineMeters(node, destination) / 40,
      );
      open.push({
        nodeId: edge.nodeId,
        score: fScore.get(edge.nodeId) ?? Number.POSITIVE_INFINITY,
      });
    }
  }

  throw new Error("No connected road route was found.");
}

async function routeWithKakao(
  origin: Coordinate,
  destination: Coordinate,
): Promise<EmergencyRoute> {
  const { kakaoMobilityRestApiKey, kakaoRestApiKey } =
    await getRuntimeApiKeys();
  const apiKey = kakaoMobilityRestApiKey || kakaoRestApiKey;

  if (!apiKey) {
    throw new Error("The Kakao Mobility API key is not configured.");
  }

  const url = new URL("https://apis-navi.kakaomobility.com/v1/directions");
  url.searchParams.set("origin", `${origin.longitude},${origin.latitude}`);
  url.searchParams.set(
    "destination",
    `${destination.longitude},${destination.latitude}`,
  );
  url.searchParams.set("priority", "TIME");
  const response = await fetch(url, {
    cache: "no-store",
    headers: { Authorization: `KakaoAK ${apiKey}` },
    signal: AbortSignal.timeout(20_000),
  });

  if (!response.ok) {
    throw new Error(`Kakao Mobility directions failed (${response.status}).`);
  }

  const payload = (await response.json()) as {
    routes?: Array<{
      result_code?: number;
      sections?: Array<{
        distance?: number;
        duration?: number;
        roads?: Array<{ vertexes?: number[] }>;
      }>;
      summary?: { distance?: number; duration?: number };
    }>;
  };
  const route = payload.routes?.[0];

  if (!route || (route.result_code ?? 0) !== 0) {
    throw new Error("Kakao Mobility returned no route.");
  }

  const coordinates = (route.sections ?? []).flatMap((section) =>
    (section.roads ?? []).flatMap((road) => {
      const vertices = road.vertexes ?? [];
      const pairs: [number, number][] = [];
      for (let index = 0; index + 1 < vertices.length; index += 2) {
        pairs.push([vertices[index], vertices[index + 1]]);
      }
      return pairs;
    }),
  );

  if (coordinates.length < 2) {
    throw new Error("Kakao Mobility returned an empty route.");
  }

  return {
    baseDurationSeconds: Math.round(route.summary?.duration ?? 0),
    coordinates,
    distanceMeters: Math.round(route.summary?.distance ?? 0),
    durationSeconds: Math.round(route.summary?.duration ?? 0),
    provider: "kakao",
    traffic: kakaoTrafficSummary(Math.round(route.summary?.duration ?? 0)),
  };
}

async function applyTrafficAdjustment(
  route: EmergencyRoute,
  origin: Coordinate,
  destination: Coordinate,
) {
  if (route.provider === "kakao") {
    return route;
  }

  const traffic = await fetchItsTrafficSummary({
    baseDurationSeconds: route.baseDurationSeconds,
    destination,
    distanceMeters: route.distanceMeters,
    origin,
  });

  return {
    ...route,
    durationSeconds: Math.max(
      1,
      Math.round(route.baseDurationSeconds * traffic.durationMultiplier),
    ),
    traffic,
  };
}

export async function calculateEmergencyRoute(params: {
  destination: Coordinate;
  origin: Coordinate;
  provider: RouteProvider;
}) {
  assertCoordinate(params.origin);
  assertCoordinate(params.destination);

  const route =
    params.provider === "kakao"
      ? routeWithKakao(params.origin, params.destination)
      : routeWithAstar(params.origin, params.destination);

  return applyTrafficAdjustment(await route, params.origin, params.destination);
}

export async function hasKakaoMobilityKey() {
  const { kakaoMobilityRestApiKey, kakaoRestApiKey } =
    await getRuntimeApiKeys();
  return Boolean(kakaoMobilityRestApiKey || kakaoRestApiKey);
}
