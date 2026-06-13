import { Globe2, Layers } from "lucide-react";
import type {
  GeoJSONSource,
  Map as MapLibreMap,
  PropertyValueSpecification,
  StyleSpecification,
} from "maplibre-gl";
import type { EmergencyRouteResult } from "@/components/emergency-routing-panel";
import type { DatasetSourceId } from "@/lib/dataset-sources";
import { type AppDictionary, uiText } from "@/lib/i18n";
import {
  DEFAULT_MAP_RENDERING_SETTINGS,
  type MapProvider,
  type MapRenderingSettings,
  type MapTileMode,
  type OsmTileSource,
} from "@/lib/map-settings";

export type { MapProvider };

export type MapDimension = "2d" | "3d";

export type MapShellProps = {
  dictionary: AppDictionary;
  initialProvider: MapProvider;
  mapSettings?: MapRenderingSettings;
  vworldApiKey: string;
};

export type EmergencyPointMarker = {
  category: string;
  id: number;
  latitude: number | null;
  longitude: number | null;
  source: DatasetSourceId;
};

export type EmergencyPointDetail = EmergencyPointMarker & {
  address: string;
  fetchedAt: string | null;
  name: string;
  parentName: string | null;
  phone: string | null;
  sourceRecordId: string;
  sourceUpdatedAt: string | null;
};

export type MappedEmergencyPoint = EmergencyPointMarker & {
  latitude: number;
  longitude: number;
};

export type DatasetStatus = {
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

export type PointsResponse = {
  points: EmergencyPointMarker[];
};

export type PointViewport = {
  maxLatitude: number;
  maxLongitude: number;
  minLatitude: number;
  minLongitude: number;
  zoom: number;
};

export type PointDetailResponse = {
  point: EmergencyPointDetail;
};

export type DatasetsResponse = {
  datasets: DatasetStatus[];
};

export const SEOUL_CENTER: [number, number] = [37.5665, 126.978];
export const MAP_CENTER: [number, number] = [SEOUL_CENTER[1], SEOUL_CENTER[0]];
export const DEFAULT_ZOOM = 16;
export const STYLE_LOAD_TIMEOUT_MS = 8000;
export const THREE_DIMENSIONAL_PITCH = 55;
export const THREE_DIMENSIONAL_BEARING = -18;
export const POINTS_SOURCE_ID = "emergency-points";
export const POINTS_HALO_LAYER_ID = "emergency-points-halo";
export const POINTS_LAYER_ID = "emergency-points-hit-area";
export const POINTS_SYMBOL_LAYER_ID = "emergency-points-symbol";
export const HAZARDS_SOURCE_ID = "hazard-events";
export const HAZARDS_HALO_LAYER_ID = "hazard-events-halo";
export const HAZARDS_LAYER_ID = "hazard-events-circle";
export const SEOUL_AREAS_SOURCE_ID = "seoul-citydata-areas";
export const SEOUL_AREAS_HALO_LAYER_ID = "seoul-citydata-areas-halo";
export const SEOUL_AREAS_LAYER_ID = "seoul-citydata-areas-circle";
export const SEOUL_AREAS_SYMBOL_LAYER_ID = "seoul-citydata-areas-symbol";
export const EMERGENCY_ROUTE_SOURCE_ID = "emergency-route";
export const EMERGENCY_ROUTE_LAYER_ID = "emergency-route-line";
export const HAZARD_POLL_INTERVAL_MS = 60_000;
export const HAZARD_AUTO_FOCUS_KEY = "platelets:auto-focus-hazards";
export const DEFAULT_VISIBLE_SOURCE: DatasetSourceId = "fire-stations";
export const VIEWPORT_POINTS_PADDING_RATIO = 0.16;
export const POINT_HALO_RADIUS: PropertyValueSpecification<number> = [
  "interpolate",
  ["linear"],
  ["zoom"],
  6,
  18,
  12,
  42,
];
export const POINT_HIT_RADIUS: PropertyValueSpecification<number> = [
  "interpolate",
  ["linear"],
  ["zoom"],
  6,
  18,
  12,
  33,
];
export const POINT_ICON_SIZE: PropertyValueSpecification<number> = [
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
export const VWORLD_BASE_SOURCE_ID = "vworld-base";
export const VWORLD_TRAFFIC_SOURCE_ID = "vworld-traffic";
export const VWORLD_3D_BUILDINGS_SOURCE_ID = "vworld-3d-buildings";
export const OPENFREEMAP_SOURCE_ID = "openmaptiles";
export const OSM_OFFICIAL_SOURCE_ID = "osm-shortbread";
export const BUILDING_FOOTPRINT_LAYER_ID = "map-building-footprint";
export const BUILDING_3D_LAYER_ID = "map-building-3d";
export const SOURCE_COLORS: Record<DatasetSourceId, string> = {
  aeds: "#059669",
  "childcare-centers": "#db2777",
  "emergency-medical-institutions": "#e11d48",
  "busan-fire-safety-targets": "#0284c7",
  "busan-fire-water-sources": "#1d4ed8",
  "fire-safety-targets": "#0ea5e9",
  "fire-water-sources": "#2563eb",
  "fire-stations": "#dc2626",
  hospitals: "#0f766e",
  pharmacies: "#16a34a",
  "police-stations": "#1d4ed8",
  schools: "#ca8a04",
  universities: "#7c3aed",
};
export const SOURCE_HALO_COLORS: Record<DatasetSourceId, string> = {
  aeds: "#10b981",
  "childcare-centers": "#f472b6",
  "emergency-medical-institutions": "#fb7185",
  "busan-fire-safety-targets": "#38bdf8",
  "busan-fire-water-sources": "#60a5fa",
  "fire-safety-targets": "#7dd3fc",
  "fire-water-sources": "#93c5fd",
  "fire-stations": "#f97316",
  hospitals: "#2dd4bf",
  pharmacies: "#4ade80",
  "police-stations": "#2563eb",
  schools: "#facc15",
  universities: "#8b5cf6",
};
export const SOURCE_ICON_IDS: Record<DatasetSourceId, string> = {
  aeds: "point-icon-aed",
  "childcare-centers": "point-icon-childcare",
  "emergency-medical-institutions": "point-icon-emergency-medical",
  "busan-fire-safety-targets": "point-icon-busan-fire-safety-target",
  "busan-fire-water-sources": "point-icon-busan-fire-water-source",
  "fire-safety-targets": "point-icon-fire-safety-target",
  "fire-water-sources": "point-icon-fire-water-source",
  "fire-stations": "point-icon-fire",
  hospitals: "point-icon-hospital",
  pharmacies: "point-icon-pharmacy",
  "police-stations": "point-icon-police",
  schools: "point-icon-school",
  universities: "point-icon-university",
};

export type PointFeatureProperties = {
  category: string;
  iconId: string;
  id: number;
  latitude: number;
  longitude: number;
  source: DatasetSourceId;
};

export type SeoulAreaPointProperties = SeoulAreaProperties & {
  longitude: number;
  latitude: number;
  populationLabel: string;
};

export type HazardEvent = {
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

export type MappedHazardEvent = HazardEvent & {
  latitude: number;
  longitude: number;
};

export type HazardFeatureProperties = {
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

export type SeoulAreaProperties = {
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

export type SeoulAreaFeature = {
  geometry: {
    coordinates: number[][][];
    type: "Polygon";
  };
  properties: SeoulAreaProperties;
  type: "Feature";
};

export type SeoulAreasData = {
  features: SeoulAreaFeature[];
  type: "FeatureCollection";
};

export type SeoulPopulationStatus = {
  areaCode: string;
  areaName: string;
  congestionLevel: string | null;
  congestionMessage: string | null;
  maxPopulation: number | null;
  minPopulation: number | null;
  populationTime: string | null;
  sourceUpdatedAt: string | null;
};

export type SeoulPopulationResponse = {
  error?: string;
  population?: SeoulPopulationStatus;
};

export type HazardsResponse = {
  events: HazardEvent[];
  serverTime: string;
};

export type PopupClassNames = {
  popup: string;
  popupActions: string;
  popupDetails: string;
  popupHeader: string;
  popupRow: string;
};

export const PROVIDERS: Record<
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

export const VWORLD_TRAFFIC_LINE_LAYERS = [
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

export type VectorPalette = {
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

export const VECTOR_PALETTES: Record<MapProvider, VectorPalette> = {
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

const BUILDING_HEIGHT_EXPRESSION = [
  "interpolate",
  ["linear"],
  ["zoom"],
  14,
  0,
  16,
  [
    "case",
    ["has", "render_height"],
    ["to-number", ["get", "render_height"], 12],
    ["has", "height"],
    ["to-number", ["get", "height"], 12],
    ["has", "building:levels"],
    ["*", ["to-number", ["get", "building:levels"], 4], 3],
    12,
  ],
] as unknown as PropertyValueSpecification<number>;

const BUILDING_BASE_HEIGHT_EXPRESSION = [
  "case",
  ["has", "render_min_height"],
  ["to-number", ["get", "render_min_height"], 0],
  ["has", "min_height"],
  ["to-number", ["get", "min_height"], 0],
  0,
] as unknown as PropertyValueSpecification<number>;

type BuildingLayerOptions = {
  footprintLayerId?: string;
  sourceId: string;
  sourceLayer: string;
  threeDimensionalLayerId?: string;
  threeDimensionalVisible?: boolean;
  vectorPalette: VectorPalette;
};

export type MapStyleOptions = {
  includeThreeDimensionalBuildings?: boolean;
  threeDimensionalVisible?: boolean;
  buildingFootprintLayerId?: string;
  buildingThreeDimensionalLayerId?: string;
};

export function localizedNameExpression() {
  return ["coalesce", ["get", "name:ko"], ["get", "name"], ["get", "name_en"]];
}

function createBuildingLayers({
  footprintLayerId = BUILDING_FOOTPRINT_LAYER_ID,
  sourceId,
  sourceLayer,
  threeDimensionalLayerId = BUILDING_3D_LAYER_ID,
  threeDimensionalVisible = false,
  vectorPalette,
}: BuildingLayerOptions) {
  return [
    {
      id: footprintLayerId,
      layout: {
        visibility: threeDimensionalVisible ? "none" : "visible",
      },
      minzoom: 14,
      paint: {
        "fill-color": vectorPalette.building,
        "fill-opacity": 0.52,
      },
      source: sourceId,
      "source-layer": sourceLayer,
      type: "fill",
    },
    {
      id: threeDimensionalLayerId,
      layout: {
        visibility: threeDimensionalVisible ? "visible" : "none",
      },
      minzoom: 14,
      paint: {
        "fill-extrusion-base": BUILDING_BASE_HEIGHT_EXPRESSION,
        "fill-extrusion-color": [
          "interpolate",
          ["linear"],
          ["zoom"],
          14,
          vectorPalette.building,
          16,
          "#c4beb3",
        ],
        "fill-extrusion-height": BUILDING_HEIGHT_EXPRESSION,
        "fill-extrusion-opacity": 0.76,
      },
      source: sourceId,
      "source-layer": sourceLayer,
      type: "fill-extrusion",
    },
  ] as StyleSpecification["layers"];
}

export function createVworldTileUrl(path: string, vworldApiKey: string) {
  return `https://api.vworld.kr/req/wmts/vector/${path.replace(
    "{key}",
    vworldApiKey,
  )}`;
}

export function createVworldRasterTileUrl(vworldApiKey: string) {
  return `https://api.vworld.kr/req/wmts/1.0.0/${vworldApiKey}/Base/{z}/{y}/{x}.png`;
}

export function createVworldVectorTileUrl(layer: string, vworldApiKey: string) {
  return `https://api.vworld.kr/req/wmts/vector/getTile/${vworldApiKey}/${layer}/{z}/{x}/{y}.pbf`;
}

function createVworldThreeDimensionalBuildingLayers(options: MapStyleOptions) {
  if (!options.includeThreeDimensionalBuildings) {
    return [];
  }

  return createBuildingLayers({
    footprintLayerId: options.buildingFootprintLayerId,
    sourceId: VWORLD_3D_BUILDINGS_SOURCE_ID,
    sourceLayer: "building",
    threeDimensionalLayerId: options.buildingThreeDimensionalLayerId,
    threeDimensionalVisible: options.threeDimensionalVisible,
    vectorPalette: VECTOR_PALETTES.vworld,
  });
}

export function createVworldStyle(
  vworldApiKey: string,
  mapTileMode: MapTileMode = DEFAULT_MAP_RENDERING_SETTINGS.mapTileMode,
  options: MapStyleOptions = {},
): StyleSpecification {
  if (!vworldApiKeyExists(vworldApiKey)) {
    return {
      glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
      layers: [
        {
          id: "background",
          paint: { "background-color": VECTOR_PALETTES.vworld.background },
          type: "background",
        },
        ...createVworldThreeDimensionalBuildingLayers(options),
      ],
      sources: options.includeThreeDimensionalBuildings
        ? {
            [VWORLD_3D_BUILDINGS_SOURCE_ID]: {
              attribution:
                '<a href="https://openfreemap.org" target="_blank">OpenFreeMap</a> <a href="https://www.openstreetmap.org/copyright" target="_blank">&copy; OpenStreetMap</a>',
              type: "vector",
              url: "https://tiles.openfreemap.org/planet",
            },
          }
        : {},
      version: 8,
    } as StyleSpecification;
  }

  if (mapTileMode === "raster") {
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
        ...createVworldThreeDimensionalBuildingLayers(options),
      ],
      sources: {
        [VWORLD_BASE_SOURCE_ID]: {
          attribution:
            '<a href="https://www.vworld.kr" target="_blank">&copy; VWorld</a>',
          maxzoom: 19,
          minzoom: 6,
          tileSize: 256,
          tiles: [createVworldRasterTileUrl(vworldApiKey)],
          type: "raster",
        },
        ...(options.includeThreeDimensionalBuildings
          ? {
              [VWORLD_3D_BUILDINGS_SOURCE_ID]: {
                attribution:
                  '<a href="https://openfreemap.org" target="_blank">OpenFreeMap</a> <a href="https://www.openstreetmap.org/copyright" target="_blank">&copy; OpenStreetMap</a>',
                type: "vector",
                url: "https://tiles.openfreemap.org/planet",
              },
            }
          : {}),
      },
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
        id: "vworld-base-land",
        paint: {
          "fill-color": VECTOR_PALETTES.vworld.land,
          "fill-opacity": 0.9,
        },
        source: VWORLD_BASE_SOURCE_ID,
        "source-layer": "land",
        type: "fill",
      },
      {
        id: "vworld-base-water",
        paint: {
          "fill-color": VECTOR_PALETTES.vworld.water,
          "fill-opacity": 0.88,
        },
        source: VWORLD_BASE_SOURCE_ID,
        "source-layer": "water",
        type: "fill",
      },
      {
        id: "vworld-base-building",
        minzoom: 14,
        paint: {
          "fill-color": VECTOR_PALETTES.vworld.building,
          "fill-opacity": 0.48,
        },
        source: VWORLD_BASE_SOURCE_ID,
        "source-layer": "building",
        type: "fill",
      },
      {
        id: "vworld-base-road-casing",
        minzoom: 7,
        paint: {
          "line-color": VECTOR_PALETTES.vworld.roadCasing,
          "line-width": ["interpolate", ["linear"], ["zoom"], 7, 1.1, 16, 9],
        },
        source: VWORLD_BASE_SOURCE_ID,
        "source-layer": "transportation",
        type: "line",
      },
      {
        id: "vworld-base-road",
        minzoom: 7,
        paint: {
          "line-color": VECTOR_PALETTES.vworld.road,
          "line-width": ["interpolate", ["linear"], ["zoom"], 7, 0.7, 16, 6],
        },
        source: VWORLD_BASE_SOURCE_ID,
        "source-layer": "transportation",
        type: "line",
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
      ...createVworldThreeDimensionalBuildingLayers(options),
    ],
    sources: {
      [VWORLD_BASE_SOURCE_ID]: {
        attribution:
          '<a href="https://www.vworld.kr" target="_blank">&copy; VWorld</a>',
        maxzoom: 19,
        minzoom: 6,
        tiles: [createVworldVectorTileUrl("base", vworldApiKey)],
        type: "vector",
      },
      [VWORLD_TRAFFIC_SOURCE_ID]: {
        maxzoom: 19,
        minzoom: 6,
        tiles: [createVworldVectorTileUrl("traffic", vworldApiKey)],
        type: "vector",
      },
      ...(options.includeThreeDimensionalBuildings
        ? {
            [VWORLD_3D_BUILDINGS_SOURCE_ID]: {
              attribution:
                '<a href="https://openfreemap.org" target="_blank">OpenFreeMap</a> <a href="https://www.openstreetmap.org/copyright" target="_blank">&copy; OpenStreetMap</a>',
              type: "vector",
              url: "https://tiles.openfreemap.org/planet",
            },
          }
        : {}),
    },
    version: 8,
  } as StyleSpecification;
}

export function vworldApiKeyExists(vworldApiKey: string) {
  return vworldApiKey.length > 0;
}

export function createOsmOfficialStyle(
  options: MapStyleOptions = {},
): StyleSpecification {
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
        id: "ocean",
        paint: { "fill-color": palette.water },
        source: OSM_OFFICIAL_SOURCE_ID,
        "source-layer": "ocean",
        type: "fill",
      },
      {
        id: "land",
        paint: { "fill-color": palette.land },
        source: OSM_OFFICIAL_SOURCE_ID,
        "source-layer": "land",
        type: "fill",
      },
      {
        id: "sites",
        minzoom: 12,
        paint: {
          "fill-color": [
            "match",
            ["get", "kind"],
            "park",
            palette.park,
            "hospital",
            "#f7d9dd",
            "school",
            "#efe4bd",
            palette.landuse,
          ],
          "fill-opacity": 0.72,
        },
        source: OSM_OFFICIAL_SOURCE_ID,
        "source-layer": "sites",
        type: "fill",
      },
      {
        id: "water-polygons",
        paint: { "fill-color": palette.water },
        source: OSM_OFFICIAL_SOURCE_ID,
        "source-layer": "water_polygons",
        type: "fill",
      },
      ...createBuildingLayers({
        footprintLayerId: options.buildingFootprintLayerId,
        sourceId: OSM_OFFICIAL_SOURCE_ID,
        sourceLayer: "buildings",
        threeDimensionalLayerId: options.buildingThreeDimensionalLayerId,
        threeDimensionalVisible: options.threeDimensionalVisible,
        vectorPalette: palette,
      }),
      {
        id: "street-polygons",
        minzoom: 13,
        paint: { "fill-color": palette.road },
        source: OSM_OFFICIAL_SOURCE_ID,
        "source-layer": "street_polygons",
        type: "fill",
      },
      {
        id: "water-lines",
        minzoom: 9,
        paint: {
          "line-color": palette.waterLine,
          "line-width": ["interpolate", ["linear"], ["zoom"], 9, 0.5, 15, 2.5],
        },
        source: OSM_OFFICIAL_SOURCE_ID,
        "source-layer": "water_lines",
        type: "line",
      },
      {
        id: "streets-casing",
        minzoom: 7,
        paint: {
          "line-color": palette.roadCasing,
          "line-width": ["interpolate", ["linear"], ["zoom"], 7, 1.1, 16, 9],
        },
        source: OSM_OFFICIAL_SOURCE_ID,
        "source-layer": "streets",
        type: "line",
      },
      {
        id: "streets",
        minzoom: 7,
        paint: {
          "line-color": [
            "match",
            ["get", "kind"],
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
        source: OSM_OFFICIAL_SOURCE_ID,
        "source-layer": "streets",
        type: "line",
      },
      {
        id: "boundaries",
        paint: {
          "line-color": palette.boundary,
          "line-dasharray": [2, 2],
          "line-opacity": 0.62,
          "line-width": ["interpolate", ["linear"], ["zoom"], 3, 0.6, 12, 1.4],
        },
        source: OSM_OFFICIAL_SOURCE_ID,
        "source-layer": "boundaries",
        type: "line",
      },
      {
        id: "street-labels",
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
        source: OSM_OFFICIAL_SOURCE_ID,
        "source-layer": "street_labels",
        type: "symbol",
      },
      {
        id: "place-labels",
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
        source: OSM_OFFICIAL_SOURCE_ID,
        "source-layer": "place_labels",
        type: "symbol",
      },
    ],
    sources: {
      [OSM_OFFICIAL_SOURCE_ID]: {
        attribution:
          '<a href="https://www.openstreetmap.org/copyright" target="_blank">&copy; OpenStreetMap</a>',
        type: "vector",
        url: "https://vector.openstreetmap.org/shortbread_v1/tilejson.json",
      },
    },
    version: 8,
  } as StyleSpecification;
}

export function createOsmStyle(
  osmTileSource: OsmTileSource = DEFAULT_MAP_RENDERING_SETTINGS.osmTileSource,
  options: MapStyleOptions = {},
): StyleSpecification {
  if (osmTileSource === "official") {
    return createOsmOfficialStyle(options);
  }

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
      ...createBuildingLayers({
        footprintLayerId: options.buildingFootprintLayerId,
        sourceId: OPENFREEMAP_SOURCE_ID,
        sourceLayer: "building",
        threeDimensionalLayerId: options.buildingThreeDimensionalLayerId,
        threeDimensionalVisible: options.threeDimensionalVisible,
        vectorPalette: palette,
      }),
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

export function createMapStyle(
  provider: MapProvider,
  vworldApiKey: string,
  settings: Partial<MapRenderingSettings> = {},
  options: MapStyleOptions = {},
): StyleSpecification {
  const mapTileMode =
    settings.mapTileMode ?? DEFAULT_MAP_RENDERING_SETTINGS.mapTileMode;
  const osmTileSource =
    settings.osmTileSource ?? DEFAULT_MAP_RENDERING_SETTINGS.osmTileSource;

  return provider === "vworld"
    ? createVworldStyle(vworldApiKey, mapTileMode, options)
    : createOsmStyle(osmTileSource, options);
}

export function syncThreeDimensionalView(
  map: MapLibreMap,
  enabled: boolean,
  options: {
    animate?: boolean;
    footprintLayerId?: string;
    threeDimensionalLayerId?: string;
  } = {},
) {
  const {
    animate = true,
    footprintLayerId = BUILDING_FOOTPRINT_LAYER_ID,
    threeDimensionalLayerId = BUILDING_3D_LAYER_ID,
  } = options;

  if (map.getLayer(threeDimensionalLayerId)) {
    map.setLayoutProperty(
      threeDimensionalLayerId,
      "visibility",
      enabled ? "visible" : "none",
    );
  }

  if (map.getLayer(footprintLayerId)) {
    map.setLayoutProperty(
      footprintLayerId,
      "visibility",
      enabled ? "none" : "visible",
    );
  }

  const camera = {
    bearing: enabled ? THREE_DIMENSIONAL_BEARING : 0,
    pitch: enabled ? THREE_DIMENSIONAL_PITCH : 0,
  };

  if (animate) {
    map.easeTo({ ...camera, duration: 520 });
    return;
  }

  map.jumpTo(camera);
}

export function isSourceVisible(
  visibleSources: Partial<Record<DatasetSourceId, boolean>>,
  source: DatasetSourceId,
) {
  return visibleSources[source] ?? source === DEFAULT_VISIBLE_SOURCE;
}

export function getPointLimitForZoom(zoom: number) {
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

export function getViewportFromMap(map: MapLibreMap): PointViewport {
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

export function buildPointsUrl(
  source: DatasetSourceId,
  viewport: PointViewport,
) {
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

export function isMappedPoint(
  point: EmergencyPointMarker,
): point is MappedEmergencyPoint {
  return point.latitude !== null && point.longitude !== null;
}

export function isMappedHazardEvent(
  event: HazardEvent,
): event is MappedHazardEvent {
  return event.latitude !== null && event.longitude !== null;
}

export function isDomesticHazardEvent(event: HazardEvent) {
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

export function safeKmaImageUrl(value: string | null) {
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

export function createPointData(points: EmergencyPointMarker[]) {
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

export function getPolygonCenter(coordinates: number[][][]) {
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

export function createSeoulAreaPointData(
  areas: SeoulAreasData,
  dictionary: AppDictionary,
) {
  return {
    features: areas.features.map((feature) => {
      const [longitude, latitude] = getPolygonCenter(
        feature.geometry.coordinates,
      );
      const populationLabel =
        formatPopulationRangeValues(
          feature.properties.minPopulation,
          feature.properties.maxPopulation,
          dictionary,
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

export function createHazardData(events: HazardEvent[]) {
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

export function updateSeoulAreaPopulation(
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

export function escapeHtml(value: string) {
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

export function formatDateTime(value: string | null) {
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

export function hazardTypeLabel(
  eventType: HazardEvent["eventType"],
  dictionary: AppDictionary,
) {
  return eventType === "earthquake"
    ? uiText(dictionary, "지진")
    : uiText(dictionary, "지진해일");
}

export function formatPopulationRangeValues(
  minPopulation: number | null | undefined,
  maxPopulation: number | null | undefined,
  dictionary: AppDictionary,
) {
  if (typeof minPopulation !== "number" || typeof maxPopulation !== "number") {
    return null;
  }

  return `${minPopulation.toLocaleString(
    dictionary.formatLocale,
  )} - ${maxPopulation.toLocaleString(dictionary.formatLocale)}${uiText(
    dictionary,
    "명",
  )}`;
}

export function formatPopulationRange(
  population: SeoulPopulationStatus,
  dictionary: AppDictionary,
) {
  return formatPopulationRangeValues(
    population.minPopulation,
    population.maxPopulation,
    dictionary,
  );
}

export function buildKakaoMapUrl(point: EmergencyPointDetail) {
  return `https://map.kakao.com/link/search/${encodeURIComponent(
    point.address,
  )}`;
}

export function buildNaverMapUrl(point: EmergencyPointDetail) {
  return `https://map.naver.com/p/search/${encodeURIComponent(point.address)}`;
}

export function buildPopupHtml(
  point: EmergencyPointDetail,
  dictionary: AppDictionary,
  sourceLabel: string,
  classNames: PopupClassNames,
) {
  const rows = [
    [dictionary.map.popup.address, point.address],
    [dictionary.map.popup.phone, point.phone],
    [dictionary.map.popup.sourceUpdatedAt, point.sourceUpdatedAt],
  ].filter((row): row is [string, string] => Boolean(row[1]));
  const rowsHtml = rows
    .map(
      ([label, value]) =>
        `<div class="${classNames.popupRow}"><dt>${escapeHtml(
          label,
        )}</dt><dd>${escapeHtml(value)}</dd></div>`,
    )
    .join("");

  return `<article class="${classNames.popup}">
    <div class="${classNames.popupHeader}">
      <strong>${escapeHtml(`[${point.category}] ${point.name}`)}</strong>
      <span>${escapeHtml(sourceLabel)}</span>
    </div>
    <dl class="${classNames.popupDetails}">${rowsHtml}</dl>
    <div class="${classNames.popupActions}">
      <a href="${buildNaverMapUrl(point)}" target="_blank" rel="noreferrer">${escapeHtml(
        dictionary.map.popup.naverMap,
      )}</a>
      <a href="${buildKakaoMapUrl(point)}" target="_blank" rel="noreferrer">${escapeHtml(
        dictionary.map.popup.kakaoMap,
      )}</a>
    </div>
  </article>`;
}

export function buildSeoulPopulationPopupHtml(
  area: SeoulAreaProperties,
  population: SeoulPopulationStatus | null,
  error: string | null,
  dictionary: AppDictionary,
  classNames: PopupClassNames,
) {
  const rows = error
    ? [[uiText(dictionary, "상태"), error]]
    : [
        [
          uiText(dictionary, "예상 인원"),
          population ? formatPopulationRange(population, dictionary) : null,
        ],
        [uiText(dictionary, "기준 시각"), population?.populationTime],
        [uiText(dictionary, "분류"), area.category],
      ];
  const rowsHtml = rows
    .filter((row): row is [string, string] => Boolean(row[1]))
    .map(
      ([label, value]) =>
        `<div class="${classNames.popupRow}"><dt>${escapeHtml(
          label,
        )}</dt><dd>${escapeHtml(value)}</dd></div>`,
    )
    .join("");

  return `<article class="${classNames.popup}">
    <div class="${classNames.popupHeader}">
      <strong>${escapeHtml(
        `[${uiText(dictionary, "서울 실시간 인구")}] ${area.areaName}`,
      )}</strong>
      <span>${escapeHtml(area.category)}</span>
    </div>
    <dl class="${classNames.popupDetails}">${rowsHtml}</dl>
  </article>`;
}

export function createPointIconImage(source: DatasetSourceId) {
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

export function ensurePointIcons(map: MapLibreMap) {
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

export function syncPointLayer(
  map: MapLibreMap,
  points: EmergencyPointMarker[],
) {
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

export function syncPointLayerWhenReady(
  map: MapLibreMap,
  points: EmergencyPointMarker[],
) {
  if (map.isStyleLoaded()) {
    syncPointLayer(map, points);
    return;
  }

  runWhenStyleReady(map, () => syncPointLayer(map, points));
}

export function syncSeoulAreaLayer(
  map: MapLibreMap,
  areas: SeoulAreasData | null,
  dictionary: AppDictionary,
) {
  if (!areas || !map.isStyleLoaded()) {
    return;
  }

  const areaData = createSeoulAreaPointData(areas, dictionary);
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
          uiText(dictionary, "붐빔"),
          "#dc2626",
          uiText(dictionary, "약간 붐빔"),
          "#f97316",
          uiText(dictionary, "보통"),
          "#eab308",
          uiText(dictionary, "여유"),
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
          uiText(dictionary, "붐빔"),
          "#dc2626",
          uiText(dictionary, "약간 붐빔"),
          "#f97316",
          uiText(dictionary, "보통"),
          "#eab308",
          uiText(dictionary, "여유"),
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

export function syncSeoulAreaLayerWhenReady(
  map: MapLibreMap,
  areas: SeoulAreasData | null,
  dictionary: AppDictionary,
) {
  if (map.isStyleLoaded()) {
    syncSeoulAreaLayer(map, areas, dictionary);
    return;
  }

  runWhenStyleReady(map, () => syncSeoulAreaLayer(map, areas, dictionary));
}

export function syncHazardLayer(map: MapLibreMap, events: HazardEvent[]) {
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

export function syncHazardLayerWhenReady(
  map: MapLibreMap,
  events: HazardEvent[],
) {
  if (map.isStyleLoaded()) {
    syncHazardLayer(map, events);
    return;
  }

  runWhenStyleReady(map, () => syncHazardLayer(map, events));
}

export function syncEmergencyRouteLayer(
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

export function syncEmergencyRouteLayerWhenReady(
  map: MapLibreMap,
  route: EmergencyRouteResult | null,
) {
  if (map.isStyleLoaded()) {
    syncEmergencyRouteLayer(map, route);
    return;
  }

  runWhenStyleReady(map, () => syncEmergencyRouteLayer(map, route));
}

export function runWhenStyleReady(map: MapLibreMap, callback: () => void) {
  let didRun = false;
  let retryId: number | undefined;
  let attempts = 0;
  const run = () => {
    if (didRun) {
      return;
    }

    if (map.isStyleLoaded()) {
      didRun = true;
      if (retryId) {
        window.clearTimeout(retryId);
      }
      callback();
      return;
    }

    if (attempts < 80) {
      attempts += 1;
      retryId = window.setTimeout(run, 50);
    }
  };

  map.once("style.load", run);
  map.once("idle", run);
  run();
}
