"use client";

import {
  AlertTriangle,
  Ambulance,
  Check,
  ChevronDown,
  Database,
  Globe2,
  HeartPulse,
  Layers,
  ListFilter,
  Map as MapIcon,
  MapPin,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  UserCog,
} from "lucide-react";
import type {
  GeoJSONSource,
  MapGeoJSONFeature,
  MapLayerMouseEvent,
  Map as MapLibreMap,
  PropertyValueSpecification,
  StyleSpecification,
} from "maplibre-gl";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DatasetSourceId } from "@/lib/dataset-sources";
import type { AppDictionary } from "@/lib/i18n";
import {
  type EmergencyRouteResult,
  EmergencyRoutingPanel,
} from "./emergency-routing-panel";
import styles from "./map-shell.module.css";

type MapProvider = "vworld" | "osm";

type MapShellProps = {
  dictionary: AppDictionary;
  initialProvider: MapProvider;
};

type EmergencyPointMarker = {
  category: string;
  id: number;
  latitude: number | null;
  longitude: number | null;
  source: DatasetSourceId;
};

type EmergencyPointDetail = EmergencyPointMarker & {
  address: string;
  fetchedAt: string | null;
  name: string;
  parentName: string | null;
  phone: string | null;
  sourceRecordId: string;
  sourceUpdatedAt: string | null;
};

type MappedEmergencyPoint = EmergencyPointMarker & {
  latitude: number;
  longitude: number;
};

type DatasetStatus = {
  error: string | null;
  failedCount: number;
  fetchedAt: string | null;
  geocodedCount: number;
  id: DatasetSourceId;
  label: string;
  recordCount: number;
  skippedCount: number;
  updatedAt: string | null;
};

type PointsResponse = {
  points: EmergencyPointMarker[];
};

type PointViewport = {
  maxLatitude: number;
  maxLongitude: number;
  minLatitude: number;
  minLongitude: number;
  zoom: number;
};

type PointDetailResponse = {
  point: EmergencyPointDetail;
};

type DatasetsResponse = {
  datasets: DatasetStatus[];
};

const SEOUL_CENTER: [number, number] = [37.5665, 126.978];
const MAP_CENTER: [number, number] = [SEOUL_CENTER[1], SEOUL_CENTER[0]];
const DEFAULT_ZOOM = 16;
const STYLE_LOAD_TIMEOUT_MS = 8000;
const POINTS_SOURCE_ID = "emergency-points";
const POINTS_HALO_LAYER_ID = "emergency-points-halo";
const POINTS_LAYER_ID = "emergency-points-hit-area";
const POINTS_SYMBOL_LAYER_ID = "emergency-points-symbol";
const HAZARDS_SOURCE_ID = "hazard-events";
const HAZARDS_HALO_LAYER_ID = "hazard-events-halo";
const HAZARDS_LAYER_ID = "hazard-events-circle";
const SEOUL_AREAS_SOURCE_ID = "seoul-citydata-areas";
const SEOUL_AREAS_HALO_LAYER_ID = "seoul-citydata-areas-halo";
const SEOUL_AREAS_LAYER_ID = "seoul-citydata-areas-circle";
const SEOUL_AREAS_SYMBOL_LAYER_ID = "seoul-citydata-areas-symbol";
const EMERGENCY_ROUTE_SOURCE_ID = "emergency-route";
const EMERGENCY_ROUTE_LAYER_ID = "emergency-route-line";
const HAZARD_POLL_INTERVAL_MS = 60_000;
const HAZARD_AUTO_FOCUS_KEY = "platelets:auto-focus-hazards";
const DEFAULT_VISIBLE_SOURCE: DatasetSourceId = "fire-stations";
const VIEWPORT_POINTS_PADDING_RATIO = 0.16;
const POINT_HALO_RADIUS: PropertyValueSpecification<number> = [
  "interpolate",
  ["linear"],
  ["zoom"],
  6,
  18,
  12,
  42,
];
const POINT_HIT_RADIUS: PropertyValueSpecification<number> = [
  "interpolate",
  ["linear"],
  ["zoom"],
  6,
  18,
  12,
  33,
];
const POINT_ICON_SIZE: PropertyValueSpecification<number> = [
  "interpolate",
  ["linear"],
  ["zoom"],
  6,
  0.87,
  12,
  1.38,
  16,
  1.62,
];
const VWORLD_API_KEY = process.env.NEXT_PUBLIC_VWORLD_API_KEY?.trim() ?? "";
const VWORLD_BASE_SOURCE_ID = "vworld-base";
const VWORLD_TRAFFIC_SOURCE_ID = "vworld-traffic";
const VWORLD_POI_SOURCE_ID = "vworld-poi";
const OPENFREEMAP_SOURCE_ID = "openmaptiles";
const SOURCE_COLORS: Record<DatasetSourceId, string> = {
  aeds: "#059669",
  "childcare-centers": "#db2777",
  "emergency-medical-institutions": "#e11d48",
  "fire-stations": "#dc2626",
  hospitals: "#0f766e",
  pharmacies: "#16a34a",
  "police-stations": "#1d4ed8",
  schools: "#ca8a04",
  universities: "#7c3aed",
};
const SOURCE_HALO_COLORS: Record<DatasetSourceId, string> = {
  aeds: "#10b981",
  "childcare-centers": "#f472b6",
  "emergency-medical-institutions": "#fb7185",
  "fire-stations": "#f97316",
  hospitals: "#2dd4bf",
  pharmacies: "#4ade80",
  "police-stations": "#2563eb",
  schools: "#facc15",
  universities: "#8b5cf6",
};
const SOURCE_ICON_IDS: Record<DatasetSourceId, string> = {
  aeds: "point-icon-aed",
  "childcare-centers": "point-icon-childcare",
  "emergency-medical-institutions": "point-icon-emergency-medical",
  "fire-stations": "point-icon-fire",
  hospitals: "point-icon-hospital",
  pharmacies: "point-icon-pharmacy",
  "police-stations": "point-icon-police",
  schools: "point-icon-school",
  universities: "point-icon-university",
};

type PointFeatureProperties = {
  category: string;
  iconId: string;
  id: number;
  latitude: number;
  longitude: number;
  source: DatasetSourceId;
};

type SeoulAreaPointProperties = SeoulAreaProperties & {
  longitude: number;
  latitude: number;
  populationLabel: string;
};

type HazardEvent = {
  depth: string | null;
  description: string | null;
  eventId: string;
  eventType: "earthquake" | "tsunami";
  fetchedAt: string | null;
  id: number;
  imageUrl: string | null;
  intensity: string | null;
  issuedAt: string | null;
  latitude: number | null;
  location: string;
  longitude: number | null;
  magnitude: string | null;
  occurredAt: string | null;
  title: string;
};

type MappedHazardEvent = HazardEvent & {
  latitude: number;
  longitude: number;
};

type HazardFeatureProperties = {
  depth: string;
  description: string;
  eventId: string;
  eventType: "earthquake" | "tsunami";
  imageUrl: string;
  intensity: string;
  issuedAt: string;
  latitude: number;
  location: string;
  longitude: number;
  magnitude: string;
  occurredAt: string;
  title: string;
};

type SeoulAreaProperties = {
  areaCode: string;
  areaName: string;
  category: string;
  congestionLevel?: string;
  congestionMessage?: string;
  englishName: string;
  maxPopulation?: number;
  minPopulation?: number;
  populationTime?: string;
};

type SeoulAreaFeature = {
  geometry: {
    coordinates: number[][][];
    type: "Polygon";
  };
  properties: SeoulAreaProperties;
  type: "Feature";
};

type SeoulAreasData = {
  features: SeoulAreaFeature[];
  type: "FeatureCollection";
};

type SeoulPopulationStatus = {
  areaCode: string;
  areaName: string;
  congestionLevel: string | null;
  congestionMessage: string | null;
  maxPopulation: number | null;
  minPopulation: number | null;
  populationTime: string | null;
  sourceUpdatedAt: string | null;
};

type SeoulPopulationResponse = {
  error?: string;
  population?: SeoulPopulationStatus;
};

type HazardsResponse = {
  events: HazardEvent[];
  serverTime: string;
};

const PROVIDERS: Record<
  MapProvider,
  {
    icon: typeof Layers;
    labelKey: keyof AppDictionary["map"]["providers"];
  }
> = {
  vworld: {
    icon: Layers,
    labelKey: "vworld",
  },
  osm: {
    icon: Globe2,
    labelKey: "osm",
  },
};

const VWORLD_TRAFFIC_LINE_LAYERS = [
  ["vl_ex_hwrdcenl_l_0612", "#d4a93e", 1.8],
  ["vl_ex_cityhwrdcenl_l_0712", "#d8b34f", 1.5],
  ["vl_ex_mainrdcenl_l_0913", "#e0c16f", 1.3],
  ["vl_ex_nardcenl_l_0713", "#d7bf87", 1.1],
  ["vl_ex_localrdcenl_l_0713", "#d6c59b", 1],
  ["nsid_data.vl_ex_mainrdcenl_l_0913", "#e0c16f", 1.4],
  ["nsid_data.vl_ex_nardcenl_l_0713", "#d7bf87", 1.2],
  ["nsid_data.vl_ex_mainrd_a_1418", "#efe2bd", 1],
  ["nsid_data.vl_ex_narda_a_1418", "#eadfbf", 1],
  ["nsid_data.vl_rodway_ctln_1214", "#c7c2b7", 0.7],
  ["nsid_data.vl_rodway_bndry_1518", "#c9c4ba", 0.7],
] as const;

const VWORLD_POI_SOURCE_LAYERS = [
  ["twin_upoi.mv_vctl_poi_10", 10, 12],
  ["twin_upoi.mv_vctl_poi_11", 12, 14],
  ["twin_upoi.mv_vctl_poi_13", 14, 16],
  ["twin_upoi.mv_vctl_poi_15", 16, 20],
] as const;

type VectorPalette = {
  background: string;
  boundary: string;
  building: string;
  land: string;
  landuse: string;
  park: string;
  road: string;
  roadCasing: string;
  roadMajor: string;
  text: string;
  textHalo: string;
  water: string;
  waterLine: string;
};

const VECTOR_PALETTES: Record<MapProvider, VectorPalette> = {
  osm: {
    background: "#f7f8f5",
    boundary: "#9ba3af",
    building: "#d8d2c6",
    land: "#eef0e7",
    landuse: "#e9edd8",
    park: "#cfe8bf",
    road: "#ffffff",
    roadCasing: "#c6cbd2",
    roadMajor: "#f4d06f",
    text: "#334155",
    textHalo: "#ffffff",
    water: "#a8d7f0",
    waterLine: "#74b7df",
  },
  vworld: {
    background: "#f4f7fb",
    boundary: "#7d8798",
    building: "#d7dce4",
    land: "#edf2f1",
    landuse: "#e5efd9",
    park: "#bddfb6",
    road: "#ffffff",
    roadCasing: "#aeb8c7",
    roadMajor: "#ffd27a",
    text: "#27364a",
    textHalo: "#f8fbff",
    water: "#93c9e8",
    waterLine: "#4f9fce",
  },
};

function localizedNameExpression() {
  return ["coalesce", ["get", "name:ko"], ["get", "name"], ["get", "name_en"]];
}

function createVworldTileUrl(path: string) {
  return `https://api.vworld.kr/req/wmts/vector/${path.replace(
    "{key}",
    VWORLD_API_KEY,
  )}`;
}

function createVworldVectorTileUrl(layer: "poi" | "traffic") {
  return `https://api.vworld.kr/req/wmts/vector/getTile/${VWORLD_API_KEY}/${layer}/{z}/{x}/{y}.pbf`;
}

function createVworldStyle(): StyleSpecification {
  if (!vworldApiKeyExists()) {
    return {
      glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
      layers: [
        {
          id: "background",
          paint: { "background-color": VECTOR_PALETTES.vworld.background },
          type: "background",
        },
      ],
      sources: {},
      version: 8,
    } as StyleSpecification;
  }

  return {
    glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
    layers: [
      {
        id: "background",
        paint: { "background-color": VECTOR_PALETTES.vworld.background },
        type: "background",
      },
      {
        id: "vworld-base-raster",
        source: VWORLD_BASE_SOURCE_ID,
        type: "raster",
      },
      ...VWORLD_TRAFFIC_LINE_LAYERS.map(
        ([sourceLayer, color, width], index) => ({
          id: `vworld-traffic-${index}`,
          paint: {
            "line-color": color,
            "line-opacity": 0.72,
            "line-width": [
              "interpolate",
              ["linear"],
              ["zoom"],
              7,
              width,
              16,
              width * 3,
            ],
          },
          source: VWORLD_TRAFFIC_SOURCE_ID,
          "source-layer": sourceLayer,
          type: "line",
        }),
      ),
      ...VWORLD_POI_SOURCE_LAYERS.map(([sourceLayer, minzoom, maxzoom]) => ({
        id: `vworld-poi-${sourceLayer.slice(-2)}`,
        maxzoom,
        minzoom,
        paint: {
          "circle-color": "#315f8f",
          "circle-opacity": 0.48,
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 2, 16, 5],
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 1,
        },
        source: VWORLD_POI_SOURCE_ID,
        "source-layer": sourceLayer,
        type: "circle",
      })),
    ],
    sources: {
      [VWORLD_BASE_SOURCE_ID]: {
        attribution:
          '<a href="https://www.vworld.kr" target="_blank">&copy; VWorld</a>',
        maxzoom: 19,
        minzoom: 6,
        tileSize: 256,
        tiles: [createVworldTileUrl("{key}/Base/{z}/{x}/{y}.png")],
        type: "raster",
      },
      [VWORLD_POI_SOURCE_ID]: {
        maxzoom: 19,
        minzoom: 6,
        tiles: [createVworldVectorTileUrl("poi")],
        type: "vector",
      },
      [VWORLD_TRAFFIC_SOURCE_ID]: {
        maxzoom: 19,
        minzoom: 6,
        tiles: [createVworldVectorTileUrl("traffic")],
        type: "vector",
      },
    },
    version: 8,
  } as StyleSpecification;
}

function vworldApiKeyExists() {
  return VWORLD_API_KEY.length > 0;
}

function createOsmStyle(): StyleSpecification {
  const palette = VECTOR_PALETTES.osm;

  return {
    glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
    layers: [
      {
        id: "background",
        paint: { "background-color": palette.background },
        type: "background",
      },
      {
        id: "landcover",
        paint: {
          "fill-color": [
            "match",
            ["get", "class"],
            "wood",
            palette.park,
            "grass",
            palette.park,
            "wetland",
            palette.landuse,
            "ice",
            "#eef6ff",
            palette.land,
          ],
          "fill-opacity": 0.85,
        },
        source: OPENFREEMAP_SOURCE_ID,
        "source-layer": "landcover",
        type: "fill",
      },
      {
        id: "landuse",
        minzoom: 7,
        paint: {
          "fill-color": [
            "match",
            ["get", "class"],
            "park",
            palette.park,
            "hospital",
            "#f7d9dd",
            "school",
            "#efe4bd",
            "residential",
            palette.landuse,
            palette.landuse,
          ],
          "fill-opacity": 0.72,
        },
        source: OPENFREEMAP_SOURCE_ID,
        "source-layer": "landuse",
        type: "fill",
      },
      {
        id: "park",
        minzoom: 8,
        paint: {
          "fill-color": palette.park,
          "fill-opacity": 0.78,
        },
        source: OPENFREEMAP_SOURCE_ID,
        "source-layer": "park",
        type: "fill",
      },
      {
        id: "water",
        paint: { "fill-color": palette.water },
        source: OPENFREEMAP_SOURCE_ID,
        "source-layer": "water",
        type: "fill",
      },
      {
        id: "waterway",
        minzoom: 9,
        paint: {
          "line-color": palette.waterLine,
          "line-width": ["interpolate", ["linear"], ["zoom"], 9, 0.5, 15, 2.5],
        },
        source: OPENFREEMAP_SOURCE_ID,
        "source-layer": "waterway",
        type: "line",
      },
      {
        id: "building",
        minzoom: 14,
        paint: {
          "fill-color": palette.building,
          "fill-opacity": 0.72,
        },
        source: OPENFREEMAP_SOURCE_ID,
        "source-layer": "building",
        type: "fill",
      },
      {
        id: "road-casing",
        minzoom: 7,
        paint: {
          "line-color": palette.roadCasing,
          "line-width": ["interpolate", ["linear"], ["zoom"], 7, 1.1, 16, 9],
        },
        source: OPENFREEMAP_SOURCE_ID,
        "source-layer": "transportation",
        type: "line",
      },
      {
        id: "road",
        minzoom: 7,
        paint: {
          "line-color": [
            "match",
            ["get", "class"],
            "motorway",
            palette.roadMajor,
            "trunk",
            palette.roadMajor,
            "primary",
            palette.roadMajor,
            palette.road,
          ],
          "line-width": ["interpolate", ["linear"], ["zoom"], 7, 0.7, 16, 6],
        },
        source: OPENFREEMAP_SOURCE_ID,
        "source-layer": "transportation",
        type: "line",
      },
      {
        id: "boundary",
        paint: {
          "line-color": palette.boundary,
          "line-dasharray": [2, 2],
          "line-opacity": 0.62,
          "line-width": ["interpolate", ["linear"], ["zoom"], 3, 0.6, 12, 1.4],
        },
        source: OPENFREEMAP_SOURCE_ID,
        "source-layer": "boundary",
        type: "line",
      },
      {
        id: "road-label",
        layout: {
          "symbol-placement": "line",
          "text-field": localizedNameExpression(),
          "text-font": ["Noto Sans Regular"],
          "text-size": ["interpolate", ["linear"], ["zoom"], 11, 10, 16, 12],
        },
        minzoom: 12,
        paint: {
          "text-color": palette.text,
          "text-halo-color": palette.textHalo,
          "text-halo-width": 1.2,
        },
        source: OPENFREEMAP_SOURCE_ID,
        "source-layer": "transportation_name",
        type: "symbol",
      },
      {
        id: "place-label",
        layout: {
          "text-field": localizedNameExpression(),
          "text-font": ["Noto Sans Regular"],
          "text-size": [
            "interpolate",
            ["linear"],
            ["zoom"],
            5,
            11,
            12,
            15,
            16,
            18,
          ],
        },
        paint: {
          "text-color": palette.text,
          "text-halo-color": palette.textHalo,
          "text-halo-width": 1.5,
        },
        source: OPENFREEMAP_SOURCE_ID,
        "source-layer": "place",
        type: "symbol",
      },
    ],
    sources: {
      [OPENFREEMAP_SOURCE_ID]: {
        attribution:
          '<a href="https://openfreemap.org" target="_blank">OpenFreeMap</a> <a href="https://www.openmaptiles.org/" target="_blank">&copy; OpenMapTiles</a> Data from <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>',
        type: "vector",
        url: "https://tiles.openfreemap.org/planet",
      },
    },
    version: 8,
  } as StyleSpecification;
}

function createMapStyle(provider: MapProvider): StyleSpecification {
  return provider === "vworld" ? createVworldStyle() : createOsmStyle();
}

function isSourceVisible(
  visibleSources: Partial<Record<DatasetSourceId, boolean>>,
  source: DatasetSourceId,
) {
  return visibleSources[source] ?? source === DEFAULT_VISIBLE_SOURCE;
}

function getPointLimitForZoom(zoom: number) {
  if (zoom < 8) {
    return 600;
  }

  if (zoom < 10) {
    return 1_200;
  }

  if (zoom < 12) {
    return 2_500;
  }

  if (zoom < 14) {
    return 6_000;
  }

  return 16_000;
}

function getViewportFromMap(map: MapLibreMap): PointViewport {
  const bounds = map.getBounds();
  const south = bounds.getSouth();
  const north = bounds.getNorth();
  const west = bounds.getWest();
  const east = bounds.getEast();
  const latitudePadding = Math.max(
    (north - south) * VIEWPORT_POINTS_PADDING_RATIO,
    0.005,
  );
  const longitudePadding = Math.max(
    (east - west) * VIEWPORT_POINTS_PADDING_RATIO,
    0.005,
  );

  return {
    maxLatitude: Math.min(north + latitudePadding, 90),
    maxLongitude: Math.min(east + longitudePadding, 180),
    minLatitude: Math.max(south - latitudePadding, -90),
    minLongitude: Math.max(west - longitudePadding, -180),
    zoom: map.getZoom(),
  };
}

function buildPointsUrl(source: DatasetSourceId, viewport: PointViewport) {
  const searchParams = new URLSearchParams({
    centerLatitude: String((viewport.minLatitude + viewport.maxLatitude) / 2),
    centerLongitude: String(
      (viewport.minLongitude + viewport.maxLongitude) / 2,
    ),
    limit: String(getPointLimitForZoom(viewport.zoom)),
    maxLatitude: String(viewport.maxLatitude),
    maxLongitude: String(viewport.maxLongitude),
    minLatitude: String(viewport.minLatitude),
    minLongitude: String(viewport.minLongitude),
    source,
  });

  return `/api/points?${searchParams.toString()}`;
}

function isMappedPoint(
  point: EmergencyPointMarker,
): point is MappedEmergencyPoint {
  return point.latitude !== null && point.longitude !== null;
}

function isMappedHazardEvent(event: HazardEvent): event is MappedHazardEvent {
  return event.latitude !== null && event.longitude !== null;
}

function isDomesticHazardEvent(event: HazardEvent) {
  if (event.eventType !== "earthquake") {
    return true;
  }

  if (event.latitude === null || event.longitude === null) {
    return false;
  }

  if (/(?:북한|일본|중국|러시아|대만|필리핀|인도네시아)/.test(event.location)) {
    return false;
  }

  return (
    event.latitude >= 32.5 &&
    event.latitude <= 39.5 &&
    event.longitude >= 123.5 &&
    event.longitude <= 132.5
  );
}

function safeKmaImageUrl(value: string | null) {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);

    if (
      url.hostname !== "weather.go.kr" &&
      !url.hostname.endsWith(".weather.go.kr")
    ) {
      return null;
    }

    url.protocol = "https:";

    return url.toString();
  } catch {
    return null;
  }
}

function createPointData(points: EmergencyPointMarker[]) {
  return {
    features: points.filter(isMappedPoint).map((point) => ({
      geometry: {
        coordinates: [point.longitude, point.latitude],
        type: "Point" as const,
      },
      properties: {
        category: point.category,
        iconId: SOURCE_ICON_IDS[point.source],
        id: point.id,
        latitude: point.latitude,
        longitude: point.longitude,
        source: point.source,
      } satisfies PointFeatureProperties,
      type: "Feature" as const,
    })),
    type: "FeatureCollection" as const,
  };
}

function getPolygonCenter(coordinates: number[][][]) {
  const ring = coordinates[0] ?? [];
  let signedArea = 0;
  let centroidX = 0;
  let centroidY = 0;
  let minLongitude = Number.POSITIVE_INFINITY;
  let maxLongitude = Number.NEGATIVE_INFINITY;
  let minLatitude = Number.POSITIVE_INFINITY;
  let maxLatitude = Number.NEGATIVE_INFINITY;

  for (let index = 0; index < ring.length; index += 1) {
    const [longitude, latitude] = ring[index] ?? [];

    if (typeof longitude !== "number" || typeof latitude !== "number") {
      continue;
    }

    minLongitude = Math.min(minLongitude, longitude);
    maxLongitude = Math.max(maxLongitude, longitude);
    minLatitude = Math.min(minLatitude, latitude);
    maxLatitude = Math.max(maxLatitude, latitude);

    const [nextLongitude, nextLatitude] = ring[(index + 1) % ring.length] ?? [];

    if (typeof nextLongitude !== "number" || typeof nextLatitude !== "number") {
      continue;
    }

    const cross = longitude * nextLatitude - nextLongitude * latitude;
    signedArea += cross;
    centroidX += (longitude + nextLongitude) * cross;
    centroidY += (latitude + nextLatitude) * cross;
  }

  if (Math.abs(signedArea) > Number.EPSILON) {
    return [centroidX / (3 * signedArea), centroidY / (3 * signedArea)] as [
      number,
      number,
    ];
  }

  return [
    (minLongitude + maxLongitude) / 2,
    (minLatitude + maxLatitude) / 2,
  ] as [number, number];
}

function createSeoulAreaPointData(areas: SeoulAreasData) {
  return {
    features: areas.features.map((feature) => {
      const [longitude, latitude] = getPolygonCenter(
        feature.geometry.coordinates,
      );
      const populationLabel =
        formatPopulationRangeValues(
          feature.properties.minPopulation,
          feature.properties.maxPopulation,
        ) ?? "";

      return {
        geometry: {
          coordinates: [longitude, latitude],
          type: "Point" as const,
        },
        properties: {
          ...feature.properties,
          latitude,
          longitude,
          populationLabel,
        } satisfies SeoulAreaPointProperties,
        type: "Feature" as const,
      };
    }),
    type: "FeatureCollection" as const,
  };
}

function createHazardData(events: HazardEvent[]) {
  return {
    features: events
      .filter(isDomesticHazardEvent)
      .filter(isMappedHazardEvent)
      .map((event) => ({
        geometry: {
          coordinates: [event.longitude, event.latitude],
          type: "Point" as const,
        },
        properties: {
          depth: event.depth ?? "",
          description: event.description ?? "",
          eventId: event.eventId,
          eventType: event.eventType,
          imageUrl: event.imageUrl ?? "",
          intensity: event.intensity ?? "",
          issuedAt: event.issuedAt ?? "",
          latitude: event.latitude,
          location: event.location,
          longitude: event.longitude,
          magnitude: event.magnitude ?? "",
          occurredAt: event.occurredAt ?? "",
          title: event.title,
        } satisfies HazardFeatureProperties,
        type: "Feature" as const,
      })),
    type: "FeatureCollection" as const,
  };
}

function updateSeoulAreaPopulation(
  areas: SeoulAreasData,
  population: SeoulPopulationStatus,
): SeoulAreasData {
  return {
    ...areas,
    features: areas.features.map((feature) =>
      feature.properties.areaCode === population.areaCode
        ? {
            ...feature,
            properties: {
              ...feature.properties,
              congestionLevel: population.congestionLevel ?? undefined,
              congestionMessage: population.congestionMessage ?? undefined,
              maxPopulation: population.maxPopulation ?? undefined,
              minPopulation: population.minPopulation ?? undefined,
              populationTime:
                population.populationTime ??
                population.sourceUpdatedAt ??
                undefined,
            },
          }
        : feature,
    ),
  };
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}

function formatDateTime(value: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const formatted = new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeZone: "Asia/Seoul",
    timeStyle: "short",
  }).format(date);

  return `${formatted} KST`;
}

function hazardTypeLabel(eventType: HazardEvent["eventType"]) {
  return eventType === "earthquake" ? "지진" : "지진해일";
}

function formatPopulationRangeValues(
  minPopulation: number | null | undefined,
  maxPopulation: number | null | undefined,
) {
  if (typeof minPopulation !== "number" || typeof maxPopulation !== "number") {
    return null;
  }

  return `${minPopulation.toLocaleString(
    "ko-KR",
  )} - ${maxPopulation.toLocaleString("ko-KR")}명`;
}

function formatPopulationRange(population: SeoulPopulationStatus) {
  return formatPopulationRangeValues(
    population.minPopulation,
    population.maxPopulation,
  );
}

function buildKakaoMapUrl(point: EmergencyPointDetail) {
  return `https://map.kakao.com/link/search/${encodeURIComponent(
    point.address,
  )}`;
}

function buildNaverMapUrl(point: EmergencyPointDetail) {
  return `https://map.naver.com/p/search/${encodeURIComponent(point.address)}`;
}

function buildPopupHtml(
  point: EmergencyPointDetail,
  dictionary: AppDictionary,
  sourceLabel: string,
) {
  const rows = [
    [dictionary.map.popup.address, point.address],
    [dictionary.map.popup.phone, point.phone],
    [dictionary.map.popup.sourceUpdatedAt, point.sourceUpdatedAt],
  ].filter((row): row is [string, string] => Boolean(row[1]));
  const rowsHtml = rows
    .map(
      ([label, value]) =>
        `<div class="${styles.popupRow}"><dt>${escapeHtml(
          label,
        )}</dt><dd>${escapeHtml(value)}</dd></div>`,
    )
    .join("");

  return `<article class="${styles.popup}">
    <div class="${styles.popupHeader}">
      <strong>${escapeHtml(`[${point.category}] ${point.name}`)}</strong>
      <span>${escapeHtml(sourceLabel)}</span>
    </div>
    <dl class="${styles.popupDetails}">${rowsHtml}</dl>
    <div class="${styles.popupActions}">
      <a href="${buildNaverMapUrl(point)}" target="_blank" rel="noreferrer">${escapeHtml(
        dictionary.map.popup.naverMap,
      )}</a>
      <a href="${buildKakaoMapUrl(point)}" target="_blank" rel="noreferrer">${escapeHtml(
        dictionary.map.popup.kakaoMap,
      )}</a>
    </div>
  </article>`;
}

function buildSeoulPopulationPopupHtml(
  area: SeoulAreaProperties,
  population: SeoulPopulationStatus | null,
  error: string | null,
) {
  const rows = error
    ? [["상태", error]]
    : [
        ["예상 인원", population ? formatPopulationRange(population) : null],
        ["기준 시각", population?.populationTime],
        ["분류", area.category],
      ];
  const rowsHtml = rows
    .filter((row): row is [string, string] => Boolean(row[1]))
    .map(
      ([label, value]) =>
        `<div class="${styles.popupRow}"><dt>${escapeHtml(
          label,
        )}</dt><dd>${escapeHtml(value)}</dd></div>`,
    )
    .join("");

  return `<article class="${styles.popup}">
    <div class="${styles.popupHeader}">
      <strong>${escapeHtml(`[서울 실시간 인구] ${area.areaName}`)}</strong>
      <span>${escapeHtml(area.category)}</span>
    </div>
    <dl class="${styles.popupDetails}">${rowsHtml}</dl>
  </article>`;
}

function createPointIconImage(source: DatasetSourceId) {
  const canvas = document.createElement("canvas");
  const size = 64;
  const center = size / 2;
  const context = canvas.getContext("2d");

  canvas.width = size;
  canvas.height = size;

  if (!context) {
    return null;
  }

  context.clearRect(0, 0, size, size);
  context.fillStyle = SOURCE_COLORS[source];
  context.strokeStyle = "#ffffff";
  context.lineWidth = 4;
  context.beginPath();
  context.arc(center, 24, 18, Math.PI * 0.92, Math.PI * 2.08);
  context.quadraticCurveTo(center + 19, 41, center, 58);
  context.quadraticCurveTo(center - 19, 41, center - 18, 24);
  context.closePath();
  context.fill();
  context.stroke();
  context.save();
  context.translate(center, 24);
  context.strokeStyle = "#ffffff";
  context.fillStyle = "#ffffff";
  context.lineCap = "round";
  context.lineJoin = "round";
  context.lineWidth = 3.4;

  if (source === "aeds") {
    context.beginPath();
    context.moveTo(0, 9);
    context.bezierCurveTo(-13, 1, -12, -9, -5, -10);
    context.bezierCurveTo(-1, -11, 0, -7, 0, -5);
    context.bezierCurveTo(0, -7, 2, -11, 6, -10);
    context.bezierCurveTo(13, -8, 13, 1, 0, 9);
    context.fill();
    context.strokeStyle = SOURCE_COLORS[source];
    context.lineWidth = 2.5;
    context.beginPath();
    context.moveTo(-5, 0);
    context.lineTo(-1, 0);
    context.lineTo(1, -4);
    context.lineTo(3, 4);
    context.lineTo(5, 0);
    context.lineTo(8, 0);
    context.stroke();
  } else if (source === "fire-stations") {
    context.beginPath();
    context.moveTo(1, -12);
    context.bezierCurveTo(5, -5, 12, -2, 9, 6);
    context.bezierCurveTo(7, 12, -6, 12, -9, 5);
    context.bezierCurveTo(-11, -1, -4, -5, -3, -10);
    context.bezierCurveTo(0, -7, 1, -3, 1, 0);
    context.bezierCurveTo(5, -4, 4, -8, 1, -12);
    context.fill();
  } else if (source === "police-stations") {
    context.beginPath();
    context.moveTo(0, -12);
    context.lineTo(11, -8);
    context.lineTo(9, 3);
    context.quadraticCurveTo(7, 10, 0, 13);
    context.quadraticCurveTo(-7, 10, -9, 3);
    context.lineTo(-11, -8);
    context.closePath();
    context.stroke();
    context.beginPath();
    context.moveTo(0, -6);
    context.lineTo(2, -1);
    context.lineTo(7, -1);
    context.lineTo(3, 2);
    context.lineTo(5, 7);
    context.lineTo(0, 4);
    context.lineTo(-5, 7);
    context.lineTo(-3, 2);
    context.lineTo(-7, -1);
    context.lineTo(-2, -1);
    context.closePath();
    context.fill();
  } else if (source === "childcare-centers") {
    context.beginPath();
    context.arc(0, 0, 11, 0, Math.PI * 2);
    context.stroke();
    context.fillStyle = SOURCE_COLORS[source];
    context.beginPath();
    context.arc(-4, -2, 1.8, 0, Math.PI * 2);
    context.arc(4, -2, 1.8, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.arc(0, 1, 6, 0.15 * Math.PI, 0.85 * Math.PI);
    context.strokeStyle = SOURCE_COLORS[source];
    context.lineWidth = 2.4;
    context.stroke();
  } else if (source === "pharmacies") {
    context.fillRect(-4, -12, 8, 24);
    context.fillRect(-12, -4, 24, 8);
  } else if (source === "hospitals") {
    context.strokeRect(-11, -11, 22, 23);
    context.fillRect(-3, -8, 6, 14);
    context.fillRect(-7, -4, 14, 6);
    context.strokeRect(-3, 7, 6, 5);
  } else if (source === "emergency-medical-institutions") {
    context.beginPath();
    context.moveTo(0, -13);
    context.lineTo(4, -5);
    context.lineTo(12, -7);
    context.lineTo(7, 0);
    context.lineTo(12, 7);
    context.lineTo(4, 5);
    context.lineTo(0, 13);
    context.lineTo(-4, 5);
    context.lineTo(-12, 7);
    context.lineTo(-7, 0);
    context.lineTo(-12, -7);
    context.lineTo(-4, -5);
    context.closePath();
    context.stroke();
    context.fillRect(-2, -8, 4, 16);
    context.fillRect(-8, -2, 16, 4);
  } else if (source === "schools") {
    context.beginPath();
    context.moveTo(-12, -8);
    context.quadraticCurveTo(-5, -10, 0, -5);
    context.quadraticCurveTo(5, -10, 12, -8);
    context.lineTo(12, 9);
    context.quadraticCurveTo(5, 7, 0, 11);
    context.quadraticCurveTo(-5, 7, -12, 9);
    context.closePath();
    context.stroke();
    context.beginPath();
    context.moveTo(0, -5);
    context.lineTo(0, 11);
    context.stroke();
  } else {
    context.beginPath();
    context.moveTo(-14, -5);
    context.lineTo(0, -12);
    context.lineTo(14, -5);
    context.lineTo(0, 2);
    context.closePath();
    context.fill();
    context.beginPath();
    context.moveTo(-8, 0);
    context.lineTo(-8, 7);
    context.quadraticCurveTo(0, 12, 8, 7);
    context.lineTo(8, 0);
    context.stroke();
    context.beginPath();
    context.moveTo(14, -5);
    context.lineTo(14, 7);
    context.stroke();
  }

  context.restore();

  return context.getImageData(0, 0, size, size);
}

function ensurePointIcons(map: MapLibreMap) {
  for (const source of Object.keys(SOURCE_ICON_IDS) as DatasetSourceId[]) {
    const iconId = SOURCE_ICON_IDS[source];

    if (map.hasImage(iconId)) {
      continue;
    }

    const image = createPointIconImage(source);

    if (image) {
      map.addImage(iconId, image, { pixelRatio: 2 });
    }
  }
}

function syncPointLayer(map: MapLibreMap, points: EmergencyPointMarker[]) {
  if (!map.isStyleLoaded()) {
    return;
  }

  ensurePointIcons(map);

  const pointData = createPointData(points);
  const source = map.getSource(POINTS_SOURCE_ID) as GeoJSONSource | undefined;

  if (source) {
    source.setData(pointData);
  } else {
    map.addSource(POINTS_SOURCE_ID, {
      data: pointData,
      type: "geojson",
    });
  }

  if (!map.getLayer(POINTS_HALO_LAYER_ID)) {
    map.addLayer({
      id: POINTS_HALO_LAYER_ID,
      paint: {
        "circle-color": [
          "match",
          ["get", "source"],
          "fire-stations",
          SOURCE_HALO_COLORS["fire-stations"],
          "police-stations",
          SOURCE_HALO_COLORS["police-stations"],
          "aeds",
          SOURCE_HALO_COLORS.aeds,
          "childcare-centers",
          SOURCE_HALO_COLORS["childcare-centers"],
          "pharmacies",
          SOURCE_HALO_COLORS.pharmacies,
          "hospitals",
          SOURCE_HALO_COLORS.hospitals,
          "emergency-medical-institutions",
          SOURCE_HALO_COLORS["emergency-medical-institutions"],
          "schools",
          SOURCE_HALO_COLORS.schools,
          "universities",
          SOURCE_HALO_COLORS.universities,
          "#6b7280",
        ],
        "circle-opacity": 0.2,
        "circle-radius": POINT_HALO_RADIUS,
      },
      source: POINTS_SOURCE_ID,
      type: "circle",
    });
  }

  if (!map.getLayer(POINTS_LAYER_ID)) {
    map.addLayer({
      id: POINTS_LAYER_ID,
      paint: {
        "circle-color": "#ffffff",
        "circle-opacity": 0,
        "circle-radius": POINT_HIT_RADIUS,
      },
      source: POINTS_SOURCE_ID,
      type: "circle",
    });
  }

  if (!map.getLayer(POINTS_SYMBOL_LAYER_ID)) {
    map.addLayer({
      id: POINTS_SYMBOL_LAYER_ID,
      layout: {
        "icon-allow-overlap": true,
        "icon-anchor": "bottom",
        "icon-image": ["get", "iconId"],
        "icon-size": POINT_ICON_SIZE,
      },
      source: POINTS_SOURCE_ID,
      type: "symbol",
    });
  }
}

function syncPointLayerWhenReady(
  map: MapLibreMap,
  points: EmergencyPointMarker[],
) {
  if (map.isStyleLoaded()) {
    syncPointLayer(map, points);
    return;
  }

  runWhenStyleReady(map, () => syncPointLayer(map, points));
}

function syncSeoulAreaLayer(map: MapLibreMap, areas: SeoulAreasData | null) {
  if (!areas || !map.isStyleLoaded()) {
    return;
  }

  const areaData = createSeoulAreaPointData(areas);
  const source = map.getSource(SEOUL_AREAS_SOURCE_ID) as
    | GeoJSONSource
    | undefined;

  if (source) {
    source.setData(areaData);
  } else {
    map.addSource(SEOUL_AREAS_SOURCE_ID, {
      data: areaData,
      type: "geojson",
    });
  }

  if (!map.getLayer(SEOUL_AREAS_HALO_LAYER_ID)) {
    map.addLayer({
      id: SEOUL_AREAS_HALO_LAYER_ID,
      paint: {
        "circle-color": [
          "match",
          ["get", "congestionLevel"],
          "붐빔",
          "#dc2626",
          "약간 붐빔",
          "#f97316",
          "보통",
          "#eab308",
          "여유",
          "#16a34a",
          "#2563eb",
        ],
        "circle-opacity": ["case", ["has", "congestionLevel"], 0.2, 0.1],
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 9, 12, 14, 24],
      },
      source: SEOUL_AREAS_SOURCE_ID,
      type: "circle",
    });
  }

  if (!map.getLayer(SEOUL_AREAS_LAYER_ID)) {
    map.addLayer({
      id: SEOUL_AREAS_LAYER_ID,
      paint: {
        "circle-color": [
          "match",
          ["get", "congestionLevel"],
          "붐빔",
          "#dc2626",
          "약간 붐빔",
          "#f97316",
          "보통",
          "#eab308",
          "여유",
          "#16a34a",
          "#2563eb",
        ],
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 9, 5, 14, 9],
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 1.6,
      },
      source: SEOUL_AREAS_SOURCE_ID,
      type: "circle",
    });
  }

  if (!map.getLayer(SEOUL_AREAS_SYMBOL_LAYER_ID)) {
    map.addLayer({
      id: SEOUL_AREAS_SYMBOL_LAYER_ID,
      layout: {
        "text-allow-overlap": false,
        "text-field": ["get", "populationLabel"],
        "text-font": ["Noto Sans Regular"],
        "text-offset": [0, 1],
        "text-size": ["interpolate", ["linear"], ["zoom"], 10, 10, 14, 12],
      },
      paint: {
        "text-color": "#1f2937",
        "text-halo-color": "#ffffff",
        "text-halo-width": 1.4,
      },
      source: SEOUL_AREAS_SOURCE_ID,
      type: "symbol",
    });
  }
}

function syncSeoulAreaLayerWhenReady(
  map: MapLibreMap,
  areas: SeoulAreasData | null,
) {
  if (map.isStyleLoaded()) {
    syncSeoulAreaLayer(map, areas);
    return;
  }

  runWhenStyleReady(map, () => syncSeoulAreaLayer(map, areas));
}

function syncHazardLayer(map: MapLibreMap, events: HazardEvent[]) {
  if (!map.isStyleLoaded()) {
    return;
  }

  const eventData = createHazardData(events);
  const source = map.getSource(HAZARDS_SOURCE_ID) as GeoJSONSource | undefined;

  if (source) {
    source.setData(eventData);
  } else {
    map.addSource(HAZARDS_SOURCE_ID, {
      data: eventData,
      type: "geojson",
    });
  }

  if (!map.getLayer(HAZARDS_HALO_LAYER_ID)) {
    map.addLayer({
      id: HAZARDS_HALO_LAYER_ID,
      paint: {
        "circle-color": [
          "match",
          ["get", "eventType"],
          "earthquake",
          "#f59e0b",
          "tsunami",
          "#06b6d4",
          "#ef4444",
        ],
        "circle-opacity": 0.24,
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 4, 12, 12, 30],
      },
      source: HAZARDS_SOURCE_ID,
      type: "circle",
    });
  }

  if (!map.getLayer(HAZARDS_LAYER_ID)) {
    map.addLayer({
      id: HAZARDS_LAYER_ID,
      paint: {
        "circle-color": [
          "match",
          ["get", "eventType"],
          "earthquake",
          "#d97706",
          "tsunami",
          "#0891b2",
          "#dc2626",
        ],
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 4, 7, 12, 12],
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 2,
      },
      source: HAZARDS_SOURCE_ID,
      type: "circle",
    });
  }
}

function syncHazardLayerWhenReady(map: MapLibreMap, events: HazardEvent[]) {
  if (map.isStyleLoaded()) {
    syncHazardLayer(map, events);
    return;
  }

  runWhenStyleReady(map, () => syncHazardLayer(map, events));
}

function syncEmergencyRouteLayer(
  map: MapLibreMap,
  route: EmergencyRouteResult | null,
) {
  if (!map.isStyleLoaded()) {
    return;
  }

  const data = {
    features: route
      ? [
          {
            geometry: {
              coordinates: route.coordinates,
              type: "LineString" as const,
            },
            properties: { provider: route.provider },
            type: "Feature" as const,
          },
        ]
      : [],
    type: "FeatureCollection",
  } as const;
  const source = map.getSource(EMERGENCY_ROUTE_SOURCE_ID) as
    | GeoJSONSource
    | undefined;

  if (source) {
    source.setData(data);
  } else {
    map.addSource(EMERGENCY_ROUTE_SOURCE_ID, { data, type: "geojson" });
  }

  if (!map.getLayer(EMERGENCY_ROUTE_LAYER_ID)) {
    map.addLayer({
      id: EMERGENCY_ROUTE_LAYER_ID,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": [
          "match",
          ["get", "provider"],
          "kakao",
          "#7c3aed",
          "#dc2626",
        ],
        "line-opacity": 0.9,
        "line-width": ["interpolate", ["linear"], ["zoom"], 8, 4, 15, 7],
      },
      source: EMERGENCY_ROUTE_SOURCE_ID,
      type: "line",
    });
  }
}

function syncEmergencyRouteLayerWhenReady(
  map: MapLibreMap,
  route: EmergencyRouteResult | null,
) {
  if (map.isStyleLoaded()) {
    syncEmergencyRouteLayer(map, route);
    return;
  }

  runWhenStyleReady(map, () => syncEmergencyRouteLayer(map, route));
}

function runWhenStyleReady(map: MapLibreMap, callback: () => void) {
  let didRun = false;
  const run = () => {
    if (didRun || !map.isStyleLoaded()) {
      return;
    }

    didRun = true;
    callback();
  };

  map.once("style.load", run);
  map.once("idle", run);
}

export function MapShell({ dictionary, initialProvider }: MapShellProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const providerMenuRef = useRef<HTMLDivElement>(null);
  const mobileProviderMenuRef = useRef<HTMLDivElement>(null);
  const sourceMenuRef = useRef<HTMLDivElement>(null);
  const sourceSearchInputRef = useRef<HTMLInputElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const popupRef = useRef<import("maplibre-gl").Popup | null>(null);
  const pointsRef = useRef<EmergencyPointMarker[]>([]);
  const hazardsRef = useRef<HazardEvent[]>([]);
  const seoulAreasRef = useRef<SeoulAreasData | null>(null);
  const emergencyRouteRef = useRef<EmergencyRouteResult | null>(null);
  const sourceLabelsRef = useRef<Map<DatasetSourceId, string>>(new Map());
  const knownHazardIdsRef = useRef<Set<string>>(new Set());
  const initialStyleRef = useRef<StyleSpecification>(
    createMapStyle(initialProvider),
  );
  const [provider, setProvider] = useState<MapProvider>(initialProvider);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSourceMenuOpen, setIsSourceMenuOpen] = useState(false);
  const [points, setPoints] = useState<EmergencyPointMarker[]>([]);
  const [datasets, setDatasets] = useState<DatasetStatus[]>([]);
  const [hazards, setHazards] = useState<HazardEvent[]>([]);
  const [seoulAreas, setSeoulAreas] = useState<SeoulAreasData | null>(null);
  const [activeHazard, setActiveHazard] = useState<HazardEvent | null>(null);
  const [isEmergencyPanelOpen, setIsEmergencyPanelOpen] = useState(false);
  const [emergencyOrigin, setEmergencyOrigin] = useState({
    latitude: SEOUL_CENTER[0],
    longitude: SEOUL_CENTER[1],
  });
  const [emergencyRoute, setEmergencyRoute] =
    useState<EmergencyRouteResult | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isMapReady, setIsMapReady] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [autoFocusHazards, setAutoFocusHazards] = useState(true);
  const [sourceQuery, setSourceQuery] = useState("");
  const [visibleSources, setVisibleSources] = useState<
    Partial<Record<DatasetSourceId, boolean>>
  >({});

  const activeProvider = provider;
  const selectedProviderConfig = PROVIDERS[provider];
  const SelectedProviderIcon = selectedProviderConfig.icon;
  const selectedProviderLabel =
    dictionary.map.providers[selectedProviderConfig.labelKey];
  const visiblePoints = useMemo(
    () =>
      points.filter((point) => isSourceVisible(visibleSources, point.source)),
    [points, visibleSources],
  );
  const mappedPointCount = visiblePoints.filter(isMappedPoint).length;
  const latestFetchedAt = useMemo(() => {
    const fetchedDates = datasets
      .map((dataset) => dataset.fetchedAt)
      .filter((value): value is string => Boolean(value))
      .sort();

    return fetchedDates.at(-1) ?? null;
  }, [datasets]);
  const sourcePointCounts = useMemo(() => {
    const counts = new Map<DatasetSourceId, number>();

    for (const point of points) {
      counts.set(point.source, (counts.get(point.source) ?? 0) + 1);
    }

    return counts;
  }, [points]);
  const filteredDatasets = useMemo(() => {
    const query = sourceQuery.trim().toLowerCase();

    if (!query) {
      return datasets;
    }

    return datasets.filter((dataset) =>
      [dataset.id, dataset.label].some((value) =>
        value.toLowerCase().includes(query),
      ),
    );
  }, [datasets, sourceQuery]);
  useEffect(() => {
    sourceLabelsRef.current = new Map(
      datasets.map((dataset) => [dataset.id, dataset.label]),
    );
  }, [datasets]);
  const selectedDatasetCount = datasets.filter((dataset) =>
    isSourceVisible(visibleSources, dataset.id),
  ).length;
  const activeHazardImageUrl = safeKmaImageUrl(activeHazard?.imageUrl ?? null);

  function openSourceSearch() {
    setIsSourceMenuOpen(true);
    window.setTimeout(() => sourceSearchInputRef.current?.focus(), 0);
  }

  function renderProviderDropdown(className: string) {
    if (!isMenuOpen) {
      return null;
    }

    return (
      <div className={className} role="menu">
        {(Object.keys(PROVIDERS) as MapProvider[]).map((providerKey) => {
          const providerConfig = PROVIDERS[providerKey];
          const Icon = providerConfig.icon;
          const providerLabel =
            dictionary.map.providers[providerConfig.labelKey];

          return (
            <button
              aria-checked={provider === providerKey}
              className={styles.providerItem}
              key={providerKey}
              onClick={() => {
                setProvider(providerKey);
                setIsMenuOpen(false);
              }}
              role="menuitemradio"
              type="button"
            >
              <Icon aria-hidden="true" size={16} strokeWidth={2.4} />
              <span>{providerLabel}</span>
              {provider === providerKey ? (
                <Check aria-hidden="true" size={15} strokeWidth={2.6} />
              ) : null}
            </button>
          );
        })}
      </div>
    );
  }

  const refreshData = useCallback(async () => {
    const [datasetsResponse, hazardsResponse, seoulResponse] =
      await Promise.all([
        fetch("/api/datasets", { cache: "no-store" }),
        fetch("/api/hazards", { cache: "no-store" }),
        fetch("/data/seoul-citydata-areas.geojson", { cache: "no-store" }),
      ]);

    if (!datasetsResponse.ok || !hazardsResponse.ok || !seoulResponse.ok) {
      throw new Error("Failed to load map data");
    }

    const datasetsPayload = (await datasetsResponse.json()) as DatasetsResponse;
    const hazardsPayload = (await hazardsResponse.json()) as HazardsResponse;
    const seoulPayload = (await seoulResponse.json()) as SeoulAreasData;

    setDatasets(datasetsPayload.datasets);
    setHazards(hazardsPayload.events);
    setSeoulAreas(seoulPayload);
  }, []);

  const refreshPointsForViewport = useCallback(async () => {
    const map = mapRef.current;

    if (!map || datasets.length === 0) {
      return;
    }

    const selectedSources = datasets
      .filter((dataset) => isSourceVisible(visibleSources, dataset.id))
      .map((dataset) => dataset.id);

    if (selectedSources.length === 0) {
      setPoints([]);
      return;
    }

    const viewport = getViewportFromMap(map);
    const responses = await Promise.all(
      selectedSources.map((source) =>
        fetch(buildPointsUrl(source, viewport), { cache: "no-store" }),
      ),
    );

    if (responses.some((response) => !response.ok)) {
      throw new Error("Failed to load viewport points");
    }

    const payloads = (await Promise.all(
      responses.map((response) => response.json()),
    )) as PointsResponse[];

    setPoints(payloads.flatMap((payload) => payload.points));
    setDataError(null);
  }, [datasets, visibleSources]);

  const focusHazard = useCallback((event: HazardEvent) => {
    setActiveHazard(event);

    if (
      !isDomesticHazardEvent(event) ||
      event.latitude === null ||
      event.longitude === null ||
      !mapRef.current
    ) {
      return;
    }

    const map = mapRef.current;
    map.flyTo({
      center: [event.longitude, event.latitude],
      essential: true,
      zoom: Math.max(map.getZoom(), 8),
    });
  }, []);

  const refreshHazards = useCallback(async () => {
    const response = await fetch("/api/hazards", { cache: "no-store" });

    if (!response.ok) {
      throw new Error("Failed to load hazard events");
    }

    const payload = (await response.json()) as HazardsResponse;
    const previousIds = knownHazardIdsRef.current;
    const nextIds = new Set(payload.events.map((event) => event.eventId));
    const newEvent = payload.events.find(
      (event) =>
        !previousIds.has(event.eventId) && isDomesticHazardEvent(event),
    );

    setHazards(payload.events);
    knownHazardIdsRef.current = nextIds;

    if (newEvent && previousIds.size > 0 && autoFocusHazards) {
      focusHazard(newEvent);
    }
  }, [autoFocusHazards, focusHazard]);

  useEffect(() => {
    let isDisposed = false;

    refreshData()
      .catch((error) => {
        if (!isDisposed) {
          setDataError(error instanceof Error ? error.message : String(error));
        }
      })
      .finally(() => {
        if (!isDisposed) {
          setIsLoadingData(false);
        }
      });

    return () => {
      isDisposed = true;
    };
  }, [refreshData]);

  useEffect(() => {
    const storedValue = window.localStorage.getItem(HAZARD_AUTO_FOCUS_KEY);

    if (storedValue !== null) {
      setAutoFocusHazards(storedValue === "true");
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      HAZARD_AUTO_FOCUS_KEY,
      String(autoFocusHazards),
    );
  }, [autoFocusHazards]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      refreshHazards().catch(() => {});
    }, HAZARD_POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [refreshHazards]);

  useEffect(() => {
    if (datasets.length === 0) {
      return;
    }

    setVisibleSources((current) => {
      const next: Partial<Record<DatasetSourceId, boolean>> = {};

      for (const dataset of datasets) {
        next[dataset.id] =
          current[dataset.id] ?? dataset.id === DEFAULT_VISIBLE_SOURCE;
      }

      return next;
    });
  }, [datasets]);

  useEffect(() => {
    if (!isMapReady) {
      return;
    }

    let timeoutId: number | undefined;
    const map = mapRef.current;

    function scheduleRefresh() {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }

      timeoutId = window.setTimeout(() => {
        refreshPointsForViewport().catch((error) => {
          setDataError(error instanceof Error ? error.message : String(error));
        });
      }, 180);
    }

    scheduleRefresh();

    if (!map) {
      return () => {
        if (timeoutId) {
          window.clearTimeout(timeoutId);
        }
      };
    }

    map.on("moveend", scheduleRefresh);
    map.on("zoomend", scheduleRefresh);

    return () => {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }

      map.off("moveend", scheduleRefresh);
      map.off("zoomend", scheduleRefresh);
    };
  }, [isMapReady, refreshPointsForViewport]);

  useEffect(() => {
    hazardsRef.current = hazards;

    if (knownHazardIdsRef.current.size === 0 && hazards.length > 0) {
      knownHazardIdsRef.current = new Set(
        hazards.map((event) => event.eventId),
      );
    }

    if (!mapRef.current) {
      return;
    }

    syncHazardLayerWhenReady(mapRef.current, hazards);
  }, [hazards]);

  useEffect(() => {
    seoulAreasRef.current = seoulAreas;

    if (!mapRef.current) {
      return;
    }

    syncSeoulAreaLayerWhenReady(mapRef.current, seoulAreas);
  }, [seoulAreas]);

  useEffect(() => {
    pointsRef.current = visiblePoints;

    if (!mapRef.current) {
      return;
    }

    syncPointLayerWhenReady(mapRef.current, visiblePoints);
  }, [visiblePoints]);

  useEffect(() => {
    emergencyRouteRef.current = emergencyRoute;

    if (!mapRef.current) {
      return;
    }

    syncEmergencyRouteLayerWhenReady(mapRef.current, emergencyRoute);

    if (!emergencyRoute || emergencyRoute.coordinates.length < 2) {
      return;
    }

    const longitudes = emergencyRoute.coordinates.map(
      ([longitude]) => longitude,
    );
    const latitudes = emergencyRoute.coordinates.map(
      ([, latitude]) => latitude,
    );
    mapRef.current.fitBounds(
      [
        [Math.min(...longitudes), Math.min(...latitudes)],
        [Math.max(...longitudes), Math.max(...latitudes)],
      ],
      { duration: 800, padding: 72 },
    );
  }, [emergencyRoute]);

  useEffect(() => {
    let isDisposed = false;

    async function initializeMap() {
      if (!mapContainerRef.current || mapRef.current) {
        return;
      }

      const maplibre = await import("maplibre-gl");

      if (isDisposed || !mapContainerRef.current || mapRef.current) {
        return;
      }

      const map = new maplibre.Map({
        attributionControl: {
          compact: true,
        },
        center: MAP_CENTER,
        container: mapContainerRef.current,
        style: initialStyleRef.current,
        zoom: DEFAULT_ZOOM,
      });

      mapRef.current = map;

      map.addControl(
        new maplibre.NavigationControl({
          showCompass: false,
        }),
        "top-right",
      );

      async function showPointPopup(feature: MapGeoJSONFeature) {
        const coordinates = (
          feature?.geometry.type === "Point"
            ? feature.geometry.coordinates
            : null
        ) as [number, number] | null;

        if (!feature?.properties || !coordinates) {
          return;
        }

        const point = feature.properties as PointFeatureProperties;
        const response = await fetch(`/api/points/${point.id}`, {
          cache: "no-store",
        });

        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as PointDetailResponse;
        popupRef.current?.remove();
        popupRef.current = new maplibre.Popup({
          closeButton: true,
          maxWidth: "320px",
          offset: 16,
        })
          .setLngLat(coordinates)
          .setHTML(
            buildPopupHtml(
              payload.point,
              dictionary,
              sourceLabelsRef.current.get(payload.point.source) ??
                payload.point.source,
            ),
          )
          .addTo(map);
      }

      async function showSeoulPopulationPopup(
        feature: MapGeoJSONFeature,
        longitude: number,
        latitude: number,
      ) {
        if (!feature?.properties) {
          return;
        }

        const area = feature.properties as SeoulAreaProperties;
        const response = await fetch(
          `/api/seoul/population?areaCode=${encodeURIComponent(area.areaCode)}`,
          { cache: "no-store" },
        );
        const payload = (await response
          .json()
          .catch(() => ({}))) as SeoulPopulationResponse;
        const population = response.ok ? (payload.population ?? null) : null;

        if (population) {
          setSeoulAreas((current) =>
            current ? updateSeoulAreaPopulation(current, population) : current,
          );
        }

        popupRef.current?.remove();
        popupRef.current = new maplibre.Popup({
          closeButton: true,
          maxWidth: "340px",
          offset: 12,
        })
          .setLngLat([longitude, latitude])
          .setHTML(
            buildSeoulPopulationPopupHtml(
              area,
              population,
              population ? null : (payload.error ?? "실시간 인구 조회 실패"),
            ),
          )
          .addTo(map);
      }

      map.on("click", async (event: MapLayerMouseEvent) => {
        const layers = [
          POINTS_SYMBOL_LAYER_ID,
          POINTS_LAYER_ID,
          SEOUL_AREAS_SYMBOL_LAYER_ID,
          SEOUL_AREAS_LAYER_ID,
          SEOUL_AREAS_HALO_LAYER_ID,
          HAZARDS_LAYER_ID,
        ].filter((layerId) => map.getLayer(layerId));

        if (layers.length === 0) {
          return;
        }

        const feature = map.queryRenderedFeatures(event.point, { layers })[0] as
          | MapGeoJSONFeature
          | undefined;

        if (!feature?.properties) {
          return;
        }

        if (
          feature.layer.id === POINTS_LAYER_ID ||
          feature.layer.id === POINTS_SYMBOL_LAYER_ID
        ) {
          await showPointPopup(feature);
          return;
        }

        if (
          feature.layer.id === SEOUL_AREAS_HALO_LAYER_ID ||
          feature.layer.id === SEOUL_AREAS_LAYER_ID ||
          feature.layer.id === SEOUL_AREAS_SYMBOL_LAYER_ID
        ) {
          await showSeoulPopulationPopup(
            feature,
            event.lngLat.lng,
            event.lngLat.lat,
          );
          return;
        }

        const eventId = String(
          (feature.properties as HazardFeatureProperties).eventId,
        );
        const hazard = hazardsRef.current.find(
          (current) => current.eventId === eventId,
        );

        if (hazard) {
          focusHazard(hazard);
        }
      });

      map.on("mouseenter", POINTS_LAYER_ID, () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", POINTS_LAYER_ID, () => {
        map.getCanvas().style.cursor = "";
      });
      map.on("mouseenter", POINTS_SYMBOL_LAYER_ID, () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", POINTS_SYMBOL_LAYER_ID, () => {
        map.getCanvas().style.cursor = "";
      });
      map.on("mouseenter", SEOUL_AREAS_HALO_LAYER_ID, () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", SEOUL_AREAS_HALO_LAYER_ID, () => {
        map.getCanvas().style.cursor = "";
      });
      map.on("mouseenter", SEOUL_AREAS_LAYER_ID, () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", SEOUL_AREAS_LAYER_ID, () => {
        map.getCanvas().style.cursor = "";
      });
      map.on("mouseenter", SEOUL_AREAS_SYMBOL_LAYER_ID, () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", SEOUL_AREAS_SYMBOL_LAYER_ID, () => {
        map.getCanvas().style.cursor = "";
      });
      map.on("mouseenter", HAZARDS_LAYER_ID, () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", HAZARDS_LAYER_ID, () => {
        map.getCanvas().style.cursor = "";
      });

      map.once("load", () => {
        setIsMapReady(true);
        syncSeoulAreaLayerWhenReady(map, seoulAreasRef.current);
        syncPointLayerWhenReady(map, pointsRef.current);
        syncHazardLayerWhenReady(map, hazardsRef.current);
        syncEmergencyRouteLayerWhenReady(map, emergencyRouteRef.current);
      });
    }

    initializeMap();

    return () => {
      isDisposed = true;
      popupRef.current?.remove();
      mapRef.current?.remove();
      mapRef.current = null;
      setIsMapReady(false);
    };
  }, [dictionary, focusHazard]);

  useEffect(() => {
    if (!mapRef.current) {
      return;
    }

    const map = mapRef.current;
    let isDisposed = false;
    let timeoutId: number | undefined;

    async function updateStyle() {
      const style = createMapStyle(activeProvider);
      const syncOverlays = () => {
        map.resize();
        syncSeoulAreaLayerWhenReady(map, seoulAreasRef.current);
        syncPointLayerWhenReady(map, pointsRef.current);
        syncHazardLayerWhenReady(map, hazardsRef.current);
        syncEmergencyRouteLayerWhenReady(map, emergencyRouteRef.current);
      };

      if (isDisposed) {
        return;
      }

      map.setStyle(style);

      timeoutId = window.setTimeout(() => {
        syncOverlays();
      }, STYLE_LOAD_TIMEOUT_MS);

      map.once("style.load", () => {
        if (timeoutId) {
          window.clearTimeout(timeoutId);
        }
        syncOverlays();
      });
    }

    updateStyle();

    return () => {
      isDisposed = true;
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [activeProvider]);

  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }

    function closeMenu(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        (providerMenuRef.current?.contains(event.target) ||
          mobileProviderMenuRef.current?.contains(event.target))
      ) {
        return;
      }

      setIsMenuOpen(false);
    }

    window.addEventListener("pointerdown", closeMenu);

    return () => {
      window.removeEventListener("pointerdown", closeMenu);
    };
  }, [isMenuOpen]);

  useEffect(() => {
    if (!isSourceMenuOpen) {
      return;
    }

    function closeMenu(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        sourceMenuRef.current?.contains(event.target)
      ) {
        return;
      }

      setIsSourceMenuOpen(false);
    }

    window.addEventListener("pointerdown", closeMenu);

    return () => {
      window.removeEventListener("pointerdown", closeMenu);
    };
  }, [isSourceMenuOpen]);

  function openEmergencyPanel() {
    const center = mapRef.current?.getCenter();

    if (center) {
      setEmergencyOrigin({ latitude: center.lat, longitude: center.lng });
    }

    setIsEmergencyPanelOpen(true);
  }

  return (
    <div className={styles.page}>
      <nav className={styles.navbar} aria-label={dictionary.navigation.label}>
        <a className={styles.brandLink} href="/">
          <span className={styles.brandMark}>
            <HeartPulse aria-hidden="true" size={20} strokeWidth={2.7} />
          </span>
          <span>Platelets</span>
        </a>
        <div className={styles.desktopLinks}>
          <a className={styles.desktopLinkActive} href="/">
            지도
          </a>
          <a className={styles.desktopLink} href="/licenses">
            라이선스
          </a>
          <a className={styles.desktopLink} href="/ai">
            AI 분석
          </a>
          <a className={styles.desktopLink} href="/admin">
            관리자
          </a>
        </div>
        <div className={styles.navActions}>
          <button
            className={styles.navSearchButton}
            onClick={openSourceSearch}
            type="button"
          >
            <Search aria-hidden="true" size={18} strokeWidth={2.2} />
            <span>시설 검색</span>
          </button>
          <div className={styles.providerMenu} ref={providerMenuRef}>
            <button
              aria-expanded={isMenuOpen}
              aria-haspopup="menu"
              aria-label={dictionary.map.providerMenuLabel.replace(
                "{provider}",
                selectedProviderLabel,
              )}
              className={styles.providerButton}
              onClick={() => setIsMenuOpen((current) => !current)}
              title={selectedProviderLabel}
              type="button"
            >
              <SelectedProviderIcon
                aria-hidden="true"
                size={18}
                strokeWidth={2.5}
              />
              <ChevronDown aria-hidden="true" size={14} strokeWidth={2.5} />
            </button>
            {renderProviderDropdown(styles.providerDropdown)}
          </div>
        </div>
      </nav>

      <main className={styles.main}>
        <div
          aria-label={dictionary.map.ariaLabel}
          className={styles.map}
          ref={mapContainerRef}
          role="application"
        />
        <button
          className={styles.emergencyLauncher}
          onClick={openEmergencyPanel}
          type="button"
        >
          <Ambulance aria-hidden="true" size={18} strokeWidth={2.5} />
          <span>응급 출동·이송</span>
        </button>
        {isEmergencyPanelOpen ? (
          <EmergencyRoutingPanel
            onClose={() => setIsEmergencyPanelOpen(false)}
            onRoute={setEmergencyRoute}
            origin={emergencyOrigin}
          />
        ) : null}
        <div className={styles.sourceMenu} ref={sourceMenuRef}>
          <button
            aria-expanded={isSourceMenuOpen}
            aria-haspopup="true"
            aria-label={dictionary.map.datasets.sourceMenuLabel}
            className={styles.sourceMenuButton}
            onClick={() => setIsSourceMenuOpen((current) => !current)}
            title={dictionary.map.datasets.sourceMenuLabel}
            type="button"
          >
            <ListFilter aria-hidden="true" size={18} strokeWidth={2.5} />
            <span>
              {selectedDatasetCount.toLocaleString("ko-KR")}/
              {datasets.length.toLocaleString("ko-KR")}
            </span>
          </button>
          {isSourceMenuOpen ? (
            <fieldset className={styles.sourceDropdown}>
              <legend className={styles.sourceLegend}>
                {dictionary.map.datasets.sourceMenuTitle}
              </legend>
              <label className={styles.sourceSearch}>
                <Search aria-hidden="true" size={15} strokeWidth={2.4} />
                <span>표시 항목 검색</span>
                <input
                  onChange={(event) => setSourceQuery(event.target.value)}
                  placeholder="검색"
                  ref={sourceSearchInputRef}
                  type="search"
                  value={sourceQuery}
                />
              </label>
              <div className={styles.sourceList}>
                {filteredDatasets.map((dataset) => (
                  <label className={styles.sourceItem} key={dataset.id}>
                    <input
                      checked={isSourceVisible(visibleSources, dataset.id)}
                      onChange={() =>
                        setVisibleSources((current) => ({
                          ...current,
                          [dataset.id]: !isSourceVisible(current, dataset.id),
                        }))
                      }
                      type="checkbox"
                    />
                    <span>{dataset.label}</span>
                    <small>
                      {(
                        dataset.geocodedCount ||
                        sourcePointCounts.get(dataset.id) ||
                        0
                      ).toLocaleString("ko-KR")}
                    </small>
                  </label>
                ))}
                {filteredDatasets.length === 0 ? (
                  <p className={styles.sourceEmpty}>검색 결과가 없습니다.</p>
                ) : null}
              </div>
              <label className={styles.settingItem}>
                <input
                  checked={autoFocusHazards}
                  onChange={(event) =>
                    setAutoFocusHazards(event.target.checked)
                  }
                  type="checkbox"
                />
                <Settings aria-hidden="true" size={15} strokeWidth={2.4} />
                <span>이벤트 발생 시 지도 이동</span>
              </label>
            </fieldset>
          ) : null}
        </div>
        <section
          aria-label={dictionary.map.datasets.panelLabel}
          className={styles.datasetPanel}
        >
          <div className={styles.datasetStats}>
            <span className={styles.datasetMetric}>
              <MapPin aria-hidden="true" size={16} strokeWidth={2.4} />
              <span>{mappedPointCount.toLocaleString("ko-KR")}</span>
              <span>{dictionary.map.datasets.points}</span>
            </span>
            <span className={styles.datasetMetric}>
              <Database aria-hidden="true" size={16} strokeWidth={2.4} />
              <span>{dictionary.map.datasets.lastUpdated}</span>
              <span>
                {formatDateTime(latestFetchedAt) ??
                  dictionary.map.datasets.neverUpdated}
              </span>
            </span>
            <span className={styles.datasetMetric}>
              <AlertTriangle aria-hidden="true" size={16} strokeWidth={2.4} />
              <span>{hazards.length.toLocaleString("ko-KR")}</span>
              <span>최근 이벤트</span>
            </span>
          </div>

          {isLoadingData || dataError ? (
            <output className={styles.dataNotice}>
              {dataError ?? dictionary.map.datasets.loading}
            </output>
          ) : null}
        </section>
        {activeHazard ? (
          <div className={styles.modalBackdrop} role="presentation">
            <section
              aria-labelledby="hazard-modal-title"
              aria-modal="true"
              className={styles.hazardModal}
              role="dialog"
            >
              <div className={styles.hazardHeader}>
                <div>
                  <span>{hazardTypeLabel(activeHazard.eventType)}</span>
                  <h2 id="hazard-modal-title">{activeHazard.title}</h2>
                </div>
                <button
                  aria-label="이벤트 정보 닫기"
                  className={styles.modalCloseButton}
                  onClick={() => setActiveHazard(null)}
                  type="button"
                >
                  ×
                </button>
              </div>
              <dl className={styles.hazardDetails}>
                <div>
                  <dt>통보 시각</dt>
                  <dd>{formatDateTime(activeHazard.issuedAt) ?? "-"}</dd>
                </div>
                <div>
                  <dt>발생 시각</dt>
                  <dd>{formatDateTime(activeHazard.occurredAt) ?? "-"}</dd>
                </div>
                <div>
                  <dt>위치</dt>
                  <dd>{activeHazard.location}</dd>
                </div>
                <div>
                  <dt>규모</dt>
                  <dd>{activeHazard.magnitude ?? "-"}</dd>
                </div>
                <div>
                  <dt>진도/지역</dt>
                  <dd>{activeHazard.intensity ?? "-"}</dd>
                </div>
                <div>
                  <dt>깊이</dt>
                  <dd>{activeHazard.depth ?? "-"}</dd>
                </div>
              </dl>
              {activeHazard.description ? (
                <p className={styles.hazardDescription}>
                  {activeHazard.description}
                </p>
              ) : null}
              {activeHazardImageUrl ? (
                <figure className={styles.hazardImageFrame}>
                  <Image
                    alt={`${activeHazard.title} 기상청 관측 이미지`}
                    className={styles.hazardImage}
                    height={800}
                    loading="lazy"
                    src={activeHazardImageUrl}
                    unoptimized
                    width={1200}
                  />
                  <figcaption>기상청 제공 이미지</figcaption>
                </figure>
              ) : null}
            </section>
          </div>
        ) : null}
      </main>
      <nav className={styles.mobileNav} aria-label="모바일 주요 탐색">
        <a className={styles.mobileNavActive} href="/">
          <MapIcon aria-hidden="true" size={20} strokeWidth={2.5} />
          <span>지도</span>
        </a>
        <button onClick={openSourceSearch} type="button">
          <Search aria-hidden="true" size={20} strokeWidth={2.5} />
          <span>시설</span>
        </button>
        <a href="/licenses">
          <ShieldCheck aria-hidden="true" size={20} strokeWidth={2.5} />
          <span>라이선스</span>
        </a>
        <a href="/ai">
          <Sparkles aria-hidden="true" size={20} strokeWidth={2.5} />
          <span>AI</span>
        </a>
        <a href="/admin">
          <UserCog aria-hidden="true" size={20} strokeWidth={2.5} />
          <span>관리</span>
        </a>
        <div className={styles.mobileProviderMenu} ref={mobileProviderMenuRef}>
          <button
            aria-expanded={isMenuOpen}
            aria-label={dictionary.map.providerMenuLabel.replace(
              "{provider}",
              selectedProviderLabel,
            )}
            onClick={() => setIsMenuOpen((current) => !current)}
            type="button"
          >
            <SelectedProviderIcon
              aria-hidden="true"
              size={20}
              strokeWidth={2.5}
            />
            <span>지도층</span>
          </button>
          {renderProviderDropdown(styles.mobileProviderDropdown)}
        </div>
      </nav>
    </div>
  );
}
