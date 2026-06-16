"use client";

import {
  AlertTriangle,
  Ambulance,
  Building2,
  Copy,
  Database,
  Droplets,
  Flame,
  Hospital,
  Layers,
  LocateFixed,
  MapPin,
  Plus,
  RefreshCw,
  Route,
  Search,
  ShieldAlert,
  Truck,
  X,
} from "lucide-react";
import type {
  GeoJSONSource,
  LayerSpecification,
  MapGeoJSONFeature,
  MapLayerMouseEvent,
  Map as MapLibreMap,
  Popup as MapLibrePopup,
  PropertyValueSpecification,
  StyleSpecification,
} from "maplibre-gl";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { MapLegend } from "@/components/disaster-dashboard/map-legend";
import { SummaryMetrics } from "@/components/disaster-dashboard/summary-metrics";
import { useIncidentEvents } from "@/components/disaster-dashboard/use-incident-events";
import type { BuildingSafetyProfile } from "@/lib/building-safety/types";
import type {
  BigData119MapPoint,
  BigData119OperationalKind,
  BigData119OperationalSummary,
  BigData119PointKind,
  BigData119SourceSummary,
  DispatchRecommendation,
  FireStation,
  Hospital as HospitalModel,
  HospitalRecommendation,
  Incident,
  IncidentEvent,
  IncidentStatus,
  IncidentType,
  ResourceRecommendation,
  RiskArea,
  RiskLevel,
} from "@/lib/disaster-response/types";
import { type AppDictionary, uiText } from "@/lib/i18n";
import {
  DEFAULT_MAP_RENDERING_SETTINGS,
  type MapRenderingSettings,
} from "@/lib/map-settings";
import {
  createVworldStyle,
  VWORLD_3D_BUILDINGS_SOURCE_ID,
} from "@/lib/map-shell-core";
import { safeLinkHref } from "@/lib/safe-link";
import styles from "./disaster-dashboard-styles";

export type DashboardView =
  | "dashboard"
  | "incidents"
  | "create"
  | "risk"
  | "resources";

type DashboardSnapshot = {
  activeIncident: Incident | null;
  bigData119OperationalSummaries: BigData119OperationalSummary[];
  bigData119Points: BigData119MapPoint[];
  bigData119Summaries: BigData119SourceSummary[];
  dispatchRecommendation: DispatchRecommendation | null;
  fireStations: FireStation[];
  hospitalRecommendations: HospitalRecommendation[];
  hospitals: HospitalModel[];
  incidents: Incident[];
  resourceRecommendations: ResourceRecommendation[];
  riskAreas: RiskArea[];
};

export type DisasterDashboardProps = {
  dictionary: AppDictionary;
  initialView?: DashboardView;
  mapSettings?: MapRenderingSettings;
  vworldApiKey?: string;
};

type RecommendationResponse = {
  dispatchRecommendation: DispatchRecommendation | null;
  hospitalRecommendations: HospitalRecommendation[];
  incident: Incident;
};

type DispatchRoute = {
  baseDurationSeconds?: number;
  coordinates: [number, number][];
  distanceMeters: number;
  durationSeconds: number;
  provider: "astar" | "kakao";
  traffic?: {
    averageSpeedKph: number | null;
    congestionLevel: "congested" | "moderate" | "smooth" | "unknown";
    durationMultiplier: number;
    message: string;
    provider: "its" | "kakao" | "none";
    sampleCount: number;
    status: "live" | "unavailable" | "unconfigured";
  };
};

type DispatchRouteResponse = {
  error?: string;
  route?: DispatchRoute;
};

type SimulationResponse = {
  errorCode?: string;
  scenario?: {
    generatedAt: string;
    model: string;
    scenario: string;
  };
};

type MapContextRecommendation = {
  hospitalName: string | null;
  stationName: string | null;
};

type MapContextMenuState = {
  address: string | null;
  isAddressLoading: boolean;
  isMobile: boolean;
  isRecommendationLoading: boolean;
  latitude: number;
  longitude: number;
  recommendation: MapContextRecommendation | null;
  screenX: number;
  screenY: number;
  status: string | null;
};

type ReverseGeocodingResponse = {
  addresses?: string[];
  errorCode?: string;
};

type EmergencyRecommendationResponse = {
  dispatchStation?: FireStation | null;
  hospitals?: HospitalRecommendation[];
};

type IncidentForm = {
  address: string;
  description: string;
  latitude: string;
  longitude: string;
  occurredAt: string;
  riskLevel: RiskLevel;
  title: string;
  type: IncidentType;
};

type IncidentTypeFilter = IncidentType | "all";
type IncidentStatusFilter = IncidentStatus | "all";

type IncidentDetailResponse = {
  error?: string;
  events?: IncidentEvent[];
  incident?: Incident;
};

type FeatureProperties = Record<string, string | number | boolean | null>;
type GeoJsonData = GeoJSON.FeatureCollection<
  GeoJSON.Geometry,
  FeatureProperties
>;
type BuildingFeatureProperties = Record<string, unknown>;
type BuildingSafetyResponse = {
  profile?: BuildingSafetyProfile | null;
};
type UserLocation = {
  accuracy: number;
  latitude: number;
  locatedAt: string;
  longitude: number;
};
type ReportLocation = {
  address: string;
  latitude: number;
  longitude: number;
};
type MobileSheetRow = {
  label: string;
  value: string;
};
type MobileSheetLink = {
  href: string;
  label: string;
};
type MobileSheet = {
  id: string;
  links?: MobileSheetLink[];
  rows: MobileSheetRow[];
  subtitle: string;
  title: string;
};
type MapLibreModule = typeof import("maplibre-gl");
type DashboardMapCreateOptions = {
  forceWebgl: boolean;
  mapSettings: MapRenderingSettings;
  threeDimensional: boolean;
  vworldApiKey: string;
};

const MAP_CENTER: [number, number] = [127.85, 36.45];
const DEFAULT_ZOOM = 6.35;
const OPENFREEMAP_SOURCE_ID = "dashboard-openmaptiles";
const OSM_OFFICIAL_SOURCE_ID = "dashboard-osm-shortbread";
const BUILDING_FOOTPRINT_LAYER_ID = "dashboard-building-footprint";
const BUILDING_3D_LAYER_ID = "dashboard-building-3d";
const POI_LABEL_LAYER_ID = "dashboard-poi-label";
const USER_LOCATION_SOURCE_ID = "dashboard-user-location";
const USER_LOCATION_ACCURACY_LAYER_ID = "dashboard-user-location-accuracy";
const USER_LOCATION_POINT_LAYER_ID = "dashboard-user-location-point";
const USER_LOCATION_LABEL_LAYER_ID = "dashboard-user-location-label";
const REPORT_LOCATION_SOURCE_ID = "dashboard-report-location";
const REPORT_LOCATION_HALO_LAYER_ID = "dashboard-report-location-halo";
const REPORT_LOCATION_POINT_LAYER_ID = "dashboard-report-location-point";
const REPORT_LOCATION_LABEL_LAYER_ID = "dashboard-report-location-label";
const THREE_DIMENSIONAL_PITCH = 58;
const THREE_DIMENSIONAL_BEARING = -18;
const BUILDING_QUERY_BOX_PIXELS = 18;
const POI_QUERY_BOX_PIXELS = 26;
const BUILDING_REPORT_ACTION_ATTRIBUTE = "data-building-report-action";
const BUILDING_REPORT_ACTION_SELECTOR = `[${BUILDING_REPORT_ACTION_ATTRIBUTE}]`;
const INCIDENTS_SOURCE_ID = "mvp-incidents";
const FIRE_STATIONS_SOURCE_ID = "mvp-fire-stations";
const HOSPITALS_SOURCE_ID = "mvp-hospitals";
const RISK_AREAS_SOURCE_ID = "mvp-risk-areas";
const ROUTE_SOURCE_ID = "mvp-dispatch-route";
const BIGDATA119_SOURCE_ID = "mvp-bigdata119";
const INCIDENT_LAYER_ID = "mvp-incident-points";
const FIRE_STATION_LAYER_ID = "mvp-fire-station-points";
const HOSPITAL_LAYER_ID = "mvp-hospital-points";
const RISK_AREA_LAYER_ID = "mvp-risk-area-circles";
const ROUTE_LAYER_ID = "mvp-dispatch-route-line";
const BIGDATA119_TARGET_LAYER_ID = "mvp-bigdata119-fire-safety-targets";
const BIGDATA119_WATER_LAYER_ID = "mvp-bigdata119-fire-water-sources";
const BIGDATA119_LABEL_LAYER_ID = "mvp-bigdata119-labels";

const BIGDATA119_KIND_LABEL: Record<BigData119PointKind, string> = {
  "fire-safety-target": "특정소방대상물",
  "fire-water-source": "소방용수",
};
const BIGDATA119_OPERATIONAL_KIND_LABEL: Record<
  BigData119OperationalKind,
  string
> = {
  "call-reception": "119 신고접수",
  "ems-dispatch": "구급출동",
  "rescue-dispatch": "구조출동",
};

const BIGDATA119_KIND_COLOR: Record<BigData119PointKind, string> = {
  "fire-safety-target": "#0ea5e9",
  "fire-water-source": "#2563eb",
};

const EMPTY_FEATURE_COLLECTION = {
  features: [],
  type: "FeatureCollection",
} satisfies GeoJsonData;

const INCIDENT_TYPE_LABEL: Record<IncidentType, string> = {
  fire: "화재",
  medical: "구급",
  rescue: "구조",
  traffic: "교통사고",
};

const RISK_LEVEL_LABEL: Record<RiskLevel, string> = {
  high: "높음",
  low: "낮음",
  medium: "보통",
};

const INCIDENT_STATUS_LABEL: Record<IncidentStatus, string> = {
  closed: "종료",
  dispatched: "출동",
  reported: "접수",
};

const INCIDENT_EVENT_LABEL: Record<IncidentEvent["type"], string> = {
  created: "등록",
  deleted: "삭제",
  status: "상태 변경",
  updated: "수정",
};

const VECTOR_PALETTE = {
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

function localizedNameExpression() {
  return ["coalesce", ["get", "name:ko"], ["get", "name"], ["get", "name_en"]];
}

function createOpenFreeMapDashboardStyle(): StyleSpecification {
  const palette = VECTOR_PALETTE;

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
        id: BUILDING_FOOTPRINT_LAYER_ID,
        minzoom: 14,
        paint: {
          "fill-color": palette.building,
          "fill-opacity": 0.46,
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
        filter: [
          "any",
          ["has", "name:ko"],
          ["has", "name"],
          ["has", "name_en"],
        ],
        id: POI_LABEL_LAYER_ID,
        layout: {
          "text-anchor": "top",
          "text-field": localizedNameExpression(),
          "text-font": ["Noto Sans Regular"],
          "text-offset": [0, 0.55],
          "text-size": ["interpolate", ["linear"], ["zoom"], 14, 10, 17, 12],
        },
        minzoom: 14,
        paint: {
          "text-color": "#23324a",
          "text-halo-color": "#ffffff",
          "text-halo-width": 1.5,
        },
        source: OPENFREEMAP_SOURCE_ID,
        "source-layer": "poi",
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

function createOfficialOsmDashboardStyle(): StyleSpecification {
  const palette = VECTOR_PALETTE;

  return {
    glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
    layers: [
      {
        id: "background",
        paint: { "background-color": palette.background },
        type: "background",
      },
      {
        id: "dashboard-osm-ocean",
        paint: { "fill-color": palette.water },
        source: OSM_OFFICIAL_SOURCE_ID,
        "source-layer": "ocean",
        type: "fill",
      },
      {
        id: "dashboard-osm-land",
        paint: { "fill-color": palette.land },
        source: OSM_OFFICIAL_SOURCE_ID,
        "source-layer": "land",
        type: "fill",
      },
      {
        id: "dashboard-osm-sites",
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
        id: "dashboard-osm-water",
        paint: { "fill-color": palette.water },
        source: OSM_OFFICIAL_SOURCE_ID,
        "source-layer": "water_polygons",
        type: "fill",
      },
      {
        id: BUILDING_FOOTPRINT_LAYER_ID,
        minzoom: 14,
        paint: {
          "fill-color": palette.building,
          "fill-opacity": 0.46,
        },
        source: OSM_OFFICIAL_SOURCE_ID,
        "source-layer": "buildings",
        type: "fill",
      },
      {
        id: "dashboard-osm-street-polygons",
        minzoom: 13,
        paint: { "fill-color": palette.road },
        source: OSM_OFFICIAL_SOURCE_ID,
        "source-layer": "street_polygons",
        type: "fill",
      },
      {
        id: "dashboard-osm-water-lines",
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
        id: "dashboard-osm-road-casing",
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
        id: "dashboard-osm-road",
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
        id: "dashboard-osm-boundaries",
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
        id: "dashboard-osm-road-label",
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
        filter: ["has", "name"],
        id: POI_LABEL_LAYER_ID,
        layout: {
          "text-anchor": "top",
          "text-field": localizedNameExpression(),
          "text-font": ["Noto Sans Regular"],
          "text-offset": [0, 0.55],
          "text-size": ["interpolate", ["linear"], ["zoom"], 14, 10, 17, 12],
        },
        minzoom: 14,
        paint: {
          "text-color": "#23324a",
          "text-halo-color": "#ffffff",
          "text-halo-width": 1.5,
        },
        source: OSM_OFFICIAL_SOURCE_ID,
        "source-layer": "pois",
        type: "symbol",
      },
      {
        id: "dashboard-osm-place-label",
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

function createDashboardMapStyle(
  settings: MapRenderingSettings,
  vworldApiKey: string,
): StyleSpecification {
  if (settings.mapProvider === "vworld") {
    return createVworldStyle(vworldApiKey, settings.mapTileMode, {
      buildingFootprintLayerId: BUILDING_FOOTPRINT_LAYER_ID,
      buildingThreeDimensionalLayerId: BUILDING_3D_LAYER_ID,
      includeThreeDimensionalBuildings: false,
      threeDimensionalVisible: false,
    });
  }

  return settings.osmTileSource === "official"
    ? createOfficialOsmDashboardStyle()
    : createOpenFreeMapDashboardStyle();
}

function createDashboardMapInstance(
  maplibre: MapLibreModule,
  container: HTMLDivElement,
  options: DashboardMapCreateOptions,
) {
  return new maplibre.Map({
    attributionControl: { compact: true },
    bearing: options.threeDimensional ? THREE_DIMENSIONAL_BEARING : 0,
    canvasContextAttributes: options.forceWebgl
      ? {
          antialias: true,
          contextType: "webgl",
        }
      : {
          antialias: true,
        },
    center: MAP_CENTER,
    container,
    pitch: options.threeDimensional ? THREE_DIMENSIONAL_PITCH : 0,
    style: createDashboardMapStyle(options.mapSettings, options.vworldApiKey),
    zoom: DEFAULT_ZOOM,
  });
}

function resetDashboardMapContainer(container: HTMLDivElement) {
  container.replaceChildren();
  container.classList.remove("maplibregl-map");
}

function dashboardBuildingThreeDimensionalLayer(
  settings: MapRenderingSettings,
): LayerSpecification {
  const palette = VECTOR_PALETTE;
  const buildingColor = [
    "interpolate",
    ["linear"],
    ["zoom"],
    14,
    palette.building,
    16,
    "#c7c0b4",
  ];

  if (settings.mapProvider === "vworld") {
    return {
      id: BUILDING_3D_LAYER_ID,
      minzoom: 14,
      paint: {
        "fill-extrusion-base": BUILDING_BASE_HEIGHT_EXPRESSION,
        "fill-extrusion-color": buildingColor,
        "fill-extrusion-height": BUILDING_HEIGHT_EXPRESSION,
        "fill-extrusion-opacity": 0.74,
      },
      source: VWORLD_3D_BUILDINGS_SOURCE_ID,
      "source-layer": "building",
      type: "fill-extrusion",
    } as LayerSpecification;
  }

  if (settings.osmTileSource === "official") {
    return {
      id: BUILDING_3D_LAYER_ID,
      minzoom: 14,
      paint: {
        "fill-extrusion-base": 0,
        "fill-extrusion-color": buildingColor,
        "fill-extrusion-height": 12,
        "fill-extrusion-opacity": 0.72,
      },
      source: OSM_OFFICIAL_SOURCE_ID,
      "source-layer": "buildings",
      type: "fill-extrusion",
    } as LayerSpecification;
  }

  return {
    id: BUILDING_3D_LAYER_ID,
    minzoom: 14,
    paint: {
      "fill-extrusion-base": BUILDING_BASE_HEIGHT_EXPRESSION,
      "fill-extrusion-color": buildingColor,
      "fill-extrusion-height": BUILDING_HEIGHT_EXPRESSION,
      "fill-extrusion-opacity": 0.74,
    },
    source: OPENFREEMAP_SOURCE_ID,
    "source-layer": "building",
    type: "fill-extrusion",
  } as LayerSpecification;
}

function ensureDashboardThreeDimensionalSource(
  map: MapLibreMap,
  settings: MapRenderingSettings,
) {
  if (
    settings.mapProvider !== "vworld" ||
    map.getSource(VWORLD_3D_BUILDINGS_SOURCE_ID)
  ) {
    return;
  }

  map.addSource(VWORLD_3D_BUILDINGS_SOURCE_ID, {
    attribution:
      '<a href="https://openfreemap.org" target="_blank">OpenFreeMap</a> <a href="https://www.openstreetmap.org/copyright" target="_blank">&copy; OpenStreetMap</a>',
    type: "vector",
    url: "https://tiles.openfreemap.org/planet",
  });
}

function ensureDashboardThreeDimensionalLayer(
  map: MapLibreMap,
  settings: MapRenderingSettings,
) {
  if (map.getLayer(BUILDING_3D_LAYER_ID)) {
    return;
  }

  ensureDashboardThreeDimensionalSource(map, settings);

  const layer = dashboardBuildingThreeDimensionalLayer(settings);
  const beforeId = map.getLayer(POI_LABEL_LAYER_ID)
    ? POI_LABEL_LAYER_ID
    : undefined;

  if (beforeId) {
    map.addLayer(layer, beforeId);
    return;
  }

  map.addLayer(layer);
}

function syncThreeDimensionalView(
  map: MapLibreMap,
  enabled: boolean,
  settings: MapRenderingSettings,
  animate = true,
) {
  if (enabled) {
    ensureDashboardThreeDimensionalLayer(map, settings);
  }

  if (map.getLayer(BUILDING_3D_LAYER_ID)) {
    map.setLayoutProperty(
      BUILDING_3D_LAYER_ID,
      "visibility",
      enabled ? "visible" : "none",
    );
  }

  if (map.getLayer(BUILDING_FOOTPRINT_LAYER_ID)) {
    map.setLayoutProperty(
      BUILDING_FOOTPRINT_LAYER_ID,
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

function featureCollection(
  features: GeoJSON.Feature<GeoJSON.Geometry, FeatureProperties>[],
): GeoJsonData {
  return {
    features,
    type: "FeatureCollection",
  };
}

function pointFeature(
  id: string,
  longitude: number,
  latitude: number,
  properties: FeatureProperties,
) {
  return {
    geometry: {
      coordinates: [longitude, latitude],
      type: "Point",
    },
    id,
    properties,
    type: "Feature",
  } satisfies GeoJSON.Feature<GeoJSON.Point, FeatureProperties>;
}

function lineFeature(
  id: string,
  coordinates: [number, number][],
  properties: FeatureProperties,
) {
  return {
    geometry: {
      coordinates,
      type: "LineString",
    },
    id,
    properties,
    type: "Feature",
  } satisfies GeoJSON.Feature<GeoJSON.LineString, FeatureProperties>;
}

function riskColor(level: RiskLevel) {
  if (level === "high") return "#e11d48";
  if (level === "medium") return "#d97706";
  return "#059669";
}

function incidentsData(
  incidents: Incident[],
  selectedIncidentId: string | null,
) {
  return featureCollection(
    incidents.map((incident) =>
      pointFeature(incident.id, incident.longitude, incident.latitude, {
        id: incident.id,
        riskLevel: incident.riskLevel,
        selected: incident.id === selectedIncidentId,
        title: incident.title,
        type: incident.type,
      }),
    ),
  );
}

function stationsData(stations: FireStation[]) {
  return featureCollection(
    stations.map((station) =>
      pointFeature(station.id, station.longitude, station.latitude, {
        id: station.id,
        name: station.name,
      }),
    ),
  );
}

function hospitalsData(hospitals: HospitalModel[]) {
  return featureCollection(
    hospitals.map((hospital) =>
      pointFeature(hospital.id, hospital.longitude, hospital.latitude, {
        emergencyRoom: hospital.emergencyRoom,
        id: hospital.id,
        name: hospital.name,
      }),
    ),
  );
}

function riskAreasData(riskAreas: RiskArea[]) {
  return featureCollection(
    riskAreas.map((area) =>
      pointFeature(area.id, area.longitude, area.latitude, {
        color: riskColor(area.riskLevel),
        id: area.id,
        name: area.name,
        riskLevel: area.riskLevel,
        riskScore: area.riskScore,
      }),
    ),
  );
}

function bigData119Data(
  points: BigData119MapPoint[],
  visibleKinds: Record<BigData119PointKind, boolean>,
  text: DashboardText,
) {
  return featureCollection(
    points
      .filter((point) => visibleKinds[point.kind])
      .map((point) =>
        pointFeature(point.id, point.longitude, point.latitude, {
          category: point.category,
          id: point.id,
          isSample: point.isSample,
          kind: point.kind,
          label: text(BIGDATA119_KIND_LABEL[point.kind]),
          name: point.name,
          sourceId: point.sourceId,
        }),
      ),
  );
}

function userLocationData(location: UserLocation | null, text: DashboardText) {
  if (!location) {
    return EMPTY_FEATURE_COLLECTION;
  }

  return featureCollection([
    pointFeature(
      "current-user-location",
      location.longitude,
      location.latitude,
      {
        accuracy: location.accuracy,
        id: "current-user-location",
        label: text("내 위치"),
        locatedAt: location.locatedAt,
      },
    ),
  ]);
}

function reportLocationData(
  location: ReportLocation | null,
  text: DashboardText,
) {
  if (!location) {
    return EMPTY_FEATURE_COLLECTION;
  }

  return featureCollection([
    pointFeature(
      "draft-report-location",
      location.longitude,
      location.latitude,
      {
        address: location.address,
        id: "draft-report-location",
        label: text("dashboard.sheet.reportLocationTitle"),
      },
    ),
  ]);
}

function routeData(
  incident: Incident | null,
  recommendation: DispatchRecommendation | null,
  dispatchRoute: DispatchRoute | null,
) {
  if (!(incident && recommendation)) {
    return EMPTY_FEATURE_COLLECTION;
  }

  return featureCollection([
    lineFeature(
      `route-${recommendation.station.id}-${incident.id}`,
      dispatchRoute && dispatchRoute.coordinates.length > 0
        ? dispatchRoute.coordinates
        : [
            [recommendation.station.longitude, recommendation.station.latitude],
            [incident.longitude, incident.latitude],
          ],
      {
        incidentId: incident.id,
        provider: dispatchRoute?.provider ?? "fallback",
        stationId: recommendation.station.id,
      },
    ),
  ]);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function propertyText(
  properties: BuildingFeatureProperties | null,
  keys: string[],
) {
  if (!properties) {
    return null;
  }

  for (const key of keys) {
    const value = properties[key];

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }

  return null;
}

function formatBuildingClass(value: string | null, text: DashboardText) {
  if (!value) {
    return null;
  }

  const labels: Record<string, string> = {
    apartments: "공동주택",
    commercial: "상업시설",
    fire_station: "소방시설",
    hospital: "의료시설",
    office: "업무시설",
    public: "공공시설",
    residential: "주거시설",
    retail: "상업시설",
    school: "교육시설",
    train_station: "철도역",
    university: "대학교",
    yes: "건물",
  };

  return labels[value] ? text(labels[value]) : value.replace(/_/g, " ");
}

function formatBuildingHeight(value: string | null, formatLocale: string) {
  if (!value) {
    return null;
  }

  const numeric = Number(value.replace(/m$/i, ""));

  if (!Number.isFinite(numeric)) {
    return value;
  }

  return `${numeric.toLocaleString(formatLocale, {
    maximumFractionDigits: 1,
  })}m`;
}

function buildAddressFromProperties(
  properties: BuildingFeatureProperties | null,
) {
  if (!properties) {
    return null;
  }

  const direct = propertyText(properties, [
    "addr:full",
    "addr:ko",
    "address",
    "addr:street",
  ]);

  if (direct) {
    return direct;
  }

  const parts = [
    propertyText(properties, ["addr:city"]),
    propertyText(properties, ["addr:district"]),
    propertyText(properties, ["addr:street"]),
    propertyText(properties, ["addr:housenumber"]),
  ].filter((part): part is string => Boolean(part));

  return parts.length > 0 ? parts.join(" ") : null;
}

function buildingDisplayName(
  buildingProperties: BuildingFeatureProperties | null,
  poiProperties: BuildingFeatureProperties | null,
  safetyProfile: BuildingSafetyProfile | null,
) {
  return (
    safetyProfile?.name ??
    propertyText(poiProperties, ["name:ko", "name", "name_en"]) ??
    propertyText(buildingProperties, ["name:ko", "name", "name_en"])
  );
}

function buildingDisplayAddress(
  buildingProperties: BuildingFeatureProperties | null,
  poiProperties: BuildingFeatureProperties | null,
  safetyProfile: BuildingSafetyProfile | null,
) {
  return (
    safetyProfile?.address ??
    buildAddressFromProperties(buildingProperties) ??
    buildAddressFromProperties(poiProperties)
  );
}

function createReportLocation(
  coordinates: [number, number],
  address?: string | null,
  fallbackLabel?: string,
): ReportLocation {
  const latitude = Number(coordinates[1].toFixed(6));
  const longitude = Number(coordinates[0].toFixed(6));

  return {
    address:
      address ??
      `${fallbackLabel ?? ""} (${latitude.toFixed(5)}, ${longitude.toFixed(5)})`.trim(),
    latitude,
    longitude,
  };
}

function buildBuildingReportAddress(
  buildingProperties: BuildingFeatureProperties | null,
  poiProperties: BuildingFeatureProperties | null,
  safetyProfile: BuildingSafetyProfile | null,
  coordinates: [number, number],
  text: DashboardText,
) {
  const name = buildingDisplayName(
    buildingProperties,
    poiProperties,
    safetyProfile,
  );
  const address = buildingDisplayAddress(
    buildingProperties,
    poiProperties,
    safetyProfile,
  );
  const fallback = createReportLocation(
    coordinates,
    null,
    text("dashboard.popup.buildingSelection"),
  ).address;

  if (name && address) {
    return `${name} (${address})`;
  }

  return name ?? address ?? fallback;
}

function buildExternalMapSearchUrl(provider: "kakao" | "naver", query: string) {
  const encoded = encodeURIComponent(query);

  return provider === "naver"
    ? `https://map.naver.com/v5/search/${encoded}`
    : `https://map.kakao.com/link/search/${encoded}`;
}

function buildBuildingPopupHtml(
  buildingProperties: BuildingFeatureProperties | null,
  poiProperties: BuildingFeatureProperties | null,
  coordinates: [number, number],
  safetyProfile: BuildingSafetyProfile | null,
  text: DashboardText,
  formatLocale: string,
) {
  const name = buildingDisplayName(
    buildingProperties,
    poiProperties,
    safetyProfile,
  );
  const buildingType = formatBuildingClass(
    propertyText(buildingProperties, ["building", "type", "class"]),
    text,
  );
  const poiType = formatBuildingClass(
    propertyText(poiProperties, ["subclass", "class", "type"]),
    text,
  );
  const height = formatBuildingHeight(
    propertyText(buildingProperties, ["height", "render_height"]),
    formatLocale,
  );
  const levels = propertyText(buildingProperties, [
    "building:levels",
    "levels",
  ]);
  const address = buildingDisplayAddress(
    buildingProperties,
    poiProperties,
    safetyProfile,
  );
  const coordinateLabel = `${coordinates[1].toFixed(5)}, ${coordinates[0].toFixed(5)}`;
  const rows = [
    [text("dashboard.sheet.address"), address],
    [text("dashboard.sheet.category"), poiType ?? buildingType],
    [text("dashboard.popup.buildingUse"), buildingType],
    [text("dashboard.popup.height"), height],
    [
      text("dashboard.popup.floors"),
      levels ? text("dashboard.popup.floorCount", { count: levels }) : null,
    ],
    [text("dashboard.sheet.coordinates"), coordinateLabel],
    [text("dashboard.popup.data"), "OpenStreetMap / OpenMapTiles"],
  ].filter((row): row is [string, string] => Boolean(row[1]));
  const rowsHtml = rows
    .map(
      ([label, value]) =>
        `<div class="${styles.popupRow}"><dt>${escapeHtml(
          label,
        )}</dt><dd>${escapeHtml(value)}</dd></div>`,
    )
    .join("");
  const title = name
    ? text("dashboard.popup.buildingNamedTitle", { name })
    : text("dashboard.popup.buildingUnknownTitle");
  const subtitle =
    safetyProfile?.dataStatus === "sample"
      ? text("dashboard.popup.sampleSafetyProfile")
      : (poiType ?? buildingType ?? text("dashboard.popup.publicBuildingData"));
  const searchQuery = name ?? address ?? coordinateLabel;
  const sectionText =
    safetyProfile && safetyProfile.section.length > 0
      ? safetyProfile.section
          .map(
            (level) =>
              `${level.floor} ${level.use}${
                level.riskNote ? `(${level.riskNote})` : ""
              }`,
          )
          .join(" · ")
      : null;
  const evacuationRouteText = safetyProfile
    ? safetyProfile.floors
        .flatMap((floor) =>
          floor.evacuationRoutes.map(
            (route) =>
              `${route.floor} ${route.from}→${route.to}${
                route.estimatedDistanceMeters
                  ? ` ${route.estimatedDistanceMeters}m`
                  : ""
              }`,
          ),
        )
        .slice(0, 4)
        .join(" · ")
    : null;
  const sourceNotesText =
    safetyProfile && safetyProfile.sourceNotes.length > 0
      ? safetyProfile.sourceNotes.join(" ")
      : null;
  const safetyProfileSourceHref = safeLinkHref(safetyProfile?.sourceUrl);
  const safetyProfileSourceLabel = safetyProfile?.sourceLabel ?? "";
  const sourceLabel = safetyProfileSourceHref
    ? `<a href="${escapeHtml(
        safetyProfileSourceHref,
      )}" target="_blank" rel="noreferrer">${escapeHtml(
        safetyProfileSourceLabel,
      )}</a>`
    : escapeHtml(safetyProfileSourceLabel);
  const profileHtml = safetyProfile
    ? `<section class="${styles.popupSafety}">
        <strong>${escapeHtml(text("dashboard.popup.safetyProfileTitle"))}</strong>
        <p>${escapeHtml(
          safetyProfile.dataStatus === "sample"
            ? text("dashboard.popup.sampleSafetyDescription")
            : text("dashboard.popup.verifiedSafetyDescription"),
        )}</p>
        <dl class="${styles.popupDetails}">
          ${
            sectionText
              ? `<div class="${styles.popupRow}"><dt>${escapeHtml(text("dashboard.popup.sectionSummary"))}</dt><dd>${escapeHtml(
                  sectionText,
                )}</dd></div>`
              : ""
          }
          <div class="${styles.popupRow}"><dt>${escapeHtml(text("dashboard.popup.exits"))}</dt><dd>${escapeHtml(
            safetyProfile.exits
              .map((exit) => `${exit.floor} ${exit.label}(${exit.direction})`)
              .join(", "),
          )}</dd></div>
          <div class="${styles.popupRow}"><dt>${escapeHtml(text("dashboard.popup.assemblyPoint"))}</dt><dd>${escapeHtml(
            safetyProfile.nearestAssemblyPoint,
          )}</dd></div>
          ${
            evacuationRouteText
              ? `<div class="${styles.popupRow}"><dt>${escapeHtml(text("dashboard.popup.evacuationRoutes"))}</dt><dd>${escapeHtml(
                  evacuationRouteText,
                )}</dd></div>`
              : ""
          }
          <div class="${styles.popupRow}"><dt>${escapeHtml(text("dashboard.popup.floorStructure"))}</dt><dd>${escapeHtml(
            safetyProfile.floors
              .map(
                (floor) =>
                  `${floor.floor}: ${floor.keySpaces.join("/")}${
                    floor.hazards.length > 0
                      ? text("dashboard.popup.hazards", {
                          hazards: floor.hazards.join("/"),
                        })
                      : ""
                  }`,
              )
              .join(" · "),
          )}</dd></div>
          <div class="${styles.popupRow}"><dt>${escapeHtml(text("dashboard.sheet.source"))}</dt><dd>${sourceLabel}</dd></div>
          ${
            sourceNotesText
              ? `<div class="${styles.popupRow}"><dt>${escapeHtml(text("dashboard.popup.verificationNotes"))}</dt><dd>${escapeHtml(
                  sourceNotesText,
                )}</dd></div>`
              : ""
          }
        </dl>
      </section>`
    : `<section class="${styles.popupSafety}">
        <strong>${escapeHtml(text("dashboard.popup.noSafetyProfileTitle"))}</strong>
        <p>${escapeHtml(text("dashboard.popup.noSafetyProfileDescription"))}</p>
      </section>`;

  return `<article class="${styles.popup}">
    <div class="${styles.popupHeader}">
      <strong>${escapeHtml(title)}</strong>
      <span>${escapeHtml(subtitle)}</span>
    </div>
    <dl class="${styles.popupDetails}">${rowsHtml}</dl>
    ${profileHtml}
    <div class="${styles.popupActions}">
      <button ${BUILDING_REPORT_ACTION_ATTRIBUTE}="true" type="button">${escapeHtml(text("dashboard.popup.reportHere"))}</button>
      <a href="${buildExternalMapSearchUrl(
        "naver",
        searchQuery,
      )}" target="_blank" rel="noreferrer">${escapeHtml(text("dashboard.sheet.naverMap"))}</a>
      <a href="${buildExternalMapSearchUrl(
        "kakao",
        searchQuery,
      )}" target="_blank" rel="noreferrer">${escapeHtml(text("dashboard.sheet.kakaoMap"))}</a>
    </div>
  </article>`;
}

function dispatchRouteProviderLabel(route: DispatchRoute, text: DashboardText) {
  if (route.provider === "kakao") {
    return route.traffic?.status === "live"
      ? text("dashboard.route.kakaoLive")
      : text("dashboard.route.kakao");
  }

  return route.traffic?.status === "live"
    ? text("dashboard.route.astarLive")
    : text("dashboard.route.astar");
}

function dispatchRouteTrafficStatus(route: DispatchRoute, text: DashboardText) {
  if (!route.traffic) {
    return "";
  }

  if (route.traffic.status === "live") {
    return ` · ${route.traffic.message}`;
  }

  if (route.traffic.status === "unconfigured") {
    return text("dashboard.route.trafficUnconfigured");
  }

  return ` · ${route.traffic.message}`;
}

function buildUserLocationPopupHtml(
  location: UserLocation,
  text: DashboardText,
  formatLocale: string,
) {
  const rows = [
    [
      text("dashboard.sheet.coordinates"),
      `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`,
    ],
    [
      text("dashboard.sheet.accuracy"),
      distanceText(location.accuracy, formatLocale),
    ],
    [
      text("dashboard.sheet.checkedAt"),
      formatDateTime(location.locatedAt, formatLocale),
    ],
  ];
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
      <strong>${escapeHtml(text("dashboard.sheet.userLocationTitle"))}</strong>
      <span>${escapeHtml(text("dashboard.sheet.userLocationSubtitle"))}</span>
    </div>
    <dl class="${styles.popupDetails}">${rowsHtml}</dl>
  </article>`;
}

function buildReportLocationPopupHtml(
  location: ReportLocation,
  text: DashboardText,
) {
  const coordinateLabel = `${location.latitude.toFixed(
    5,
  )}, ${location.longitude.toFixed(5)}`;
  const rows = [
    [text("dashboard.sheet.address"), location.address],
    [text("dashboard.sheet.coordinates"), coordinateLabel],
    [text("dashboard.sheet.status"), text("dashboard.sheet.reportStatus")],
  ];
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
      <strong>${escapeHtml(text("dashboard.sheet.reportLocationTitle"))}</strong>
      <span>${escapeHtml(text("dashboard.sheet.reportLocationSubtitle"))}</span>
    </div>
    <dl class="${styles.popupDetails}">${rowsHtml}</dl>
  </article>`;
}

function buildBigData119PopupHtml(
  point: BigData119MapPoint,
  text: DashboardText,
) {
  const coordinateLabel = `${point.latitude.toFixed(5)}, ${point.longitude.toFixed(5)}`;
  const sourceHref = safeLinkHref(point.sourceUrl);
  const rows = [
    [text("dashboard.sheet.type"), text(BIGDATA119_KIND_LABEL[point.kind])],
    [text("dashboard.sheet.category"), point.category],
    [text("dashboard.sheet.address"), point.address],
    [
      text("dashboard.sheet.region"),
      [point.city, point.district].filter(Boolean).join(" "),
    ],
    [
      text("dashboard.sheet.governingOffice"),
      [point.stationName, point.centerName].filter(Boolean).join(" / "),
    ],
    [text("dashboard.sheet.status"), point.status],
    [text("dashboard.sheet.coordinates"), coordinateLabel],
    [
      text("dashboard.sheet.dataStatus"),
      point.isSample
        ? text("dashboard.popup.bigDataSample")
        : text("dashboard.popup.bigDataCsv"),
    ],
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
      <strong>${escapeHtml(point.name)}</strong>
      <span>${escapeHtml(point.sourceLabel)}</span>
    </div>
    <dl class="${styles.popupDetails}">${rowsHtml}</dl>
    <div class="${styles.popupActions}">
      ${
        sourceHref
          ? `<a href="${escapeHtml(
              sourceHref,
            )}" target="_blank" rel="noreferrer">${escapeHtml(
              text("dashboard.sheet.source"),
            )}</a>`
          : ""
      }
      <a href="${buildExternalMapSearchUrl(
        "naver",
        point.address || point.name || coordinateLabel,
      )}" target="_blank" rel="noreferrer">${escapeHtml(text("dashboard.sheet.naverMap"))}</a>
    </div>
  </article>`;
}

function formatDateTime(value: string, formatLocale: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(formatLocale, {
    dateStyle: "medium",
    timeZone: "Asia/Seoul",
    timeStyle: "short",
  }).format(date);
}

function localDateTimeInputValue(date: Date) {
  const timezoneOffsetMs = date.getTimezoneOffset() * 60_000;

  return new Date(date.getTime() - timezoneOffsetMs).toISOString().slice(0, 16);
}

function localDateTimeToIso(value: string) {
  if (!value) {
    return;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

type DashboardText = (
  key: string,
  values?: Record<string, string | number>,
) => string;

function buildingDataStatus(
  safetyProfile: BuildingSafetyProfile | null,
  text: DashboardText,
) {
  if (!safetyProfile) {
    return text("dashboard.sheet.noSafetyProfile");
  }

  return safetyProfile.dataStatus === "sample"
    ? text("dashboard.sheet.sampleData")
    : text("dashboard.sheet.verifiedData");
}

function OperationalSourceIcon({ kind }: { kind: string }) {
  if (kind === "ems-dispatch") {
    return <Ambulance aria-hidden="true" size={16} />;
  }

  return kind === "rescue-dispatch" ? (
    <Truck aria-hidden="true" size={16} />
  ) : (
    <AlertTriangle aria-hidden="true" size={16} />
  );
}

function DataSourceItemLink({
  children,
  unsafeHref,
}: {
  children: ReactNode;
  unsafeHref: string;
}) {
  const safeHref = safeLinkHref(unsafeHref);

  return safeHref ? (
    <a
      className={styles.dataSourceItem}
      href={safeHref}
      rel="noreferrer"
      target="_blank"
    >
      {children}
    </a>
  ) : (
    <div className={styles.dataSourceItem}>{children}</div>
  );
}

function coordinateText(latitude: number, longitude: number) {
  return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
}

function compactRows(
  rows: [string, string | null | undefined][],
): MobileSheetRow[] {
  return rows
    .filter((row): row is [string, string] => Boolean(row[1]))
    .map(([label, value]) => ({ label, value }));
}

function userLocationSheet(
  location: UserLocation,
  text: DashboardText,
  formatLocale: string,
): MobileSheet {
  return {
    id: `user-${location.locatedAt}`,
    rows: compactRows([
      [
        text("dashboard.sheet.coordinates"),
        coordinateText(location.latitude, location.longitude),
      ],
      [
        text("dashboard.sheet.accuracy"),
        distanceText(location.accuracy, formatLocale),
      ],
      [
        text("dashboard.sheet.checkedAt"),
        formatDateTime(location.locatedAt, formatLocale),
      ],
    ]),
    subtitle: text("dashboard.sheet.userLocationSubtitle"),
    title: text("dashboard.sheet.userLocationTitle"),
  };
}

function reportLocationSheet(
  location: ReportLocation,
  text: DashboardText,
): MobileSheet {
  return {
    id: `report-${location.latitude}-${location.longitude}`,
    rows: compactRows([
      [text("dashboard.sheet.address"), location.address],
      [
        text("dashboard.sheet.coordinates"),
        coordinateText(location.latitude, location.longitude),
      ],
      [text("dashboard.sheet.status"), text("dashboard.sheet.reportStatus")],
    ]),
    subtitle: text("dashboard.sheet.reportLocationSubtitle"),
    title: text("dashboard.sheet.reportLocationTitle"),
  };
}

function bigData119Sheet(
  point: BigData119MapPoint,
  text: DashboardText,
): MobileSheet {
  const searchQuery = point.address || point.name || point.sourceLabel;
  const sourceHref = safeLinkHref(point.sourceUrl);
  const sourceLinks = sourceHref
    ? [
        {
          href: sourceHref,
          label: text("dashboard.sheet.source"),
        },
      ]
    : [];

  return {
    id: `bigdata-${point.id}`,
    links: [
      ...sourceLinks,
      {
        href: buildExternalMapSearchUrl("naver", searchQuery),
        label: text("dashboard.sheet.naverMap"),
      },
    ],
    rows: compactRows([
      [text("dashboard.sheet.type"), text(BIGDATA119_KIND_LABEL[point.kind])],
      [text("dashboard.sheet.category"), point.category],
      [text("dashboard.sheet.address"), point.address],
      [
        text("dashboard.sheet.region"),
        [point.city, point.district].filter(Boolean).join(" "),
      ],
      [
        text("dashboard.sheet.governingOffice"),
        [point.stationName, point.centerName].filter(Boolean).join(" / "),
      ],
      [text("dashboard.sheet.status"), point.status],
      [
        text("dashboard.sheet.coordinates"),
        coordinateText(point.latitude, point.longitude),
      ],
      [
        text("dashboard.sheet.dataStatus"),
        point.isSample
          ? text("dashboard.sheet.sampleData")
          : text("dashboard.sheet.approvedCsv"),
      ],
    ]),
    subtitle: point.sourceLabel,
    title: point.name,
  };
}

function buildingSheet(
  report: ReportLocation,
  name: string | null,
  safetyProfile: BuildingSafetyProfile | null,
  text: DashboardText,
): MobileSheet {
  return {
    id: `building-${report.latitude}-${report.longitude}`,
    links: [
      {
        href: buildExternalMapSearchUrl("naver", name ?? report.address),
        label: text("dashboard.sheet.naverMap"),
      },
      {
        href: buildExternalMapSearchUrl("kakao", name ?? report.address),
        label: text("dashboard.sheet.kakaoMap"),
      },
    ],
    rows: compactRows([
      [text("dashboard.sheet.address"), report.address],
      [
        text("dashboard.sheet.coordinates"),
        coordinateText(report.latitude, report.longitude),
      ],
      [
        text("dashboard.sheet.dataStatus"),
        buildingDataStatus(safetyProfile, text),
      ],
      [
        text("dashboard.sheet.assemblyPoint"),
        safetyProfile?.nearestAssemblyPoint,
      ],
    ]),
    subtitle: text("dashboard.sheet.buildingSubtitle"),
    title: name ?? text("dashboard.sheet.buildingTitle"),
  };
}

function incidentFormValue(incident: Incident): IncidentForm {
  return {
    address: incident.address,
    description: incident.description,
    latitude: incident.latitude.toFixed(6),
    longitude: incident.longitude.toFixed(6),
    occurredAt: localDateTimeInputValue(new Date(incident.occurredAt)),
    riskLevel: incident.riskLevel,
    title: incident.title,
    type: incident.type,
  };
}

function distanceText(value: number, formatLocale: string) {
  if (value >= 1000) {
    return `${(value / 1000).toLocaleString(formatLocale, {
      maximumFractionDigits: 1,
    })}km`;
  }

  return `${value.toLocaleString(formatLocale)}m`;
}

function addDashboardLayers(map: MapLibreMap) {
  if (!map.getSource(RISK_AREAS_SOURCE_ID)) {
    map.addSource(RISK_AREAS_SOURCE_ID, {
      data: EMPTY_FEATURE_COLLECTION,
      type: "geojson",
    });
  }
  if (!map.getSource(ROUTE_SOURCE_ID)) {
    map.addSource(ROUTE_SOURCE_ID, {
      data: EMPTY_FEATURE_COLLECTION,
      type: "geojson",
    });
  }
  if (!map.getSource(FIRE_STATIONS_SOURCE_ID)) {
    map.addSource(FIRE_STATIONS_SOURCE_ID, {
      data: EMPTY_FEATURE_COLLECTION,
      type: "geojson",
    });
  }
  if (!map.getSource(HOSPITALS_SOURCE_ID)) {
    map.addSource(HOSPITALS_SOURCE_ID, {
      data: EMPTY_FEATURE_COLLECTION,
      type: "geojson",
    });
  }
  if (!map.getSource(INCIDENTS_SOURCE_ID)) {
    map.addSource(INCIDENTS_SOURCE_ID, {
      data: EMPTY_FEATURE_COLLECTION,
      type: "geojson",
    });
  }
  if (!map.getSource(BIGDATA119_SOURCE_ID)) {
    map.addSource(BIGDATA119_SOURCE_ID, {
      data: EMPTY_FEATURE_COLLECTION,
      type: "geojson",
    });
  }
  if (!map.getSource(USER_LOCATION_SOURCE_ID)) {
    map.addSource(USER_LOCATION_SOURCE_ID, {
      data: EMPTY_FEATURE_COLLECTION,
      type: "geojson",
    });
  }
  if (!map.getSource(REPORT_LOCATION_SOURCE_ID)) {
    map.addSource(REPORT_LOCATION_SOURCE_ID, {
      data: EMPTY_FEATURE_COLLECTION,
      type: "geojson",
    });
  }

  if (!map.getLayer(RISK_AREA_LAYER_ID)) {
    map.addLayer({
      id: RISK_AREA_LAYER_ID,
      paint: {
        "circle-color": ["get", "color"],
        "circle-opacity": 0.22,
        "circle-radius": [
          "interpolate",
          ["linear"],
          ["get", "riskScore"],
          30,
          26,
          100,
          70,
        ],
        "circle-stroke-color": ["get", "color"],
        "circle-stroke-opacity": 0.7,
        "circle-stroke-width": 2,
      },
      source: RISK_AREAS_SOURCE_ID,
      type: "circle",
    });
  }
  if (!map.getLayer(ROUTE_LAYER_ID)) {
    map.addLayer({
      id: ROUTE_LAYER_ID,
      layout: {
        "line-cap": "round",
        "line-join": "round",
      },
      paint: {
        "line-color": "#2563eb",
        "line-dasharray": [1.5, 1],
        "line-opacity": 0.86,
        "line-width": 5,
      },
      source: ROUTE_SOURCE_ID,
      type: "line",
    });
  }
  if (!map.getLayer(FIRE_STATION_LAYER_ID)) {
    map.addLayer({
      id: FIRE_STATION_LAYER_ID,
      paint: {
        "circle-color": "#7c3aed",
        "circle-radius": 9,
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 3,
      },
      source: FIRE_STATIONS_SOURCE_ID,
      type: "circle",
    });
  }
  if (!map.getLayer(HOSPITAL_LAYER_ID)) {
    map.addLayer({
      id: HOSPITAL_LAYER_ID,
      paint: {
        "circle-color": "#0f766e",
        "circle-radius": 7,
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 2,
      },
      source: HOSPITALS_SOURCE_ID,
      type: "circle",
    });
  }
  if (!map.getLayer(INCIDENT_LAYER_ID)) {
    map.addLayer({
      id: INCIDENT_LAYER_ID,
      paint: {
        "circle-color": [
          "match",
          ["get", "riskLevel"],
          "high",
          "#e11d48",
          "medium",
          "#f59e0b",
          "#16a34a",
        ],
        "circle-radius": ["case", ["==", ["get", "selected"], true], 15, 10],
        "circle-stroke-color": [
          "case",
          ["==", ["get", "selected"], true],
          "#111827",
          "#ffffff",
        ],
        "circle-stroke-width": [
          "case",
          ["==", ["get", "selected"], true],
          4,
          3,
        ],
      },
      source: INCIDENTS_SOURCE_ID,
      type: "circle",
    });
  }
  if (!map.getLayer(BIGDATA119_TARGET_LAYER_ID)) {
    map.addLayer({
      filter: ["==", ["get", "kind"], "fire-safety-target"],
      id: BIGDATA119_TARGET_LAYER_ID,
      paint: {
        "circle-color": BIGDATA119_KIND_COLOR["fire-safety-target"],
        "circle-opacity": 0.88,
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 7, 4, 14, 7],
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 2,
      },
      source: BIGDATA119_SOURCE_ID,
      type: "circle",
    });
  }
  if (!map.getLayer(BIGDATA119_WATER_LAYER_ID)) {
    map.addLayer({
      filter: ["==", ["get", "kind"], "fire-water-source"],
      id: BIGDATA119_WATER_LAYER_ID,
      paint: {
        "circle-color": BIGDATA119_KIND_COLOR["fire-water-source"],
        "circle-opacity": 0.88,
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 7, 4, 14, 7],
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 2,
      },
      source: BIGDATA119_SOURCE_ID,
      type: "circle",
    });
  }
  if (!map.getLayer(BIGDATA119_LABEL_LAYER_ID)) {
    map.addLayer({
      layout: {
        "text-field": ["get", "label"],
        "text-font": ["Noto Sans Regular"],
        "text-offset": [0, 1.15],
        "text-size": 11,
      },
      minzoom: 12,
      paint: {
        "text-color": "#0f172a",
        "text-halo-color": "#ffffff",
        "text-halo-width": 1.4,
      },
      source: BIGDATA119_SOURCE_ID,
      type: "symbol",
      id: BIGDATA119_LABEL_LAYER_ID,
    });
  }
  if (!map.getLayer(REPORT_LOCATION_HALO_LAYER_ID)) {
    map.addLayer({
      id: REPORT_LOCATION_HALO_LAYER_ID,
      paint: {
        "circle-color": "#f97316",
        "circle-opacity": 0.24,
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 8, 18, 15, 42],
        "circle-stroke-color": "#f97316",
        "circle-stroke-opacity": 0.75,
        "circle-stroke-width": 2,
      },
      source: REPORT_LOCATION_SOURCE_ID,
      type: "circle",
    });
  }
  if (!map.getLayer(REPORT_LOCATION_POINT_LAYER_ID)) {
    map.addLayer({
      id: REPORT_LOCATION_POINT_LAYER_ID,
      paint: {
        "circle-color": "#f97316",
        "circle-radius": 11,
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 3,
      },
      source: REPORT_LOCATION_SOURCE_ID,
      type: "circle",
    });
  }
  if (!map.getLayer(REPORT_LOCATION_LABEL_LAYER_ID)) {
    map.addLayer({
      id: REPORT_LOCATION_LABEL_LAYER_ID,
      layout: {
        "text-field": ["get", "label"],
        "text-font": ["Noto Sans Bold"],
        "text-offset": [0, 1.35],
        "text-size": 13,
      },
      paint: {
        "text-color": "#c2410c",
        "text-halo-color": "#ffffff",
        "text-halo-width": 2,
      },
      source: REPORT_LOCATION_SOURCE_ID,
      type: "symbol",
    });
  }
  if (!map.getLayer(USER_LOCATION_ACCURACY_LAYER_ID)) {
    map.addLayer({
      id: USER_LOCATION_ACCURACY_LAYER_ID,
      paint: {
        "circle-color": "#2563eb",
        "circle-opacity": 0.14,
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 8, 9, 15, 34],
        "circle-stroke-color": "#2563eb",
        "circle-stroke-opacity": 0.34,
        "circle-stroke-width": 1,
      },
      source: USER_LOCATION_SOURCE_ID,
      type: "circle",
    });
  }
  if (!map.getLayer(USER_LOCATION_POINT_LAYER_ID)) {
    map.addLayer({
      id: USER_LOCATION_POINT_LAYER_ID,
      paint: {
        "circle-color": "#2563eb",
        "circle-radius": 8,
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 3,
      },
      source: USER_LOCATION_SOURCE_ID,
      type: "circle",
    });
  }
  if (!map.getLayer(USER_LOCATION_LABEL_LAYER_ID)) {
    map.addLayer({
      id: USER_LOCATION_LABEL_LAYER_ID,
      layout: {
        "text-field": ["get", "label"],
        "text-font": ["Noto Sans Regular"],
        "text-offset": [0, 1.1],
        "text-size": 12,
      },
      paint: {
        "text-color": "#1d4ed8",
        "text-halo-color": "#ffffff",
        "text-halo-width": 1.6,
      },
      source: USER_LOCATION_SOURCE_ID,
      type: "symbol",
    });
  }
}

function setSourceData(map: MapLibreMap, sourceId: string, data: GeoJsonData) {
  const source = map.getSource(sourceId);

  if (source && "setData" in source) {
    (source as GeoJSONSource).setData(data);
  }
}

function suppressPopupContextMenu(popup: MapLibrePopup | null) {
  const element = popup?.getElement();
  const blockContextMenu = (event: Event) => {
    event.preventDefault();
    event.stopPropagation();
  };

  element?.addEventListener("contextmenu", blockContextMenu, {
    capture: true,
  });
  element?.addEventListener("auxclick", blockContextMenu, { capture: true });
  element?.addEventListener(
    "pointerdown",
    (event) => {
      if (event.button === 2) {
        blockContextMenu(event);
      }
    },
    { capture: true },
  );
}

function featureId(feature: MapGeoJSONFeature | undefined) {
  const id = feature?.properties?.id;

  return typeof id === "string" ? id : null;
}

function fitMapToSnapshot(map: MapLibreMap, snapshot: DashboardSnapshot) {
  const coordinates = [
    ...snapshot.incidents,
    ...snapshot.fireStations,
    ...snapshot.hospitals,
    ...snapshot.riskAreas,
    ...snapshot.bigData119Points,
  ]
    .map((item) => [item.longitude, item.latitude] as [number, number])
    .filter(([longitude, latitude]) =>
      [longitude, latitude].every(Number.isFinite),
    );

  if (coordinates.length === 0) {
    return;
  }

  const longitudes = coordinates.map(([longitude]) => longitude);
  const latitudes = coordinates.map(([, latitude]) => latitude);

  map.fitBounds(
    [
      [Math.min(...longitudes), Math.min(...latitudes)],
      [Math.max(...longitudes), Math.max(...latitudes)],
    ],
    {
      duration: 0,
      maxZoom: 11.8,
      padding: 70,
    },
  );
}

export function DisasterDashboard({
  dictionary,
  initialView = "dashboard",
  mapSettings = DEFAULT_MAP_RENDERING_SETTINGS,
  vworldApiKey = "",
}: DisasterDashboardProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const maplibreRef = useRef<MapLibreModule | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const popupRef = useRef<MapLibrePopup | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const [isThreeDimensional, setIsThreeDimensional] = useState(false);
  const isThreeDimensionalRef = useRef(false);
  const effectiveMapSettings = useMemo(
    () => ({
      ...DEFAULT_MAP_RENDERING_SETTINGS,
      ...mapSettings,
    }),
    [mapSettings],
  );
  const [isLocating, setIsLocating] = useState(false);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [reportLocation, setReportLocation] = useState<ReportLocation | null>(
    null,
  );
  const [visibleBigDataKinds, setVisibleBigDataKinds] = useState<
    Record<BigData119PointKind, boolean>
  >({
    "fire-safety-target": true,
    "fire-water-source": true,
  });
  const [view, setView] = useState<DashboardView>(initialView);
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [activeIncident, setActiveIncident] = useState<Incident | null>(null);
  const [isDeleteConfirmationOpen, setIsDeleteConfirmationOpen] =
    useState(false);
  const [activeIncidentEvents, setActiveIncidentEvents] = useState<
    IncidentEvent[]
  >([]);
  const [activeRiskArea, setActiveRiskArea] = useState<RiskArea | null>(null);
  const [dispatchRecommendation, setDispatchRecommendation] =
    useState<DispatchRecommendation | null>(null);
  const [dispatchRoute, setDispatchRoute] = useState<DispatchRoute | null>(
    null,
  );
  const [dispatchRouteStatus, setDispatchRouteStatus] = useState<string | null>(
    null,
  );
  const [isDispatchRouteLoading, setIsDispatchRouteLoading] = useState(false);
  const [hospitalRecommendations, setHospitalRecommendations] = useState<
    HospitalRecommendation[]
  >([]);
  const [mobileSheet, setMobileSheet] = useState<MobileSheet | null>(null);
  const [mobileSheetDragOffset, setMobileSheetDragOffset] = useState(0);
  const [mapContextMenu, setMapContextMenu] =
    useState<MapContextMenuState | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [simulationScenario, setSimulationScenario] = useState<
    SimulationResponse["scenario"] | null
  >(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSimulationLoading, setIsSimulationLoading] = useState(false);
  const [isStatusUpdating, setIsStatusUpdating] = useState(false);
  const [isIncidentDeleting, setIsIncidentDeleting] = useState(false);
  const [isIncidentSaving, setIsIncidentSaving] = useState(false);
  const [incidentSearch, setIncidentSearch] = useState("");
  const [incidentStatusFilter, setIncidentStatusFilter] =
    useState<IncidentStatusFilter>("all");
  const [incidentTypeFilter, setIncidentTypeFilter] =
    useState<IncidentTypeFilter>("all");
  const [editIncidentId, setEditIncidentId] = useState<string | null>(null);
  const [editIncidentForm, setEditIncidentForm] = useState<IncidentForm | null>(
    null,
  );
  const [form, setForm] = useState<IncidentForm>({
    address: dictionary.dashboard["dashboard.form.defaultAddress"] ?? "",
    description: "",
    latitude: "37.5665",
    longitude: "126.9780",
    occurredAt: localDateTimeInputValue(new Date()),
    riskLevel: "high",
    title: dictionary.dashboard["dashboard.form.defaultTitle"] ?? "",
    type: "fire",
  });

  const incidentsRef = useRef<Incident[]>([]);
  const riskAreasRef = useRef<RiskArea[]>([]);
  const bigData119PointsRef = useRef<BigData119MapPoint[]>([]);
  const userLocationRef = useRef<UserLocation | null>(null);
  const reportLocationRef = useRef<ReportLocation | null>(null);
  const didFitInitialSnapshotRef = useRef(false);
  const mobileSheetDragStartRef = useRef<number | null>(null);
  const dashboardText = useCallback(
    (key: string, values: Record<string, string | number> = {}) => {
      const template = dictionary.dashboard[key];
      if (!template) return uiText(dictionary, key, values);
      return template.replace(/\{(\w+)\}/g, (match, name) =>
        Object.hasOwn(values, name) ? String(values[name]) : match,
      );
    },
    [dictionary],
  );

  const applyReportLocation = useCallback(
    (report: ReportLocation, message: string) => {
      reportLocationRef.current = report;
      setReportLocation(report);
      setForm((current) => ({
        ...current,
        address: report.address,
        latitude: report.latitude.toFixed(6),
        longitude: report.longitude.toFixed(6),
      }));
      setNotice(message);
      setView("create");
    },
    [],
  );

  const closeMapContextMenu = useCallback(() => {
    setMapContextMenu(null);
  }, []);

  const loadSnapshot = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/disaster/dashboard", {
        cache: "no-store",
      });
      const payload = (await response.json()) as DashboardSnapshot & {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(
          payload.error ?? dashboardText("dashboard.notice.loadFailed"),
        );
      }

      setSnapshot(payload);
      setActiveIncident((current) =>
        current
          ? (payload.incidents.find((incident) => incident.id === current.id) ??
            null)
          : payload.activeIncident,
      );
      setDispatchRecommendation(payload.dispatchRecommendation);
      setDispatchRoute(null);
      setDispatchRouteStatus(null);
      setHospitalRecommendations(payload.hospitalRecommendations);
      incidentsRef.current = payload.incidents;
      riskAreasRef.current = payload.riskAreas;
      bigData119PointsRef.current = payload.bigData119Points;
      setNotice(null);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setIsLoading(false);
    }
  }, [dashboardText]);

  const loadRecommendations = useCallback(
    async (incident: Incident) => {
      popupRef.current?.remove();
      setMobileSheet(null);
      setMobileSheetDragOffset(0);
      reportLocationRef.current = null;
      setReportLocation(null);
      setActiveIncident(incident);
      setView("incidents");

      const response = await fetch(
        `/api/disaster/recommendations?incidentId=${encodeURIComponent(
          incident.id,
        )}`,
        { cache: "no-store" },
      );
      const payload = (await response.json()) as RecommendationResponse & {
        error?: string;
      };

      if (!response.ok) {
        setNotice(
          payload.error ??
            dashboardText("dashboard.notice.recommendationFailed"),
        );
        return;
      }

      setDispatchRecommendation(payload.dispatchRecommendation);
      setDispatchRoute(null);
      setDispatchRouteStatus(null);
      setHospitalRecommendations(payload.hospitalRecommendations);
      const detailResponse = await fetch(
        `/api/disaster/incidents/${encodeURIComponent(incident.id)}`,
        { cache: "no-store" },
      );
      const detailPayload = (await detailResponse
        .json()
        .catch(() => null)) as IncidentDetailResponse | null;
      setActiveIncidentEvents(
        detailResponse.ok && detailPayload?.events ? detailPayload.events : [],
      );
      mapRef.current?.flyTo({
        center: [incident.longitude, incident.latitude],
        essential: true,
        zoom: 13,
      });
    },
    [dashboardText],
  );

  useEffect(() => {
    if (!(activeIncident && dispatchRecommendation)) {
      setDispatchRoute(null);
      setDispatchRouteStatus(null);
      setIsDispatchRouteLoading(false);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 9_000);

    setIsDispatchRouteLoading(true);
    setDispatchRoute(null);
    setDispatchRouteStatus(dashboardText("dashboard.route.calculating"));

    fetch("/api/routing/route", {
      body: JSON.stringify({
        destination: {
          latitude: activeIncident.latitude,
          longitude: activeIncident.longitude,
        },
        origin: {
          latitude: dispatchRecommendation.station.latitude,
          longitude: dispatchRecommendation.station.longitude,
        },
        provider: "astar",
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = (await response.json()) as DispatchRouteResponse;

        if (!(response.ok && payload.route)) {
          throw new Error(
            payload.error ?? dashboardText("dashboard.route.failed"),
          );
        }

        setDispatchRoute(payload.route);
        setDispatchRouteStatus(
          dashboardText("dashboard.route.summary", {
            distance: distanceText(
              payload.route.distanceMeters,
              dictionary.formatLocale,
            ),
            minutes: Math.max(
              1,
              Math.round(payload.route.durationSeconds / 60),
            ),
            provider: dispatchRouteProviderLabel(payload.route, dashboardText),
            traffic: dispatchRouteTrafficStatus(payload.route, dashboardText),
          }),
        );
      })
      .catch((error) => {
        if (controller.signal.aborted) {
          setDispatchRouteStatus(dashboardText("dashboard.route.timeout"));
          return;
        }

        setDispatchRouteStatus(
          dashboardText("dashboard.route.fallback", {
            error: error instanceof Error ? error.message : String(error),
          }),
        );
      })
      .finally(() => {
        window.clearTimeout(timeout);
        setIsDispatchRouteLoading(false);
      });

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [
    activeIncident,
    dashboardText,
    dictionary.formatLocale,
    dispatchRecommendation,
  ]);

  const locateUser = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setNotice(dashboardText("dashboard.notice.geolocationUnsupported"));
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const location: UserLocation = {
          accuracy: Math.round(position.coords.accuracy),
          latitude: position.coords.latitude,
          locatedAt: new Date().toISOString(),
          longitude: position.coords.longitude,
        };
        const report: ReportLocation = {
          address: dashboardText("dashboard.location.current", {
            latitude: location.latitude.toFixed(5),
            longitude: location.longitude.toFixed(5),
          }),
          latitude: location.latitude,
          longitude: location.longitude,
        };

        userLocationRef.current = location;
        setUserLocation(location);
        reportLocationRef.current = report;
        setReportLocation(report);
        setForm((current) => ({
          ...current,
          address: report.address,
          latitude: location.latitude.toFixed(6),
          longitude: location.longitude.toFixed(6),
        }));
        setNotice(dashboardText("dashboard.notice.locationApplied"));
        setMobileSheet(reportLocationSheet(report, dashboardText));
        setMobileSheetDragOffset(0);

        const map = mapRef.current;
        const maplibre = maplibreRef.current;

        if (map && maplibre) {
          map.flyTo({
            bearing: isThreeDimensionalRef.current
              ? THREE_DIMENSIONAL_BEARING
              : 0,
            center: [location.longitude, location.latitude],
            essential: true,
            pitch: isThreeDimensionalRef.current ? THREE_DIMENSIONAL_PITCH : 0,
            zoom: Math.max(map.getZoom(), 15),
          });

          popupRef.current?.remove();
          popupRef.current = new maplibre.Popup({
            closeButton: true,
            maxWidth: "300px",
            offset: 14,
          })
            .setLngLat([location.longitude, location.latitude])
            .setHTML(buildReportLocationPopupHtml(report, dashboardText))
            .addTo(map);
          suppressPopupContextMenu(popupRef.current);
        }

        setIsLocating(false);
      },
      (error) => {
        setNotice(
          error.message
            ? dashboardText("dashboard.notice.locationFailedWithReason", {
                error: error.message,
              })
            : dashboardText("dashboard.notice.locationFailed"),
        );
        setIsLocating(false);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 30_000,
        timeout: 12_000,
      },
    );
  }, [dashboardText]);

  useEffect(() => {
    void loadSnapshot();
  }, [loadSnapshot]);

  useIncidentEvents(() => {
    void loadSnapshot();
  });

  useEffect(() => {
    setView(initialView);
  }, [initialView]);

  useEffect(() => {
    if (!activeIncident) {
      setActiveIncidentEvents([]);
      return;
    }

    let disposed = false;
    const incidentId = activeIncident.id;

    async function loadIncidentEvents() {
      const response = await fetch(
        `/api/disaster/incidents/${encodeURIComponent(incidentId)}`,
        { cache: "no-store" },
      );
      const payload = (await response
        .json()
        .catch(() => null)) as IncidentDetailResponse | null;

      if (!disposed) {
        setActiveIncidentEvents(
          response.ok && payload?.events ? payload.events : [],
        );
      }
    }

    void loadIncidentEvents();

    return () => {
      disposed = true;
    };
  }, [activeIncident]);

  useEffect(() => {
    isThreeDimensionalRef.current = isThreeDimensional;

    const map = mapRef.current;

    if (!(map && isMapReady)) {
      return;
    }

    syncThreeDimensionalView(map, isThreeDimensional, effectiveMapSettings);
  }, [effectiveMapSettings, isMapReady, isThreeDimensional]);

  useEffect(() => {
    userLocationRef.current = userLocation;

    const map = mapRef.current;

    if (!(map && isMapReady)) {
      return;
    }

    setSourceData(
      map,
      USER_LOCATION_SOURCE_ID,
      userLocationData(userLocation, dashboardText),
    );
  }, [dashboardText, isMapReady, userLocation]);

  useEffect(() => {
    reportLocationRef.current = reportLocation;

    const map = mapRef.current;

    if (!(map && isMapReady)) {
      return;
    }

    setSourceData(
      map,
      REPORT_LOCATION_SOURCE_ID,
      reportLocationData(reportLocation, dashboardText),
    );
  }, [dashboardText, isMapReady, reportLocation]);

  useEffect(() => {
    if (!reportLocation) {
      return;
    }

    const latitude = Number(form.latitude);
    const longitude = Number(form.longitude);

    if (!(Number.isFinite(latitude) && Number.isFinite(longitude))) {
      return;
    }

    const address = form.address.trim() || reportLocation.address;

    if (
      Math.abs(reportLocation.latitude - latitude) < 0.000001 &&
      Math.abs(reportLocation.longitude - longitude) < 0.000001 &&
      reportLocation.address === address
    ) {
      return;
    }

    setReportLocation({
      address,
      latitude,
      longitude,
    });
  }, [form.address, form.latitude, form.longitude, reportLocation]);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) {
      return;
    }

    let disposed = false;
    const cleanupFns: (() => void)[] = [];

    async function createMap() {
      if (disposed || !mapContainerRef.current) {
        return;
      }

      let maplibre: MapLibreModule;

      try {
        maplibre = await import("maplibre-gl");
      } catch {
        setNotice(dashboardText("dashboard.notice.mapFailed"));
        return;
      }

      const container = mapContainerRef.current;

      if (disposed || !container || mapRef.current) {
        return;
      }

      maplibreRef.current = maplibre;
      let map: MapLibreMap;

      try {
        map = createDashboardMapInstance(maplibre, container, {
          forceWebgl: true,
          mapSettings: effectiveMapSettings,
          threeDimensional: isThreeDimensionalRef.current,
          vworldApiKey,
        });
      } catch {
        resetDashboardMapContainer(container);

        try {
          map = createDashboardMapInstance(maplibre, container, {
            forceWebgl: false,
            mapSettings: effectiveMapSettings,
            threeDimensional: isThreeDimensionalRef.current,
            vworldApiKey,
          });
        } catch {
          resetDashboardMapContainer(container);
          setNotice(dashboardText("dashboard.notice.mapFailed"));
          return;
        }
      }

      if (disposed) {
        map.remove();
        return;
      }

      mapRef.current = map;
      map.addControl(
        new maplibre.NavigationControl({ showCompass: true }),
        "top-right",
      );

      function selectReportLocation(report: ReportLocation, message: string) {
        applyReportLocation(report, message);
      }

      function openMapActionMenu(
        point: { x: number; y: number },
        lngLat: { lat: number; lng: number },
        isMobile: boolean,
      ) {
        popupRef.current?.remove();
        setMobileSheet(null);
        setMobileSheetDragOffset(0);
        mobileSheetDragStartRef.current = null;
        const latitude = Number(lngLat.lat.toFixed(6));
        const longitude = Number(lngLat.lng.toFixed(6));
        const menuWidth = 312;
        const menuHeight = 280;
        const screenX = Math.min(
          Math.max(point.x, 12),
          Math.max(12, container.clientWidth - menuWidth - 12),
        );
        const screenY = Math.min(
          Math.max(point.y, 12),
          Math.max(12, container.clientHeight - menuHeight - 12),
        );

        setMapContextMenu({
          address: null,
          isAddressLoading: false,
          isMobile,
          isRecommendationLoading: false,
          latitude,
          longitude,
          recommendation: null,
          screenX,
          screenY,
          status: null,
        });
      }

      function installLongPressMenu() {
        const canvas = map.getCanvas();
        let startPoint: { x: number; y: number } | null = null;
        let startLngLat: { lat: number; lng: number } | null = null;
        let timeoutId: number | null = null;

        function clearLongPress() {
          if (timeoutId !== null) {
            window.clearTimeout(timeoutId);
            timeoutId = null;
          }
          startPoint = null;
          startLngLat = null;
        }

        function canvasPoint(event: PointerEvent) {
          const rect = canvas.getBoundingClientRect();
          return {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top,
          };
        }

        function beginLongPress(event: PointerEvent) {
          if (event.pointerType === "mouse") {
            return;
          }

          startPoint = canvasPoint(event);
          const lngLat = map.unproject([startPoint.x, startPoint.y]);
          startLngLat = { lat: lngLat.lat, lng: lngLat.lng };
          timeoutId = window.setTimeout(() => {
            if (!(startPoint && startLngLat)) {
              return;
            }

            event.preventDefault();
            openMapActionMenu(startPoint, startLngLat, true);
            clearLongPress();
          }, 650);
        }

        function updateLongPress(event: PointerEvent) {
          if (!(startPoint && timeoutId !== null)) {
            return;
          }

          const point = canvasPoint(event);
          const moved = Math.hypot(
            point.x - startPoint.x,
            point.y - startPoint.y,
          );

          if (moved > 12) {
            clearLongPress();
          }
        }

        canvas.addEventListener("pointerdown", beginLongPress, {
          passive: false,
        });
        canvas.addEventListener("pointermove", updateLongPress, {
          passive: true,
        });
        canvas.addEventListener("pointercancel", clearLongPress);
        canvas.addEventListener("pointerleave", clearLongPress);
        canvas.addEventListener("pointerup", clearLongPress);
        cleanupFns.push(() => {
          clearLongPress();
          canvas.removeEventListener("pointerdown", beginLongPress);
          canvas.removeEventListener("pointermove", updateLongPress);
          canvas.removeEventListener("pointercancel", clearLongPress);
          canvas.removeEventListener("pointerleave", clearLongPress);
          canvas.removeEventListener("pointerup", clearLongPress);
        });
      }

      async function showBuildingPopup(
        buildingFeature: MapGeoJSONFeature | null,
        poiFeature: MapGeoJSONFeature | null,
        coordinates: [number, number],
      ) {
        const buildingProperties =
          (buildingFeature?.properties as BuildingFeatureProperties) ?? null;
        const poiProperties =
          (poiFeature?.properties as BuildingFeatureProperties) ?? null;
        const safetyProfile = await fetch(
          `/api/building-safety?latitude=${encodeURIComponent(
            String(coordinates[1]),
          )}&longitude=${encodeURIComponent(String(coordinates[0]))}`,
          { cache: "no-store" },
        )
          .then((response) => (response.ok ? response.json() : null))
          .then(
            (payload: BuildingSafetyResponse | null) =>
              payload?.profile ?? null,
          )
          .catch(() => null);
        const report = createReportLocation(
          coordinates,
          buildBuildingReportAddress(
            buildingProperties,
            poiProperties,
            safetyProfile,
            coordinates,
            dashboardText,
          ),
        );
        selectReportLocation(
          report,
          dashboardText("dashboard.notice.buildingSelected"),
        );
        setMobileSheet(
          buildingSheet(
            report,
            buildingDisplayName(
              buildingProperties,
              poiProperties,
              safetyProfile,
            ),
            safetyProfile,
            dashboardText,
          ),
        );
        setMobileSheetDragOffset(0);

        popupRef.current?.remove();
        popupRef.current = new maplibre.Popup({
          closeButton: true,
          maxWidth: "340px",
          offset: 14,
        })
          .setLngLat(coordinates)
          .setHTML(
            buildBuildingPopupHtml(
              buildingProperties,
              poiProperties,
              coordinates,
              safetyProfile,
              dashboardText,
              dictionary.formatLocale,
            ),
          )
          .addTo(map);

        suppressPopupContextMenu(popupRef.current);
        popupRef.current
          .getElement()
          ?.querySelector<HTMLButtonElement>(BUILDING_REPORT_ACTION_SELECTOR)
          ?.addEventListener("click", (buttonEvent) => {
            buttonEvent.preventDefault();
            buttonEvent.stopPropagation();
            selectReportLocation(
              report,
              dashboardText("dashboard.notice.buildingConfirmed"),
            );
            showReportLocationPopup(report);
          });
      }

      function showUserLocationPopup(location: UserLocation) {
        popupRef.current?.remove();
        setMobileSheet(
          userLocationSheet(location, dashboardText, dictionary.formatLocale),
        );
        setMobileSheetDragOffset(0);
        popupRef.current = new maplibre.Popup({
          closeButton: true,
          maxWidth: "300px",
          offset: 14,
        })
          .setLngLat([location.longitude, location.latitude])
          .setHTML(
            buildUserLocationPopupHtml(
              location,
              dashboardText,
              dictionary.formatLocale,
            ),
          )
          .addTo(map);
        suppressPopupContextMenu(popupRef.current);
      }

      function showReportLocationPopup(location: ReportLocation) {
        popupRef.current?.remove();
        setMobileSheet(reportLocationSheet(location, dashboardText));
        setMobileSheetDragOffset(0);
        popupRef.current = new maplibre.Popup({
          closeButton: true,
          maxWidth: "320px",
          offset: 14,
        })
          .setLngLat([location.longitude, location.latitude])
          .setHTML(buildReportLocationPopupHtml(location, dashboardText))
          .addTo(map);
        suppressPopupContextMenu(popupRef.current);
      }

      function showBigData119Popup(point: BigData119MapPoint) {
        popupRef.current?.remove();
        setMobileSheet(bigData119Sheet(point, dashboardText));
        setMobileSheetDragOffset(0);
        popupRef.current = new maplibre.Popup({
          closeButton: true,
          maxWidth: "340px",
          offset: 12,
        })
          .setLngLat([point.longitude, point.latitude])
          .setHTML(buildBigData119PopupHtml(point, dashboardText))
          .addTo(map);
        suppressPopupContextMenu(popupRef.current);
      }

      map.on("load", () => {
        addDashboardLayers(map);
        setSourceData(
          map,
          BIGDATA119_SOURCE_ID,
          bigData119Data(
            bigData119PointsRef.current,
            visibleBigDataKinds,
            dashboardText,
          ),
        );
        setSourceData(
          map,
          USER_LOCATION_SOURCE_ID,
          userLocationData(userLocationRef.current, dashboardText),
        );
        setSourceData(
          map,
          REPORT_LOCATION_SOURCE_ID,
          reportLocationData(reportLocationRef.current, dashboardText),
        );
        syncThreeDimensionalView(
          map,
          isThreeDimensionalRef.current,
          effectiveMapSettings,
          false,
        );
        setIsMapReady(true);
      });
      map.on("click", INCIDENT_LAYER_ID, (event: MapLayerMouseEvent) => {
        const id = featureId(event.features?.[0]);
        const incident = incidentsRef.current.find((item) => item.id === id);

        if (incident) {
          void loadRecommendations(incident);
        }
      });
      map.on("click", RISK_AREA_LAYER_ID, (event: MapLayerMouseEvent) => {
        const id = featureId(event.features?.[0]);
        const area = riskAreasRef.current.find((item) => item.id === id);

        if (area) {
          popupRef.current?.remove();
          setMobileSheet(null);
          setMobileSheetDragOffset(0);
          reportLocationRef.current = null;
          setReportLocation(null);
          setActiveRiskArea(area);
          setView("risk");
        }
      });
      map.on("click", async (event) => {
        const features = map.queryRenderedFeatures(event.point, {
          layers: [
            REPORT_LOCATION_POINT_LAYER_ID,
            REPORT_LOCATION_LABEL_LAYER_ID,
            REPORT_LOCATION_HALO_LAYER_ID,
            INCIDENT_LAYER_ID,
            RISK_AREA_LAYER_ID,
            BIGDATA119_TARGET_LAYER_ID,
            BIGDATA119_WATER_LAYER_ID,
            BIGDATA119_LABEL_LAYER_ID,
            USER_LOCATION_POINT_LAYER_ID,
          ].filter((layerId) => map.getLayer(layerId)),
        });

        const feature = features[0];
        const riskFeature =
          features.find((current) => current.layer.id === RISK_AREA_LAYER_ID) ??
          null;

        if (feature) {
          if (feature.layer.id === USER_LOCATION_POINT_LAYER_ID) {
            const location = userLocationRef.current;

            if (location) {
              showUserLocationPopup(location);
            }

            return;
          }

          if (
            [
              REPORT_LOCATION_POINT_LAYER_ID,
              REPORT_LOCATION_LABEL_LAYER_ID,
              REPORT_LOCATION_HALO_LAYER_ID,
            ].includes(feature.layer.id)
          ) {
            const location = reportLocationRef.current;

            if (location) {
              showReportLocationPopup(location);
            }

            return;
          }

          if (
            [INCIDENT_LAYER_ID, RISK_AREA_LAYER_ID].includes(
              feature.layer.id,
            ) &&
            feature.layer.id === INCIDENT_LAYER_ID
          ) {
            return;
          }

          if (
            [
              BIGDATA119_TARGET_LAYER_ID,
              BIGDATA119_WATER_LAYER_ID,
              BIGDATA119_LABEL_LAYER_ID,
            ].includes(feature.layer.id)
          ) {
            const id = featureId(feature);
            const point = bigData119PointsRef.current.find(
              (item) => item.id === id,
            );

            if (point) {
              showBigData119Popup(point);
            }

            return;
          }
        }

        const buildingLayers = [
          POI_LABEL_LAYER_ID,
          BUILDING_3D_LAYER_ID,
          BUILDING_FOOTPRINT_LAYER_ID,
        ].filter((layerId) => map.getLayer(layerId));

        if (buildingLayers.length > 0) {
          const radius = Math.max(
            BUILDING_QUERY_BOX_PIXELS,
            POI_QUERY_BOX_PIXELS,
          );
          const buildingFeatures = map.queryRenderedFeatures(
            [
              [event.point.x - radius, event.point.y - radius],
              [event.point.x + radius, event.point.y + radius],
            ],
            { layers: buildingLayers },
          ) as MapGeoJSONFeature[];
          const poiFeature =
            buildingFeatures.find(
              (current) =>
                current.layer.id === POI_LABEL_LAYER_ID &&
                Boolean(
                  propertyText(
                    current.properties as BuildingFeatureProperties,
                    ["name:ko", "name", "name_en"],
                  ),
                ),
            ) ?? null;
          const buildingFeature =
            buildingFeatures.find((current) =>
              [BUILDING_3D_LAYER_ID, BUILDING_FOOTPRINT_LAYER_ID].includes(
                current.layer.id,
              ),
            ) ?? null;

          if (buildingFeature || poiFeature) {
            await showBuildingPopup(buildingFeature, poiFeature, [
              event.lngLat.lng,
              event.lngLat.lat,
            ]);
            return;
          }
        }

        if (riskFeature) {
          const id = featureId(riskFeature);
          const area = riskAreasRef.current.find((item) => item.id === id);

          if (area) {
            popupRef.current?.remove();
            setMobileSheet(null);
            setMobileSheetDragOffset(0);
            reportLocationRef.current = null;
            setReportLocation(null);
            setActiveRiskArea(area);
            setView("risk");
            return;
          }
        }

        const report = createReportLocation(
          [event.lngLat.lng, event.lngLat.lat],
          null,
          dashboardText("dashboard.popup.mapSelection"),
        );

        selectReportLocation(
          report,
          dashboardText("dashboard.notice.mapSelected"),
        );
        showReportLocationPopup(report);
      });
      map.on("contextmenu", (event) => {
        event.preventDefault();
        openMapActionMenu(
          { x: event.point.x, y: event.point.y },
          { lat: event.lngLat.lat, lng: event.lngLat.lng },
          false,
        );
      });
      installLongPressMenu();
      for (const layerId of [
        REPORT_LOCATION_POINT_LAYER_ID,
        REPORT_LOCATION_LABEL_LAYER_ID,
        REPORT_LOCATION_HALO_LAYER_ID,
        INCIDENT_LAYER_ID,
        RISK_AREA_LAYER_ID,
        BIGDATA119_TARGET_LAYER_ID,
        BIGDATA119_WATER_LAYER_ID,
        BIGDATA119_LABEL_LAYER_ID,
        USER_LOCATION_POINT_LAYER_ID,
        POI_LABEL_LAYER_ID,
        BUILDING_3D_LAYER_ID,
        BUILDING_FOOTPRINT_LAYER_ID,
      ]) {
        if (!map.getLayer(layerId)) {
          continue;
        }

        map.on("mouseenter", layerId, () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", layerId, () => {
          map.getCanvas().style.cursor = "";
        });
      }
    }

    void createMap();

    return () => {
      disposed = true;
      for (const cleanup of cleanupFns.splice(0)) {
        cleanup();
      }
      popupRef.current?.remove();
      popupRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
      maplibreRef.current = null;
      setIsMapReady(false);
    };
  }, [
    dashboardText,
    dictionary.formatLocale,
    effectiveMapSettings,
    applyReportLocation,
    loadRecommendations,
    visibleBigDataKinds,
    vworldApiKey,
  ]);

  useEffect(() => {
    const map = mapRef.current;

    if (!(map && isMapReady && snapshot)) {
      return;
    }

    incidentsRef.current = snapshot.incidents;
    riskAreasRef.current = snapshot.riskAreas;
    bigData119PointsRef.current = snapshot.bigData119Points;
    setSourceData(
      map,
      INCIDENTS_SOURCE_ID,
      incidentsData(snapshot.incidents, activeIncident?.id ?? null),
    );
    setSourceData(
      map,
      BIGDATA119_SOURCE_ID,
      bigData119Data(
        snapshot.bigData119Points,
        visibleBigDataKinds,
        dashboardText,
      ),
    );
    setSourceData(
      map,
      FIRE_STATIONS_SOURCE_ID,
      stationsData(snapshot.fireStations),
    );
    setSourceData(map, HOSPITALS_SOURCE_ID, hospitalsData(snapshot.hospitals));
    setSourceData(map, RISK_AREAS_SOURCE_ID, riskAreasData(snapshot.riskAreas));
    setSourceData(
      map,
      ROUTE_SOURCE_ID,
      routeData(activeIncident, dispatchRecommendation, dispatchRoute),
    );

    if (!didFitInitialSnapshotRef.current) {
      didFitInitialSnapshotRef.current = true;
      fitMapToSnapshot(map, snapshot);
    }
  }, [
    activeIncident,
    dashboardText,
    dispatchRecommendation,
    dispatchRoute,
    isMapReady,
    snapshot,
    visibleBigDataKinds,
  ]);

  const summary = useMemo(() => {
    const incidents = snapshot?.incidents ?? [];
    const highRiskAreas =
      snapshot?.riskAreas.filter((area) => area.riskLevel === "high").length ??
      0;
    const bigData119Points = snapshot?.bigData119Points ?? [];
    const bigData119OperationalRows =
      snapshot?.bigData119OperationalSummaries.reduce(
        (sum, source) => sum + source.rowCount,
        0,
      ) ?? 0;

    return {
      activeIncidents: incidents.filter(
        (incident) => incident.status !== "closed",
      ).length,
      bigData119OperationalRows,
      bigData119Points: bigData119Points.length,
      fireStations: snapshot?.fireStations.length ?? 0,
      highRiskAreas,
      hospitals: snapshot?.hospitals.length ?? 0,
    };
  }, [snapshot]);

  const bigData119Summaries = snapshot?.bigData119Summaries ?? [];
  const bigData119OperationalSummaries =
    snapshot?.bigData119OperationalSummaries ?? [];

  async function generateSimulationScenario() {
    const location =
      reportLocation ?? activeIncident ?? snapshot?.activeIncident;
    const riskArea = activeRiskArea ?? snapshot?.riskAreas[0] ?? null;
    const incident = activeIncident ?? snapshot?.activeIncident ?? null;

    setIsSimulationLoading(true);
    setNotice(dashboardText("dashboard.simulation.generating"));

    try {
      const response = await fetch("/api/disaster/simulation", {
        body: JSON.stringify({
          buildingContext: location
            ? `${location.address} (${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)})`
            : dashboardText("dashboard.simulation.noBuilding"),
          incidentContext: incident
            ? `${incident.title} / ${incident.type} / ${incident.riskLevel} / ${incident.description}`
            : dashboardText("dashboard.simulation.noIncident"),
          locationContext: location
            ? `${location.address} (${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)})`
            : dashboardText("dashboard.simulation.noLocation"),
          riskContext: riskArea
            ? `${riskArea.name} / ${riskArea.riskLevel} / ${riskArea.factors.join(", ")}`
            : dashboardText("dashboard.simulation.noRisk"),
          weatherContext: dashboardText("dashboard.simulation.weatherFallback"),
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json()) as SimulationResponse;

      if (!(response.ok && payload.scenario)) {
        throw new Error(
          payload.errorCode
            ? dashboardText(`dashboard.simulation.error.${payload.errorCode}`)
            : dashboardText("dashboard.simulation.error.default"),
        );
      }

      setSimulationScenario(payload.scenario);
      setNotice(dashboardText("dashboard.simulation.ready"));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setIsSimulationLoading(false);
    }
  }

  async function createIncident(event: React.FormEvent) {
    event.preventDefault();
    setNotice(dashboardText("dashboard.notice.creatingIncident"));

    try {
      const response = await fetch("/api/disaster/incidents", {
        body: JSON.stringify({
          ...form,
          latitude: Number(form.latitude),
          longitude: Number(form.longitude),
          occurredAt: localDateTimeToIso(form.occurredAt),
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json()) as {
        error?: string;
        incident?: Incident;
      };

      if (!(response.ok && payload.incident)) {
        throw new Error(
          payload.error ?? dashboardText("dashboard.notice.createFailed"),
        );
      }

      popupRef.current?.remove();
      reportLocationRef.current = null;
      setReportLocation(null);
      await loadSnapshot();
      await loadRecommendations(payload.incident);
      setNotice(dashboardText("dashboard.notice.created"));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    }
  }

  async function updateIncidentStatus(status: IncidentStatus) {
    if (!activeIncident) {
      return;
    }

    setIsStatusUpdating(true);
    setNotice(dashboardText("dashboard.notice.updatingStatus"));

    try {
      const response = await fetch(
        `/api/disaster/incidents/${encodeURIComponent(activeIncident.id)}`,
        {
          body: JSON.stringify({ status }),
          headers: { "Content-Type": "application/json" },
          method: "PATCH",
        },
      );
      const payload = (await response.json()) as {
        error?: string;
        incident?: Incident;
      };

      if (!(response.ok && payload.incident)) {
        throw new Error(
          payload.error ?? dashboardText("dashboard.notice.statusFailed"),
        );
      }

      setActiveIncident(payload.incident);
      await loadSnapshot();
      await loadRecommendations(payload.incident);
      setNotice(dashboardText("dashboard.notice.statusUpdated"));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setIsStatusUpdating(false);
    }
  }

  function startIncidentEdit(incident: Incident) {
    setEditIncidentId(incident.id);
    setEditIncidentForm(incidentFormValue(incident));
    setView("incidents");
  }

  function cancelIncidentEdit() {
    setEditIncidentId(null);
    setEditIncidentForm(null);
  }

  async function saveIncidentEdit(event: React.FormEvent) {
    event.preventDefault();

    if (!(editIncidentId && editIncidentForm)) {
      return;
    }

    setIsIncidentSaving(true);
    setNotice(dashboardText("dashboard.notice.savingIncident"));

    try {
      const response = await fetch(
        `/api/disaster/incidents/${encodeURIComponent(editIncidentId)}`,
        {
          body: JSON.stringify({
            ...editIncidentForm,
            latitude: Number(editIncidentForm.latitude),
            longitude: Number(editIncidentForm.longitude),
            occurredAt: localDateTimeToIso(editIncidentForm.occurredAt),
          }),
          headers: { "Content-Type": "application/json" },
          method: "PATCH",
        },
      );
      const payload = (await response.json()) as IncidentDetailResponse;

      if (!(response.ok && payload.incident)) {
        throw new Error(
          payload.error ?? dashboardText("dashboard.notice.saveFailed"),
        );
      }

      setEditIncidentId(null);
      setEditIncidentForm(null);
      setActiveIncident(payload.incident);
      setActiveIncidentEvents(payload.events ?? []);
      await loadSnapshot();
      await loadRecommendations(payload.incident);
      setNotice(dashboardText("dashboard.notice.saved"));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setIsIncidentSaving(false);
    }
  }

  async function deleteActiveIncident() {
    if (!activeIncident) {
      return;
    }

    setIsDeleteConfirmationOpen(false);
    setIsIncidentDeleting(true);
    setNotice(dashboardText("dashboard.notice.deletingIncident"));

    try {
      const response = await fetch(
        `/api/disaster/incidents/${encodeURIComponent(activeIncident.id)}`,
        { method: "DELETE" },
      );
      const payload = (await response.json().catch(() => null)) as {
        deleted?: boolean;
        error?: string;
      } | null;

      if (!(response.ok && payload?.deleted)) {
        throw new Error(
          payload?.error ?? dashboardText("dashboard.notice.deleteFailed"),
        );
      }

      popupRef.current?.remove();
      setActiveIncident(null);
      setActiveIncidentEvents([]);
      setDispatchRecommendation(null);
      setHospitalRecommendations([]);
      cancelIncidentEdit();
      await loadSnapshot();
      setNotice(dashboardText("dashboard.notice.deleted"));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setIsIncidentDeleting(false);
    }
  }

  function closeMobileSheet() {
    setMobileSheet(null);
    setMobileSheetDragOffset(0);
    mobileSheetDragStartRef.current = null;
  }

  async function copyMapContextCoordinates() {
    if (!mapContextMenu) {
      return;
    }

    const label = coordinateText(
      mapContextMenu.latitude,
      mapContextMenu.longitude,
    );

    try {
      await navigator.clipboard.writeText(label);
      setMapContextMenu((current) =>
        current
          ? {
              ...current,
              status: dashboardText("dashboard.context.copied"),
            }
          : current,
      );
    } catch {
      setMapContextMenu((current) =>
        current
          ? {
              ...current,
              status: dashboardText("dashboard.context.copyFailed"),
            }
          : current,
      );
    }
  }

  async function lookupMapContextAddress() {
    if (!mapContextMenu) {
      return;
    }

    setMapContextMenu((current) =>
      current ? { ...current, isAddressLoading: true, status: null } : current,
    );

    try {
      const response = await fetch(
        `/api/geocoding/reverse?latitude=${encodeURIComponent(
          String(mapContextMenu.latitude),
        )}&longitude=${encodeURIComponent(String(mapContextMenu.longitude))}`,
        { cache: "no-store" },
      );
      const payload = (await response.json()) as ReverseGeocodingResponse;
      const address = payload.addresses?.[0] ?? null;

      setMapContextMenu((current) =>
        current
          ? {
              ...current,
              address,
              isAddressLoading: false,
              status: address
                ? dashboardText("dashboard.context.addressFound")
                : dashboardText("dashboard.context.addressUnavailable"),
            }
          : current,
      );
    } catch {
      setMapContextMenu((current) =>
        current
          ? {
              ...current,
              isAddressLoading: false,
              status: dashboardText("dashboard.context.addressUnavailable"),
            }
          : current,
      );
    }
  }

  async function loadMapContextRecommendations() {
    if (!mapContextMenu) {
      return;
    }

    setMapContextMenu((current) =>
      current
        ? { ...current, isRecommendationLoading: true, status: null }
        : current,
    );

    try {
      const response = await fetch("/api/emergency/recommendations", {
        body: JSON.stringify({
          incidentType: "fire",
          latitude: mapContextMenu.latitude,
          longitude: mapContextMenu.longitude,
          scenario: "general",
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload =
        (await response.json()) as EmergencyRecommendationResponse;
      const stationName = payload.dispatchStation?.name ?? null;
      const hospitalName = payload.hospitals?.[0]?.hospital.name ?? null;

      setMapContextMenu((current) =>
        current
          ? {
              ...current,
              isRecommendationLoading: false,
              recommendation: { hospitalName, stationName },
              status:
                stationName || hospitalName
                  ? dashboardText("dashboard.context.nearestSummary", {
                      hospital:
                        hospitalName ?? dashboardText("dashboard.context.none"),
                      station:
                        stationName ?? dashboardText("dashboard.context.none"),
                    })
                  : dashboardText("dashboard.context.nearbyUnavailable"),
            }
          : current,
      );
    } catch {
      setMapContextMenu((current) =>
        current
          ? {
              ...current,
              isRecommendationLoading: false,
              status: dashboardText("dashboard.context.nearbyUnavailable"),
            }
          : current,
      );
    }
  }

  function useMapContextForReport() {
    if (!mapContextMenu) {
      return;
    }

    const coordinates = coordinateText(
      mapContextMenu.latitude,
      mapContextMenu.longitude,
    );
    const report = createReportLocation(
      [mapContextMenu.longitude, mapContextMenu.latitude],
      mapContextMenu.address ??
        dashboardText("dashboard.context.reportAddress", { coordinates }),
    );

    applyReportLocation(report, dashboardText("dashboard.notice.mapSelected"));
    setMobileSheet(reportLocationSheet(report, dashboardText));
    setMobileSheetDragOffset(0);
    closeMapContextMenu();
  }

  function beginMobileSheetDrag(event: React.PointerEvent<HTMLElement>) {
    mobileSheetDragStartRef.current = event.clientY;
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function updateMobileSheetDrag(event: React.PointerEvent<HTMLElement>) {
    if (mobileSheetDragStartRef.current === null) {
      return;
    }

    setMobileSheetDragOffset(
      Math.max(0, event.clientY - mobileSheetDragStartRef.current),
    );
  }

  function endMobileSheetDrag(event: React.PointerEvent<HTMLElement>) {
    if (mobileSheetDragStartRef.current === null) {
      return;
    }

    const offset = Math.max(0, event.clientY - mobileSheetDragStartRef.current);
    mobileSheetDragStartRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);

    if (offset > 96) {
      closeMobileSheet();
      return;
    }

    setMobileSheetDragOffset(0);
  }

  const riskAreas = snapshot?.riskAreas ?? [];
  const incidents = snapshot?.incidents ?? [];
  const recommendations = snapshot?.resourceRecommendations ?? [];
  const tickerItems = useMemo(
    () =>
      incidents.filter((incident) => incident.status !== "closed").slice(0, 6),
    [incidents],
  );
  const filteredIncidents = useMemo(() => {
    const query = incidentSearch.trim().toLowerCase();

    return incidents.filter((incident) => {
      const matchesType =
        incidentTypeFilter === "all" || incident.type === incidentTypeFilter;
      const matchesStatus =
        incidentStatusFilter === "all" ||
        incident.status === incidentStatusFilter;
      const matchesQuery =
        !query ||
        [
          incident.title,
          incident.address,
          incident.description,
          INCIDENT_TYPE_LABEL[incident.type],
          RISK_LEVEL_LABEL[incident.riskLevel],
          INCIDENT_STATUS_LABEL[incident.status],
        ]
          .join(" ")
          .toLowerCase()
          .includes(query);

      return matchesType && matchesStatus && matchesQuery;
    });
  }, [incidentSearch, incidentStatusFilter, incidentTypeFilter, incidents]);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <a className={styles.brand} href="/">
          <span>
            <ShieldAlert aria-hidden="true" size={20} strokeWidth={2.6} />
          </span>
          {dashboardText("Platelets 통합 재난 지도")}
        </a>
        <nav
          className={styles.nav}
          aria-label={dashboardText("재난 대응 화면")}
        >
          {[
            ["dashboard", "대시보드"],
            ["incidents", "사고"],
            ["create", "등록"],
            ["risk", "위험도"],
            ["resources", "자원배치"],
          ].map(([key, label]) => (
            <button
              className={view === key ? styles.navActive : styles.navButton}
              key={key}
              onClick={() => setView(key as DashboardView)}
              type="button"
            >
              {dashboardText(label)}
            </button>
          ))}
        </nav>
        <button
          className={styles.refreshButton}
          disabled={isLoading}
          onClick={loadSnapshot}
          type="button"
        >
          <RefreshCw aria-hidden="true" size={16} />
          {dashboardText("새로고침")}
        </button>
      </header>

      <main className={styles.shell}>
        <section className={styles.mapPane}>
          <div className={styles.map} ref={mapContainerRef} />
          <div
            className={styles.mapControls}
            aria-label={dashboardText("지도 도구")}
            role="toolbar"
          >
            <button
              aria-pressed={isThreeDimensional}
              className={
                isThreeDimensional ? styles.mapToggleActive : styles.mapToggle
              }
              onClick={() => setIsThreeDimensional((current) => !current)}
              title={dashboardText("3D 건물 보기")}
              type="button"
            >
              {dashboardText("3D")}
            </button>
            <button
              className={styles.mapToggle}
              data-testid="locate-user-button"
              disabled={isLocating}
              onClick={locateUser}
              title={dashboardText("내 위치로 이동")}
              type="button"
            >
              <LocateFixed aria-hidden="true" size={15} />
              {dashboardText(isLocating ? "확인 중" : "내 위치")}
            </button>
            <button
              aria-pressed={visibleBigDataKinds["fire-safety-target"]}
              className={
                visibleBigDataKinds["fire-safety-target"]
                  ? styles.mapToggleActive
                  : styles.mapToggle
              }
              onClick={() =>
                setVisibleBigDataKinds((current) => ({
                  ...current,
                  "fire-safety-target": !current["fire-safety-target"],
                }))
              }
              title={dashboardText("소방안전 빅데이터 특정소방대상물 표시")}
              type="button"
            >
              {dashboardText("대상물")}
            </button>
            <button
              aria-pressed={visibleBigDataKinds["fire-water-source"]}
              className={
                visibleBigDataKinds["fire-water-source"]
                  ? styles.mapToggleActive
                  : styles.mapToggle
              }
              onClick={() =>
                setVisibleBigDataKinds((current) => ({
                  ...current,
                  "fire-water-source": !current["fire-water-source"],
                }))
              }
              title={dashboardText("소방안전 빅데이터 소방용수 표시")}
              type="button"
            >
              {dashboardText("소방용수")}
            </button>
          </div>
          <div
            aria-label={dashboardText("dashboard.ticker.aria")}
            className={styles.liveTicker}
            role="status"
          >
            <span>{dashboardText("dashboard.ticker.live")}</span>
            <div>
              <div className={styles.liveTickerTrack}>
                {(tickerItems.length > 0 ? tickerItems : [null]).map(
                  (incident, index) => (
                    <strong
                      key={incident?.id ?? `empty-${index}`}
                      className={incident ? undefined : styles.tickerMuted}
                    >
                      {incident
                        ? dashboardText("dashboard.ticker.item", {
                            address: incident.address,
                            risk: dashboardText(
                              RISK_LEVEL_LABEL[incident.riskLevel],
                            ),
                            status: dashboardText(
                              INCIDENT_STATUS_LABEL[incident.status],
                            ),
                            title: incident.title,
                            type: dashboardText(
                              INCIDENT_TYPE_LABEL[incident.type],
                            ),
                          })
                        : dashboardText("dashboard.ticker.empty")}
                    </strong>
                  ),
                )}
                {tickerItems.map((incident) => (
                  <strong aria-hidden="true" key={`${incident.id}-repeat`}>
                    {dashboardText("dashboard.ticker.item", {
                      address: incident.address,
                      risk: dashboardText(RISK_LEVEL_LABEL[incident.riskLevel]),
                      status: dashboardText(
                        INCIDENT_STATUS_LABEL[incident.status],
                      ),
                      title: incident.title,
                      type: dashboardText(INCIDENT_TYPE_LABEL[incident.type]),
                    })}
                  </strong>
                ))}
              </div>
            </div>
          </div>
          <MapLegend
            items={[
              {
                id: "incident",
                label: dashboardText("사고"),
                markerClassName: styles.legendIncident,
              },
              {
                id: "station",
                label: dashboardText("소방서"),
                markerClassName: styles.legendStation,
              },
              {
                id: "hospital",
                label: dashboardText("병원"),
                markerClassName: styles.legendHospital,
              },
              {
                id: "risk",
                label: dashboardText("위험도"),
                markerClassName: styles.legendRisk,
              },
              {
                id: "fire-safety-target",
                label: dashboardText("특정소방대상물"),
                markerClassName: styles.legendBigDataTarget,
              },
              {
                id: "fire-water-source",
                label: dashboardText("소방용수"),
                markerClassName: styles.legendBigDataWater,
              },
            ]}
          />
          {mapContextMenu ? (
            <aside
              aria-label={dashboardText(
                mapContextMenu.isMobile
                  ? "dashboard.context.mobileAria"
                  : "dashboard.context.desktopAria",
              )}
              className={
                mapContextMenu.isMobile
                  ? styles.mapContextSheet
                  : styles.mapContextMenu
              }
              data-testid="map-context-menu"
              style={
                mapContextMenu.isMobile
                  ? undefined
                  : {
                      left: mapContextMenu.screenX,
                      top: mapContextMenu.screenY,
                    }
              }
            >
              <div className={styles.mapContextHeader}>
                <div>
                  <span>{dashboardText("dashboard.context.subtitle")}</span>
                  <strong>{dashboardText("dashboard.context.title")}</strong>
                </div>
                <button
                  aria-label={dashboardText("dashboard.context.close")}
                  onClick={closeMapContextMenu}
                  type="button"
                >
                  <X aria-hidden="true" size={16} />
                </button>
              </div>
              <dl className={styles.mapContextDetails}>
                <div>
                  <dt>{dashboardText("dashboard.sheet.coordinates")}</dt>
                  <dd>
                    {coordinateText(
                      mapContextMenu.latitude,
                      mapContextMenu.longitude,
                    )}
                  </dd>
                </div>
                <div>
                  <dt>{dashboardText("dashboard.sheet.address")}</dt>
                  <dd>
                    {mapContextMenu.address ??
                      dashboardText("dashboard.context.addressPending")}
                  </dd>
                </div>
                {mapContextMenu.recommendation ? (
                  <>
                    <div>
                      <dt>{dashboardText("dashboard.context.station")}</dt>
                      <dd>
                        {mapContextMenu.recommendation.stationName ??
                          dashboardText("dashboard.context.none")}
                      </dd>
                    </div>
                    <div>
                      <dt>{dashboardText("dashboard.context.hospital")}</dt>
                      <dd>
                        {mapContextMenu.recommendation.hospitalName ??
                          dashboardText("dashboard.context.none")}
                      </dd>
                    </div>
                  </>
                ) : null}
              </dl>
              {mapContextMenu.status ? (
                <p className={styles.mapContextStatus}>
                  {mapContextMenu.status}
                </p>
              ) : null}
              <div className={styles.mapContextActions}>
                <button onClick={copyMapContextCoordinates} type="button">
                  <Copy aria-hidden="true" size={15} />
                  {dashboardText("dashboard.context.copyCoordinates")}
                </button>
                <button
                  disabled={mapContextMenu.isAddressLoading}
                  onClick={lookupMapContextAddress}
                  type="button"
                >
                  <Search aria-hidden="true" size={15} />
                  {dashboardText(
                    mapContextMenu.isAddressLoading
                      ? "dashboard.context.addressLoading"
                      : "dashboard.context.lookupAddress",
                  )}
                </button>
                <button
                  disabled={mapContextMenu.isRecommendationLoading}
                  onClick={loadMapContextRecommendations}
                  type="button"
                >
                  <Truck aria-hidden="true" size={15} />
                  {dashboardText(
                    mapContextMenu.isRecommendationLoading
                      ? "dashboard.context.nearbyLoading"
                      : "dashboard.context.nearby",
                  )}
                </button>
                <button onClick={useMapContextForReport} type="button">
                  <MapPin aria-hidden="true" size={15} />
                  {dashboardText("dashboard.context.reportHere")}
                </button>
              </div>
            </aside>
          ) : null}
          {mobileSheet ? (
            <aside
              aria-label={dashboardText("dashboard.sheet.aria")}
              className={styles.mobileBottomSheet}
              data-testid="mobile-bottom-sheet"
              onPointerCancel={endMobileSheetDrag}
              onPointerMove={updateMobileSheetDrag}
              onPointerUp={endMobileSheetDrag}
              style={{
                transform: `translate3d(0, ${mobileSheetDragOffset}px, 0)`,
              }}
            >
              <button
                aria-label={dashboardText("dashboard.sheet.dragHandle")}
                className={styles.mobileSheetHandle}
                onPointerDown={beginMobileSheetDrag}
                type="button"
              >
                <span aria-hidden="true" />
              </button>
              <div className={styles.mobileSheetHeader}>
                <div>
                  <span>{mobileSheet.subtitle}</span>
                  <strong>{mobileSheet.title}</strong>
                </div>
                <button
                  data-testid="mobile-bottom-sheet-close"
                  onClick={closeMobileSheet}
                  type="button"
                >
                  {dashboardText("dashboard.sheet.close")}
                </button>
              </div>
              <dl className={styles.mobileSheetDetails}>
                {mobileSheet.rows.map((row) => (
                  <div key={`${row.label}-${row.value}`}>
                    <dt>{row.label}</dt>
                    <dd>{row.value}</dd>
                  </div>
                ))}
              </dl>
              {mobileSheet.links && mobileSheet.links.length > 0 ? (
                <div className={styles.mobileSheetActions}>
                  {mobileSheet.links.map((link) => (
                    <a
                      href={link.href}
                      key={link.href}
                      rel="noreferrer"
                      target="_blank"
                    >
                      {link.label}
                    </a>
                  ))}
                </div>
              ) : null}
            </aside>
          ) : null}
        </section>

        <aside className={styles.panel}>
          <SummaryMetrics
            ariaLabel={dashboardText("운영 지표")}
            items={[
              {
                icon: <AlertTriangle aria-hidden="true" size={18} />,
                id: "active-incidents",
                label: dashboardText("진행 사고"),
                value: summary.activeIncidents,
              },
              {
                icon: <Flame aria-hidden="true" size={18} />,
                id: "fire-stations",
                label: dashboardText("소방 거점"),
                value: summary.fireStations,
              },
              {
                icon: <Hospital aria-hidden="true" size={18} />,
                id: "hospitals",
                label: dashboardText("응급 병원"),
                value: summary.hospitals,
              },
              {
                icon: <Layers aria-hidden="true" size={18} />,
                id: "high-risk-areas",
                label: dashboardText("고위험 지역"),
                value: summary.highRiskAreas,
              },
              {
                icon: <Database aria-hidden="true" size={18} />,
                id: "big-data-points",
                label: dashboardText("빅데이터 포인트"),
                value: summary.bigData119Points,
              },
              {
                icon: <Route aria-hidden="true" size={18} />,
                id: "operational-rows",
                label: dashboardText("신고·출동 행"),
                value: summary.bigData119OperationalRows,
              },
            ]}
          />

          {notice ? <output className={styles.notice}>{notice}</output> : null}

          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.kicker}>
                {dashboardText("dashboard.simulation.kicker")}
              </span>
              <strong>{dashboardText("dashboard.simulation.title")}</strong>
            </div>
            <p className={styles.description}>
              {dashboardText("dashboard.simulation.description")}
            </p>
            <div className={styles.statusActions}>
              <button
                className={styles.primaryButton}
                disabled={isSimulationLoading}
                onClick={generateSimulationScenario}
                type="button"
              >
                <ShieldAlert aria-hidden="true" size={16} />
                {isSimulationLoading
                  ? dashboardText("dashboard.simulation.loading")
                  : dashboardText("dashboard.simulation.action")}
              </button>
            </div>
            {simulationScenario ? (
              <article className={styles.analysisCard}>
                <strong>
                  {dashboardText("dashboard.simulation.briefing")}
                </strong>
                <small>
                  {dashboardText("dashboard.simulation.meta", {
                    generatedAt: formatDateTime(
                      simulationScenario.generatedAt,
                      dictionary.formatLocale,
                    ),
                    model: simulationScenario.model,
                  })}
                </small>
                <p className={styles.itemReasons}>
                  {simulationScenario.scenario}
                </p>
              </article>
            ) : null}
          </section>

          {bigData119Summaries.length > 0 ? (
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <span className={styles.kicker}>
                  {dashboardText("소방안전 빅데이터 활용")}
                </span>
                <strong>
                  {dashboardText("dashboard.bigData.mapSummary", {
                    count: bigData119Summaries.length,
                  })}
                </strong>
              </div>
              <div className={styles.dataSourceGrid}>
                {bigData119Summaries.map((source) => (
                  <DataSourceItemLink
                    key={source.sourceId}
                    unsafeHref={source.sourceUrl}
                  >
                    {source.kind === "fire-water-source" ? (
                      <Droplets aria-hidden="true" size={16} />
                    ) : (
                      <Building2 aria-hidden="true" size={16} />
                    )}
                    <div>
                      <strong>{source.sourceLabel}</strong>
                      <span>
                        {dashboardText("dashboard.bigData.mapSourceMeta", {
                          count: source.mappedCount.toLocaleString(
                            dictionary.formatLocale,
                          ),
                          extra:
                            source.regions.length > 2
                              ? dashboardText(" 외")
                              : "",
                          regions:
                            source.regions.slice(0, 2).join(", ") ||
                            dashboardText("지역 정보 없음"),
                          status: dashboardText(
                            source.isSample ? "샘플" : "승인 CSV",
                          ),
                        })}
                      </span>
                    </div>
                  </DataSourceItemLink>
                ))}
              </div>
            </section>
          ) : null}

          {bigData119OperationalSummaries.length > 0 ? (
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <span className={styles.kicker}>
                  {dashboardText("119 신고·출동 데이터")}
                </span>
                <strong>
                  {dashboardText("dashboard.bigData.operationsSummary", {
                    count: bigData119OperationalSummaries.length,
                  })}
                </strong>
              </div>
              <div className={styles.dataSourceGrid}>
                {bigData119OperationalSummaries.map((source) => (
                  <DataSourceItemLink
                    key={source.sourceId}
                    unsafeHref={source.sourceUrl}
                  >
                    <OperationalSourceIcon kind={source.kind} />
                    <div>
                      <strong>{source.sourceLabel}</strong>
                      <span>
                        {dashboardText("dashboard.bigData.operationMeta", {
                          count: source.rowCount.toLocaleString(
                            dictionary.formatLocale,
                          ),
                          extra:
                            source.regions.length > 2
                              ? dashboardText(" 외")
                              : "",
                          kind: dashboardText(
                            BIGDATA119_OPERATIONAL_KIND_LABEL[source.kind],
                          ),
                          regions:
                            source.regions.slice(0, 2).join(", ") ||
                            dashboardText("지역 정보 없음"),
                          status: dashboardText(
                            source.isSample ? "샘플" : "승인 CSV",
                          ),
                        })}
                      </span>
                      <span>
                        {dashboardText("dashboard.bigData.operationHints", {
                          average: source.averageDispatchDistanceMeters
                            ? dashboardText("dashboard.bigData.averageSuffix", {
                                distance: distanceText(
                                  source.averageDispatchDistanceMeters,
                                  dictionary.formatLocale,
                                ),
                              })
                            : "",
                          time:
                            source.timeHints[0] ??
                            dashboardText("시간 정보 없음"),
                          types:
                            source.incidentTypeHints.slice(0, 2).join(", ") ||
                            dashboardText("유형 정보 없음"),
                        })}
                      </span>
                      {source.areaLoads.length > 0 ? (
                        <span>
                          {dashboardText("dashboard.bigData.areaLoads", {
                            areas: source.areaLoads
                              .slice(0, 2)
                              .map((areaLoad) =>
                                dashboardText("dashboard.bigData.areaLoad", {
                                  area: areaLoad.areaName,
                                  count: areaLoad.rowCount.toLocaleString(
                                    dictionary.formatLocale,
                                  ),
                                }),
                              )
                              .join(", "),
                            extra:
                              source.areaLoads.length > 2
                                ? dashboardText(" 외")
                                : "",
                          })}
                        </span>
                      ) : null}
                    </div>
                  </DataSourceItemLink>
                ))}
              </div>
            </section>
          ) : null}

          {(view === "dashboard" || view === "incidents") && activeIncident ? (
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <span className={styles.kicker}>
                  {dashboardText("선택 사고")}
                </span>
                <strong>{activeIncident.title}</strong>
              </div>
              <dl className={styles.detailGrid}>
                <div>
                  <dt>{dashboardText("유형")}</dt>
                  <dd>
                    {dashboardText(INCIDENT_TYPE_LABEL[activeIncident.type])}
                  </dd>
                </div>
                <div>
                  <dt>{dashboardText("위험도")}</dt>
                  <dd>
                    {dashboardText(RISK_LEVEL_LABEL[activeIncident.riskLevel])}
                  </dd>
                </div>
                <div>
                  <dt>{dashboardText("상태")}</dt>
                  <dd>
                    {dashboardText(
                      INCIDENT_STATUS_LABEL[activeIncident.status],
                    )}
                  </dd>
                </div>
                <div>
                  <dt>{dashboardText("발생시각")}</dt>
                  <dd>
                    {formatDateTime(
                      activeIncident.occurredAt,
                      dictionary.formatLocale,
                    )}
                  </dd>
                </div>
                <div>
                  <dt>{dashboardText("위치")}</dt>
                  <dd>{activeIncident.address}</dd>
                </div>
              </dl>
              <p className={styles.description}>{activeIncident.description}</p>
              <div className={styles.statusActions}>
                {activeIncident.status === "dispatched" ? null : (
                  <button
                    className={styles.primaryButton}
                    disabled={isStatusUpdating || isIncidentDeleting}
                    onClick={() => updateIncidentStatus("dispatched")}
                    type="button"
                  >
                    {dashboardText("출동 처리")}
                  </button>
                )}
                {activeIncident.status === "closed" ? null : (
                  <button
                    className={styles.dangerButton}
                    disabled={isStatusUpdating || isIncidentDeleting}
                    onClick={() => updateIncidentStatus("closed")}
                    type="button"
                  >
                    {dashboardText("종료")}
                  </button>
                )}
                {activeIncident.status === "reported" ? null : (
                  <button
                    className={styles.secondaryButton}
                    disabled={isStatusUpdating || isIncidentDeleting}
                    onClick={() => updateIncidentStatus("reported")}
                    type="button"
                  >
                    {dashboardText("접수로 되돌리기")}
                  </button>
                )}
                <button
                  className={styles.secondaryButton}
                  disabled={isIncidentSaving || isIncidentDeleting}
                  onClick={() => startIncidentEdit(activeIncident)}
                  type="button"
                >
                  {dashboardText("수정")}
                </button>
                {isDeleteConfirmationOpen ? (
                  <>
                    <button
                      className={styles.secondaryButton}
                      disabled={isIncidentDeleting}
                      onClick={() => setIsDeleteConfirmationOpen(false)}
                      type="button"
                    >
                      {dashboardText("Cancel")}
                    </button>
                    <button
                      className={styles.dangerButton}
                      disabled={isIncidentDeleting}
                      onClick={deleteActiveIncident}
                      type="button"
                    >
                      {dashboardText("Delete")}
                    </button>
                  </>
                ) : (
                  <button
                    className={styles.dangerButton}
                    disabled={isIncidentDeleting}
                    onClick={() => setIsDeleteConfirmationOpen(true)}
                    type="button"
                  >
                    {dashboardText("Delete")}
                  </button>
                )}
              </div>
              {editIncidentId === activeIncident.id && editIncidentForm ? (
                <form className={styles.form} onSubmit={saveIncidentEdit}>
                  <label>
                    {dashboardText("사고명")}
                    <input
                      onChange={(event) =>
                        setEditIncidentForm((current) =>
                          current
                            ? { ...current, title: event.target.value }
                            : current,
                        )
                      }
                      value={editIncidentForm.title}
                    />
                  </label>
                  <div className={styles.formGrid}>
                    <label>
                      {dashboardText("유형")}
                      <select
                        onChange={(event) =>
                          setEditIncidentForm((current) =>
                            current
                              ? {
                                  ...current,
                                  type: event.target.value as IncidentType,
                                }
                              : current,
                          )
                        }
                        value={editIncidentForm.type}
                      >
                        <option value="fire">{dashboardText("화재")}</option>
                        <option value="medical">{dashboardText("구급")}</option>
                        <option value="rescue">{dashboardText("구조")}</option>
                        <option value="traffic">
                          {dashboardText("교통사고")}
                        </option>
                      </select>
                    </label>
                    <label>
                      {dashboardText("위험도")}
                      <select
                        onChange={(event) =>
                          setEditIncidentForm((current) =>
                            current
                              ? {
                                  ...current,
                                  riskLevel: event.target.value as RiskLevel,
                                }
                              : current,
                          )
                        }
                        value={editIncidentForm.riskLevel}
                      >
                        <option value="low">{dashboardText("낮음")}</option>
                        <option value="medium">{dashboardText("보통")}</option>
                        <option value="high">{dashboardText("높음")}</option>
                      </select>
                    </label>
                  </div>
                  <div className={styles.formGrid}>
                    <label>
                      {dashboardText("위도")}
                      <input
                        inputMode="decimal"
                        onChange={(event) =>
                          setEditIncidentForm((current) =>
                            current
                              ? { ...current, latitude: event.target.value }
                              : current,
                          )
                        }
                        value={editIncidentForm.latitude}
                      />
                    </label>
                    <label>
                      {dashboardText("경도")}
                      <input
                        inputMode="decimal"
                        onChange={(event) =>
                          setEditIncidentForm((current) =>
                            current
                              ? { ...current, longitude: event.target.value }
                              : current,
                          )
                        }
                        value={editIncidentForm.longitude}
                      />
                    </label>
                  </div>
                  <label>
                    {dashboardText("발생시각")}
                    <input
                      onChange={(event) =>
                        setEditIncidentForm((current) =>
                          current
                            ? { ...current, occurredAt: event.target.value }
                            : current,
                        )
                      }
                      type="datetime-local"
                      value={editIncidentForm.occurredAt}
                    />
                  </label>
                  <label>
                    {dashboardText("주소")}
                    <input
                      onChange={(event) =>
                        setEditIncidentForm((current) =>
                          current
                            ? { ...current, address: event.target.value }
                            : current,
                        )
                      }
                      value={editIncidentForm.address}
                    />
                  </label>
                  <label>
                    {dashboardText("설명")}
                    <textarea
                      onChange={(event) =>
                        setEditIncidentForm((current) =>
                          current
                            ? { ...current, description: event.target.value }
                            : current,
                        )
                      }
                      rows={3}
                      value={editIncidentForm.description}
                    />
                  </label>
                  <div className={styles.statusActions}>
                    <button
                      className={styles.primaryButton}
                      disabled={isIncidentSaving}
                      type="submit"
                    >
                      {dashboardText("저장")}
                    </button>
                    <button
                      className={styles.secondaryButton}
                      disabled={isIncidentSaving}
                      onClick={cancelIncidentEdit}
                      type="button"
                    >
                      {dashboardText("취소")}
                    </button>
                  </div>
                </form>
              ) : null}
              {activeIncidentEvents.length > 0 ? (
                <div className={styles.timeline}>
                  {activeIncidentEvents.slice(0, 5).map((event) => (
                    <article className={styles.timelineItem} key={event.id}>
                      <strong>
                        {dashboardText(INCIDENT_EVENT_LABEL[event.type])}
                      </strong>
                      <span>
                        {event.message}
                        {event.fromStatus && event.toStatus
                          ? dashboardText("dashboard.statusTransition", {
                              from: dashboardText(
                                INCIDENT_STATUS_LABEL[event.fromStatus],
                              ),
                              to: dashboardText(
                                INCIDENT_STATUS_LABEL[event.toStatus],
                              ),
                            })
                          : ""}
                      </span>
                      <small>
                        {formatDateTime(
                          event.createdAt,
                          dictionary.formatLocale,
                        )}
                      </small>
                    </article>
                  ))}
                </div>
              ) : null}
            </section>
          ) : null}

          {(view === "dashboard" || view === "incidents") &&
          dispatchRecommendation ? (
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <span className={styles.kicker}>
                  {dashboardText("소방서 추천")}
                </span>
                <strong>{dispatchRecommendation.station.name}</strong>
              </div>
              <div className={styles.recommendationMeta}>
                <span>
                  <Route size={15} />{" "}
                  {distanceText(
                    dispatchRecommendation.distanceMeters,
                    dictionary.formatLocale,
                  )}
                </span>
                <span>
                  <Truck size={15} />
                  {dashboardText("dashboard.minutes", {
                    value: dispatchRecommendation.etaMinutes,
                  })}
                </span>
                <span>
                  {dashboardText("dashboard.points", {
                    value: dispatchRecommendation.score,
                  })}
                </span>
              </div>
              {dispatchRouteStatus ? (
                <p className={styles.itemReasons}>
                  {isDispatchRouteLoading
                    ? dashboardText("dashboard.calculatingPrefix")
                    : ""}
                  {dispatchRouteStatus}
                </p>
              ) : null}
              <div className={styles.criteriaGrid}>
                <span>{dashboardText("거리 기반 우선")}</span>
                <span>{dashboardText("예상 출동 시간")}</span>
                <span>{dashboardText("관할/인접 권역")}</span>
                <span>{dashboardText("보유 장비 가점")}</span>
              </div>
              <ul className={styles.reasonList}>
                {dispatchRecommendation.reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </section>
          ) : null}

          {(view === "dashboard" || view === "incidents") &&
          hospitalRecommendations.length > 0 ? (
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <span className={styles.kicker}>
                  {dashboardText("병원 추천")}
                </span>
                <strong>{dashboardText("사고 유형 기반 후보")}</strong>
              </div>
              <div className={styles.criteriaGrid}>
                <span>{dashboardText("응급실 운영")}</span>
                <span>{dashboardText("전문 진료 분야")}</span>
                <span>{dashboardText("거리/접근성")}</span>
              </div>
              <div className={styles.list}>
                {hospitalRecommendations.map((recommendation) => (
                  <article
                    className={styles.listItem}
                    key={recommendation.hospital.id}
                  >
                    <div>
                      <strong>{recommendation.hospital.name}</strong>
                      <small>
                        {dashboardText("dashboard.hospitalMeta", {
                          distance: distanceText(
                            recommendation.distanceMeters,
                            dictionary.formatLocale,
                          ),
                          emergencyRoom: dashboardText(
                            recommendation.hospital.emergencyRoom
                              ? "응급실 운영"
                              : "응급실 정보 없음",
                          ),
                        })}
                      </small>
                    </div>
                    <span>{recommendation.score}</span>
                    <p className={styles.itemReasons}>
                      {recommendation.reasons.join(" · ")}
                    </p>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {view === "create" ? (
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <span className={styles.kicker}>
                  {dashboardText("사고 등록")}
                </span>
                <strong>{dashboardText("지도 클릭 또는 좌표 입력")}</strong>
              </div>
              {reportLocation ? (
                <div className={styles.locationPreview}>
                  <MapPin aria-hidden="true" size={16} />
                  <div>
                    <strong>
                      {dashboardText("신고 예정 위치가 지도에 표시 중입니다")}
                    </strong>
                    <span>
                      {dashboardText("dashboard.reportLocation", {
                        address: reportLocation.address,
                        latitude: reportLocation.latitude.toFixed(5),
                        longitude: reportLocation.longitude.toFixed(5),
                      })}
                    </span>
                  </div>
                </div>
              ) : null}
              <form className={styles.form} onSubmit={createIncident}>
                <label>
                  {dashboardText("사고명")}
                  <input
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        title: event.target.value,
                      }))
                    }
                    value={form.title}
                  />
                </label>
                <div className={styles.formGrid}>
                  <label>
                    {dashboardText("유형")}
                    <select
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          type: event.target.value as IncidentType,
                        }))
                      }
                      value={form.type}
                    >
                      <option value="fire">{dashboardText("화재")}</option>
                      <option value="medical">{dashboardText("구급")}</option>
                      <option value="rescue">{dashboardText("구조")}</option>
                      <option value="traffic">
                        {dashboardText("교통사고")}
                      </option>
                    </select>
                  </label>
                  <label>
                    {dashboardText("위험도")}
                    <select
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          riskLevel: event.target.value as RiskLevel,
                        }))
                      }
                      value={form.riskLevel}
                    >
                      <option value="low">{dashboardText("낮음")}</option>
                      <option value="medium">{dashboardText("보통")}</option>
                      <option value="high">{dashboardText("높음")}</option>
                    </select>
                  </label>
                </div>
                <div className={styles.formGrid}>
                  <label>
                    {dashboardText("위도")}
                    <input
                      inputMode="decimal"
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          latitude: event.target.value,
                        }))
                      }
                      value={form.latitude}
                    />
                  </label>
                  <label>
                    {dashboardText("경도")}
                    <input
                      inputMode="decimal"
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          longitude: event.target.value,
                        }))
                      }
                      value={form.longitude}
                    />
                  </label>
                </div>
                <label>
                  {dashboardText("발생시각")}
                  <input
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        occurredAt: event.target.value,
                      }))
                    }
                    type="datetime-local"
                    value={form.occurredAt}
                  />
                </label>
                <label>
                  {dashboardText("주소")}
                  <input
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        address: event.target.value,
                      }))
                    }
                    value={form.address}
                  />
                </label>
                <label>
                  {dashboardText("설명")}
                  <textarea
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        description: event.target.value,
                      }))
                    }
                    rows={4}
                    value={form.description}
                  />
                </label>
                <button className={styles.primaryButton} type="submit">
                  <Plus aria-hidden="true" size={16} />
                  {dashboardText("사고 등록")}
                </button>
              </form>
            </section>
          ) : null}

          {(view === "incidents" || view === "dashboard") && (
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <span className={styles.kicker}>
                  {dashboardText("사고 목록")}
                </span>
                <strong>
                  {dashboardText("dashboard.incidentCount", {
                    filtered: filteredIncidents.length.toLocaleString(
                      dictionary.formatLocale,
                    ),
                    total: incidents.length.toLocaleString(
                      dictionary.formatLocale,
                    ),
                  })}
                </strong>
              </div>
              <div className={styles.filterBar}>
                <input
                  aria-label={dashboardText("사고 검색")}
                  onChange={(event) => setIncidentSearch(event.target.value)}
                  placeholder={dashboardText("사고명, 주소, 설명 검색")}
                  value={incidentSearch}
                />
                <select
                  aria-label={dashboardText("사고 유형 필터")}
                  onChange={(event) =>
                    setIncidentTypeFilter(
                      event.target.value as IncidentTypeFilter,
                    )
                  }
                  value={incidentTypeFilter}
                >
                  <option value="all">{dashboardText("전체 유형")}</option>
                  <option value="fire">{dashboardText("화재")}</option>
                  <option value="medical">{dashboardText("구급")}</option>
                  <option value="rescue">{dashboardText("구조")}</option>
                  <option value="traffic">{dashboardText("교통사고")}</option>
                </select>
                <select
                  aria-label={dashboardText("사고 상태 필터")}
                  onChange={(event) =>
                    setIncidentStatusFilter(
                      event.target.value as IncidentStatusFilter,
                    )
                  }
                  value={incidentStatusFilter}
                >
                  <option value="all">{dashboardText("전체 상태")}</option>
                  <option value="reported">{dashboardText("접수")}</option>
                  <option value="dispatched">{dashboardText("출동")}</option>
                  <option value="closed">{dashboardText("종료")}</option>
                </select>
              </div>
              <div className={styles.list}>
                {filteredIncidents.map((incident) => (
                  <button
                    className={
                      activeIncident?.id === incident.id
                        ? styles.listButtonActive
                        : styles.listButton
                    }
                    key={incident.id}
                    onClick={() => loadRecommendations(incident)}
                    type="button"
                  >
                    <span>
                      <MapPin aria-hidden="true" size={15} />
                      {incident.title}
                    </span>
                    <small>
                      {dashboardText("dashboard.incidentMeta", {
                        occurredAt: formatDateTime(
                          incident.occurredAt,
                          dictionary.formatLocale,
                        ),
                        risk: dashboardText(
                          RISK_LEVEL_LABEL[incident.riskLevel],
                        ),
                        status: dashboardText(
                          INCIDENT_STATUS_LABEL[incident.status],
                        ),
                        type: dashboardText(INCIDENT_TYPE_LABEL[incident.type]),
                      })}
                    </small>
                  </button>
                ))}
                {filteredIncidents.length === 0 ? (
                  <p className={styles.emptyState}>
                    {dashboardText("조건에 맞는 사고가 없습니다.")}
                  </p>
                ) : null}
              </div>
            </section>
          )}

          {view === "risk" ? (
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <span className={styles.kicker}>
                  {dashboardText("위험도 예측")}
                </span>
                <strong>{dashboardText("규칙 기반 점수")}</strong>
              </div>
              {activeRiskArea ? (
                <article className={styles.analysisCard}>
                  <div>
                    <strong>{activeRiskArea.name}</strong>
                    <span>
                      {dashboardText("dashboard.riskScore", {
                        level: dashboardText(
                          RISK_LEVEL_LABEL[activeRiskArea.riskLevel],
                        ),
                        score: activeRiskArea.riskScore,
                      })}
                    </span>
                  </div>
                  <dl>
                    <div>
                      <dt>{dashboardText("기준 점수")}</dt>
                      <dd>
                        {dashboardText("dashboard.points", {
                          value: activeRiskArea.baseScore,
                        })}
                      </dd>
                    </div>
                    <div>
                      <dt>{dashboardText("최근 사고")}</dt>
                      <dd>
                        {dashboardText("dashboard.count", {
                          value: activeRiskArea.recentIncidentCount,
                        })}
                      </dd>
                    </div>
                  </dl>
                  <ul className={styles.compactReasonList}>
                    {activeRiskArea.factors.map((factor) => (
                      <li key={factor}>{factor}</li>
                    ))}
                  </ul>
                </article>
              ) : null}
              <div className={styles.list}>
                {riskAreas.map((area) => (
                  <button
                    className={
                      activeRiskArea?.id === area.id
                        ? styles.listButtonActive
                        : styles.listButton
                    }
                    key={area.id}
                    onClick={() => {
                      setActiveRiskArea(area);
                      mapRef.current?.flyTo({
                        center: [area.longitude, area.latitude],
                        essential: true,
                        zoom: 12.4,
                      });
                    }}
                    type="button"
                  >
                    <span>
                      <Building2 aria-hidden="true" size={15} />
                      {area.name}
                    </span>
                    <small>
                      {dashboardText("dashboard.riskAreaMeta", {
                        factors: area.factors.join(", "),
                        level: dashboardText(RISK_LEVEL_LABEL[area.riskLevel]),
                        score: area.riskScore,
                      })}
                    </small>
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          {view === "resources" ? (
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <span className={styles.kicker}>
                  {dashboardText("자원 배치 지원")}
                </span>
                <strong>{dashboardText("의사결정 권고")}</strong>
              </div>
              <div className={styles.list}>
                {recommendations.map((recommendation) => (
                  <article
                    className={styles.resourceItem}
                    key={recommendation.id}
                  >
                    <div>
                      <strong>{recommendation.areaName}</strong>
                      <small>
                        {dashboardText("dashboard.resourceMeta", {
                          priority: dashboardText(
                            RISK_LEVEL_LABEL[recommendation.priority],
                          ),
                          score: recommendation.riskScore,
                          timeWindow: recommendation.timeWindow,
                        })}
                      </small>
                    </div>
                    <div className={styles.resourceCounts}>
                      <span>
                        <Truck size={15} />
                        {dashboardText("dashboard.vehicleCount", {
                          count: recommendation.recommendedFireEngines,
                          vehicle: dashboardText("소방차"),
                        })}
                      </span>
                      <span>
                        <Ambulance size={15} />
                        {dashboardText("dashboard.vehicleCount", {
                          count: recommendation.recommendedAmbulances,
                          vehicle: dashboardText("구급차"),
                        })}
                      </span>
                      <span>
                        <ShieldAlert size={15} />
                        {dashboardText("dashboard.vehicleCount", {
                          count: recommendation.recommendedRescueTrucks,
                          vehicle: dashboardText("구조차"),
                        })}
                      </span>
                    </div>
                    <p>{recommendation.message}</p>
                    <ul className={styles.compactReasonList}>
                      {recommendation.reasons.map((reason) => (
                        <li key={reason}>{reason}</li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>
            </section>
          ) : null}
        </aside>
      </main>
    </div>
  );
}
