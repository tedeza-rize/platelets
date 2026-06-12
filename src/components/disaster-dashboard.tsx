"use client";

import {
  AlertTriangle,
  Ambulance,
  Building2,
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
  ShieldAlert,
  Truck,
} from "lucide-react";
import type {
  GeoJSONSource,
  MapGeoJSONFeature,
  MapLayerMouseEvent,
  Map as MapLibreMap,
  Popup as MapLibrePopup,
  PropertyValueSpecification,
  StyleSpecification,
} from "maplibre-gl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import {
  DEFAULT_MAP_RENDERING_SETTINGS,
  type MapRenderingSettings,
} from "@/lib/map-settings";
import { createVworldStyle } from "@/lib/map-shell-core";
import styles from "./disaster-dashboard.module.css";

type DashboardView =
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

type DisasterDashboardProps = {
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

const MAP_CENTER: [number, number] = [127.85, 36.45];
const DEFAULT_ZOOM = 6.35;
const MAP_ROTATION_TUNING = {
  pitchDegreesPerPixelMoved: -0.18,
  rollDegreesPerPixelMoved: 0.12,
  rotateDegreesPerPixelMoved: 0.24,
};
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
        id: BUILDING_3D_LAYER_ID,
        minzoom: 14,
        paint: {
          "fill-extrusion-base": BUILDING_BASE_HEIGHT_EXPRESSION,
          "fill-extrusion-color": [
            "interpolate",
            ["linear"],
            ["zoom"],
            14,
            palette.building,
            16,
            "#c7c0b4",
          ],
          "fill-extrusion-height": BUILDING_HEIGHT_EXPRESSION,
          "fill-extrusion-opacity": 0.74,
        },
        source: OPENFREEMAP_SOURCE_ID,
        "source-layer": "building",
        type: "fill-extrusion",
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
        id: BUILDING_3D_LAYER_ID,
        minzoom: 14,
        paint: {
          "fill-extrusion-base": 0,
          "fill-extrusion-color": [
            "interpolate",
            ["linear"],
            ["zoom"],
            14,
            palette.building,
            16,
            "#c7c0b4",
          ],
          "fill-extrusion-height": 12,
          "fill-extrusion-opacity": 0.72,
        },
        source: OSM_OFFICIAL_SOURCE_ID,
        "source-layer": "buildings",
        type: "fill-extrusion",
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
    return createVworldStyle(vworldApiKey, settings.mapTileMode);
  }

  return settings.osmTileSource === "official"
    ? createOfficialOsmDashboardStyle()
    : createOpenFreeMapDashboardStyle();
}

function syncThreeDimensionalView(
  map: MapLibreMap,
  enabled: boolean,
  animate = true,
) {
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
  features: Array<GeoJSON.Feature<GeoJSON.Geometry, FeatureProperties>>,
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
          label: BIGDATA119_KIND_LABEL[point.kind],
          name: point.name,
          sourceId: point.sourceId,
        }),
      ),
  );
}

function userLocationData(location: UserLocation | null) {
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
        label: "내 위치",
        locatedAt: location.locatedAt,
      },
    ),
  ]);
}

function reportLocationData(location: ReportLocation | null) {
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
        label: "신고 예정 위치",
      },
    ),
  ]);
}

function routeData(
  incident: Incident | null,
  recommendation: DispatchRecommendation | null,
  dispatchRoute: DispatchRoute | null,
) {
  if (!incident || !recommendation) {
    return EMPTY_FEATURE_COLLECTION;
  }

  return featureCollection([
    lineFeature(
      `route-${recommendation.station.id}-${incident.id}`,
      dispatchRoute?.coordinates.length
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

function formatBuildingClass(value: string | null) {
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

  return labels[value] ?? value.replace(/_/g, " ");
}

function formatBuildingHeight(value: string | null) {
  if (!value) {
    return null;
  }

  const numeric = Number(value.replace(/m$/i, ""));

  if (!Number.isFinite(numeric)) {
    return value;
  }

  return `${numeric.toLocaleString("ko-KR", {
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
  fallbackLabel = "지도 선택 위치",
): ReportLocation {
  const latitude = Number(coordinates[1].toFixed(6));
  const longitude = Number(coordinates[0].toFixed(6));

  return {
    address:
      address ??
      `${fallbackLabel} (${latitude.toFixed(5)}, ${longitude.toFixed(5)})`,
    latitude,
    longitude,
  };
}

function buildBuildingReportAddress(
  buildingProperties: BuildingFeatureProperties | null,
  poiProperties: BuildingFeatureProperties | null,
  safetyProfile: BuildingSafetyProfile | null,
  coordinates: [number, number],
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
    "건물 선택 위치",
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
) {
  const name = buildingDisplayName(
    buildingProperties,
    poiProperties,
    safetyProfile,
  );
  const buildingType = formatBuildingClass(
    propertyText(buildingProperties, ["building", "type", "class"]),
  );
  const poiType = formatBuildingClass(
    propertyText(poiProperties, ["subclass", "class", "type"]),
  );
  const height = formatBuildingHeight(
    propertyText(buildingProperties, ["height", "render_height"]),
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
    ["주소", address],
    ["분류", poiType ?? buildingType],
    ["건물 용도", buildingType],
    ["높이", height],
    ["층수", levels ? `${levels}층` : null],
    ["좌표", coordinateLabel],
    ["데이터", "OpenStreetMap / OpenMapTiles"],
  ].filter((row): row is [string, string] => Boolean(row[1]));
  const rowsHtml = rows
    .map(
      ([label, value]) =>
        `<div class="${styles.popupRow}"><dt>${escapeHtml(
          label,
        )}</dt><dd>${escapeHtml(value)}</dd></div>`,
    )
    .join("");
  const title = name ? `[건물·시설] ${name}` : "[건물] 이름 정보 없음";
  const subtitle =
    safetyProfile?.dataStatus === "sample"
      ? "샘플 안전 프로필"
      : (poiType ?? buildingType ?? "공개 지도 건물 데이터");
  const searchQuery = name ?? address ?? coordinateLabel;
  const sectionText = safetyProfile?.section.length
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
  const sourceNotesText = safetyProfile?.sourceNotes.length
    ? safetyProfile.sourceNotes.join(" ")
    : null;
  const sourceLabel = safetyProfile?.sourceUrl
    ? `<a href="${escapeHtml(
        safetyProfile.sourceUrl,
      )}" target="_blank" rel="noreferrer">${escapeHtml(
        safetyProfile.sourceLabel,
      )}</a>`
    : escapeHtml(safetyProfile?.sourceLabel ?? "");
  const profileHtml = safetyProfile
    ? `<section class="${styles.popupSafety}">
        <strong>건물 단면도·비상구 프로필</strong>
        <p>${escapeHtml(
          safetyProfile.dataStatus === "sample"
            ? "발표용 샘플 도면 정보입니다. 실제 비상구/단면도는 승인된 시설·플랫폼 데이터 연동 후 교체해야 합니다."
            : "검증된 건물 안전 데이터입니다.",
        )}</p>
        <dl class="${styles.popupDetails}">
          ${
            sectionText
              ? `<div class="${styles.popupRow}"><dt>단면 요약</dt><dd>${escapeHtml(
                  sectionText,
                )}</dd></div>`
              : ""
          }
          <div class="${styles.popupRow}"><dt>비상구</dt><dd>${escapeHtml(
            safetyProfile.exits
              .map((exit) => `${exit.floor} ${exit.label}(${exit.direction})`)
              .join(", "),
          )}</dd></div>
          <div class="${styles.popupRow}"><dt>대피 장소</dt><dd>${escapeHtml(
            safetyProfile.nearestAssemblyPoint,
          )}</dd></div>
          ${
            evacuationRouteText
              ? `<div class="${styles.popupRow}"><dt>피난 경로</dt><dd>${escapeHtml(
                  evacuationRouteText,
                )}</dd></div>`
              : ""
          }
          <div class="${styles.popupRow}"><dt>층별 구조</dt><dd>${escapeHtml(
            safetyProfile.floors
              .map(
                (floor) =>
                  `${floor.floor}: ${floor.keySpaces.join("/")}${
                    floor.hazards.length
                      ? `, 위험요소 ${floor.hazards.join("/")}`
                      : ""
                  }`,
              )
              .join(" · "),
          )}</dd></div>
          <div class="${styles.popupRow}"><dt>출처</dt><dd>${sourceLabel}</dd></div>
          ${
            sourceNotesText
              ? `<div class="${styles.popupRow}"><dt>검증 메모</dt><dd>${escapeHtml(
                  sourceNotesText,
                )}</dd></div>`
              : ""
          }
        </dl>
      </section>`
    : `<section class="${styles.popupSafety}">
        <strong>건물 안전 프로필 없음</strong>
        <p>이 건물의 단면도/비상구 데이터는 아직 연결되지 않았습니다.</p>
      </section>`;

  return `<article class="${styles.popup}">
    <div class="${styles.popupHeader}">
      <strong>${escapeHtml(title)}</strong>
      <span>${escapeHtml(subtitle)}</span>
    </div>
    <dl class="${styles.popupDetails}">${rowsHtml}</dl>
    ${profileHtml}
    <div class="${styles.popupActions}">
      <button ${BUILDING_REPORT_ACTION_ATTRIBUTE}="true" type="button">이 위치 신고</button>
      <a href="${buildExternalMapSearchUrl(
        "naver",
        searchQuery,
      )}" target="_blank" rel="noreferrer">네이버 지도</a>
      <a href="${buildExternalMapSearchUrl(
        "kakao",
        searchQuery,
      )}" target="_blank" rel="noreferrer">카카오맵</a>
    </div>
  </article>`;
}

function dispatchRouteProviderLabel(route: DispatchRoute) {
  if (route.provider === "kakao") {
    return route.traffic?.status === "live" ? "카카오 교통 반영" : "카카오";
  }

  return route.traffic?.status === "live" ? "자체 A* + ITS 교통" : "자체 A*";
}

function dispatchRouteTrafficStatus(route: DispatchRoute) {
  if (!route.traffic) {
    return "";
  }

  if (route.traffic.status === "live") {
    return ` · ${route.traffic.message}`;
  }

  if (route.traffic.status === "unconfigured") {
    return " · ITS 교통 API 키 미설정";
  }

  return ` · ${route.traffic.message}`;
}

function buildUserLocationPopupHtml(location: UserLocation) {
  const rows = [
    [
      "좌표",
      `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`,
    ],
    ["정확도", distanceText(location.accuracy)],
    ["확인 시각", formatDateTime(location.locatedAt)],
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
      <strong>내 위치</strong>
      <span>브라우저 위치 정보</span>
    </div>
    <dl class="${styles.popupDetails}">${rowsHtml}</dl>
  </article>`;
}

function buildReportLocationPopupHtml(location: ReportLocation) {
  const coordinateLabel = `${location.latitude.toFixed(
    5,
  )}, ${location.longitude.toFixed(5)}`;
  const rows = [
    ["주소", location.address],
    ["좌표", coordinateLabel],
    ["상태", "등록 전 신고 후보 위치"],
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
      <strong>신고 예정 위치</strong>
      <span>사고 등록 폼에 반영된 지도 선택 지점</span>
    </div>
    <dl class="${styles.popupDetails}">${rowsHtml}</dl>
  </article>`;
}

function buildBigData119PopupHtml(point: BigData119MapPoint) {
  const coordinateLabel = `${point.latitude.toFixed(5)}, ${point.longitude.toFixed(5)}`;
  const rows = [
    ["유형", BIGDATA119_KIND_LABEL[point.kind]],
    ["분류", point.category],
    ["주소", point.address],
    ["지역", [point.city, point.district].filter(Boolean).join(" ")],
    ["관할", [point.stationName, point.centerName].filter(Boolean).join(" / ")],
    ["상태", point.status],
    ["좌표", coordinateLabel],
    [
      "데이터",
      point.isSample
        ? "소방안전 빅데이터 플랫폼 샘플"
        : "소방안전 빅데이터 플랫폼 CSV",
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
      <a href="${point.sourceUrl}" target="_blank" rel="noreferrer">데이터 출처</a>
      <a href="${buildExternalMapSearchUrl(
        "naver",
        point.address || point.name || coordinateLabel,
      )}" target="_blank" rel="noreferrer">네이버 지도</a>
    </div>
  </article>`;
}

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ko-KR", {
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
    return undefined;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
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

function distanceText(value: number) {
  if (value >= 1000) {
    return `${(value / 1000).toLocaleString("ko-KR", {
      maximumFractionDigits: 1,
    })}km`;
  }

  return `${value.toLocaleString("ko-KR")}m`;
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
  initialView = "dashboard",
  mapSettings = DEFAULT_MAP_RENDERING_SETTINGS,
  vworldApiKey = "",
}: DisasterDashboardProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const popupRef = useRef<import("maplibre-gl").Popup | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const [isThreeDimensional, setIsThreeDimensional] = useState(true);
  const isThreeDimensionalRef = useRef(true);
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
  const [notice, setNotice] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
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
    address: "서울특별시 중구 세종대로 110",
    description: "",
    latitude: "37.5665",
    longitude: "126.9780",
    occurredAt: localDateTimeInputValue(new Date()),
    riskLevel: "high",
    title: "신규 재난 신고",
    type: "fire",
  });

  const incidentsRef = useRef<Incident[]>([]);
  const riskAreasRef = useRef<RiskArea[]>([]);
  const bigData119PointsRef = useRef<BigData119MapPoint[]>([]);
  const userLocationRef = useRef<UserLocation | null>(null);
  const reportLocationRef = useRef<ReportLocation | null>(null);
  const didFitInitialSnapshotRef = useRef(false);

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
          payload.error ?? "대시보드 데이터를 불러오지 못했습니다.",
        );
      }

      setSnapshot(payload);
      setActiveIncident((current) => current ?? payload.activeIncident);
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
  }, []);

  const loadRecommendations = useCallback(async (incident: Incident) => {
    popupRef.current?.remove();
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
      setNotice(payload.error ?? "추천 정보를 불러오지 못했습니다.");
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
  }, []);

  useEffect(() => {
    if (!activeIncident || !dispatchRecommendation) {
      setDispatchRoute(null);
      setDispatchRouteStatus(null);
      setIsDispatchRouteLoading(false);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 9_000);

    setIsDispatchRouteLoading(true);
    setDispatchRoute(null);
    setDispatchRouteStatus("추천 소방서에서 사고지점까지 도로 경로 계산 중");

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

        if (!response.ok || !payload.route) {
          throw new Error(payload.error ?? "도로 경로 계산 실패");
        }

        setDispatchRoute(payload.route);
        setDispatchRouteStatus(
          `${dispatchRouteProviderLabel(payload.route)} 도로 경로 ${distanceText(
            payload.route.distanceMeters,
          )} · ${Math.max(
            1,
            Math.round(payload.route.durationSeconds / 60),
          )}분${dispatchRouteTrafficStatus(payload.route)}`,
        );
      })
      .catch((error) => {
        if (controller.signal.aborted) {
          setDispatchRouteStatus(
            "도로 경로 계산 시간 초과, 직선 예비 경로 표시",
          );
          return;
        }

        setDispatchRouteStatus(
          `도로 경로 계산 실패, 직선 예비 경로 표시: ${
            error instanceof Error ? error.message : String(error)
          }`,
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
  }, [activeIncident, dispatchRecommendation]);

  const locateUser = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setNotice("이 브라우저에서는 위치 확인을 사용할 수 없습니다.");
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
          address: `현재 위치 (${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)})`,
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
        setNotice("현재 위치를 지도와 사고 등록 폼에 반영했습니다.");

        const map = mapRef.current;

        if (map) {
          map.flyTo({
            bearing: isThreeDimensionalRef.current
              ? THREE_DIMENSIONAL_BEARING
              : 0,
            center: [location.longitude, location.latitude],
            essential: true,
            pitch: isThreeDimensionalRef.current ? THREE_DIMENSIONAL_PITCH : 0,
            zoom: Math.max(map.getZoom(), 15),
          });

          void import("maplibre-gl").then((maplibre) => {
            popupRef.current?.remove();
            popupRef.current = new maplibre.Popup({
              closeButton: true,
              maxWidth: "300px",
              offset: 14,
            })
              .setLngLat([location.longitude, location.latitude])
              .setHTML(buildReportLocationPopupHtml(report))
              .addTo(map);
            suppressPopupContextMenu(popupRef.current);
          });
        }

        setIsLocating(false);
      },
      (error) => {
        setNotice(
          error.message
            ? `현재 위치를 확인하지 못했습니다: ${error.message}`
            : "현재 위치를 확인하지 못했습니다.",
        );
        setIsLocating(false);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 30_000,
        timeout: 12_000,
      },
    );
  }, []);

  useEffect(() => {
    loadSnapshot();
  }, [loadSnapshot]);

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

    loadIncidentEvents();

    return () => {
      disposed = true;
    };
  }, [activeIncident]);

  useEffect(() => {
    isThreeDimensionalRef.current = isThreeDimensional;

    const map = mapRef.current;

    if (!map || !isMapReady) {
      return;
    }

    syncThreeDimensionalView(map, isThreeDimensional);
  }, [isMapReady, isThreeDimensional]);

  useEffect(() => {
    userLocationRef.current = userLocation;

    const map = mapRef.current;

    if (!map || !isMapReady) {
      return;
    }

    setSourceData(map, USER_LOCATION_SOURCE_ID, userLocationData(userLocation));
  }, [isMapReady, userLocation]);

  useEffect(() => {
    reportLocationRef.current = reportLocation;

    const map = mapRef.current;

    if (!map || !isMapReady) {
      return;
    }

    setSourceData(
      map,
      REPORT_LOCATION_SOURCE_ID,
      reportLocationData(reportLocation),
    );
  }, [isMapReady, reportLocation]);

  useEffect(() => {
    if (!reportLocation) {
      return;
    }

    const latitude = Number(form.latitude);
    const longitude = Number(form.longitude);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
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

    async function createMap() {
      const maplibre = await import("maplibre-gl");

      if (disposed || !mapContainerRef.current) {
        return;
      }

      const map = new maplibre.Map({
        attributionControl: { compact: true },
        center: MAP_CENTER,
        container: mapContainerRef.current,
        ...MAP_ROTATION_TUNING,
        style: createDashboardMapStyle(effectiveMapSettings, vworldApiKey),
        zoom: DEFAULT_ZOOM,
      });

      mapRef.current = map;
      map.addControl(
        new maplibre.NavigationControl({ showCompass: true }),
        "top-right",
      );

      function selectReportLocation(report: ReportLocation, message: string) {
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
          ),
        );
        selectReportLocation(
          report,
          "건물 위치가 신고 예정 위치로 표시되었습니다. 건물 정보를 확인한 뒤 등록하세요.",
        );

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
              "건물 위치를 신고 예정 위치로 지정했습니다. 내용을 확인한 뒤 등록하세요.",
            );
            showReportLocationPopup(report);
          });
      }

      function showUserLocationPopup(location: UserLocation) {
        popupRef.current?.remove();
        popupRef.current = new maplibre.Popup({
          closeButton: true,
          maxWidth: "300px",
          offset: 14,
        })
          .setLngLat([location.longitude, location.latitude])
          .setHTML(buildUserLocationPopupHtml(location))
          .addTo(map);
        suppressPopupContextMenu(popupRef.current);
      }

      function showReportLocationPopup(location: ReportLocation) {
        popupRef.current?.remove();
        popupRef.current = new maplibre.Popup({
          closeButton: true,
          maxWidth: "320px",
          offset: 14,
        })
          .setLngLat([location.longitude, location.latitude])
          .setHTML(buildReportLocationPopupHtml(location))
          .addTo(map);
        suppressPopupContextMenu(popupRef.current);
      }

      function showBigData119Popup(point: BigData119MapPoint) {
        popupRef.current?.remove();
        popupRef.current = new maplibre.Popup({
          closeButton: true,
          maxWidth: "340px",
          offset: 12,
        })
          .setLngLat([point.longitude, point.latitude])
          .setHTML(buildBigData119PopupHtml(point))
          .addTo(map);
        suppressPopupContextMenu(popupRef.current);
      }

      map.on("load", () => {
        addDashboardLayers(map);
        setSourceData(
          map,
          BIGDATA119_SOURCE_ID,
          bigData119Data(bigData119PointsRef.current, visibleBigDataKinds),
        );
        setSourceData(
          map,
          USER_LOCATION_SOURCE_ID,
          userLocationData(userLocationRef.current),
        );
        setSourceData(
          map,
          REPORT_LOCATION_SOURCE_ID,
          reportLocationData(reportLocationRef.current),
        );
        syncThreeDimensionalView(map, isThreeDimensionalRef.current, false);
        setIsMapReady(true);
      });
      map.on("click", INCIDENT_LAYER_ID, (event: MapLayerMouseEvent) => {
        const id = featureId(event.features?.[0]);
        const incident = incidentsRef.current.find((item) => item.id === id);

        if (incident) {
          loadRecommendations(incident);
        }
      });
      map.on("click", RISK_AREA_LAYER_ID, (event: MapLayerMouseEvent) => {
        const id = featureId(event.features?.[0]);
        const area = riskAreasRef.current.find((item) => item.id === id);

        if (area) {
          popupRef.current?.remove();
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
            [INCIDENT_LAYER_ID, RISK_AREA_LAYER_ID].includes(feature.layer.id)
          ) {
            if (feature.layer.id === INCIDENT_LAYER_ID) {
              return;
            }
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
            reportLocationRef.current = null;
            setReportLocation(null);
            setActiveRiskArea(area);
            setView("risk");
            return;
          }
        }

        const report = createReportLocation([
          event.lngLat.lng,
          event.lngLat.lat,
        ]);

        selectReportLocation(
          report,
          "지도에서 사고 위치가 선택되었습니다. 내용을 확인한 뒤 등록하세요.",
        );
        showReportLocationPopup(report);
      });
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
        map.on("mouseenter", layerId, () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", layerId, () => {
          map.getCanvas().style.cursor = "";
        });
      }
    }

    createMap();

    return () => {
      disposed = true;
      popupRef.current?.remove();
      popupRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [
    effectiveMapSettings,
    loadRecommendations,
    visibleBigDataKinds,
    vworldApiKey,
  ]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map || !isMapReady || !snapshot) {
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
      bigData119Data(snapshot.bigData119Points, visibleBigDataKinds),
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

  async function createIncident(event: React.FormEvent) {
    event.preventDefault();
    setNotice("사고 정보를 등록하고 추천을 계산하는 중입니다.");

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

      if (!response.ok || !payload.incident) {
        throw new Error(payload.error ?? "사고 등록에 실패했습니다.");
      }

      popupRef.current?.remove();
      reportLocationRef.current = null;
      setReportLocation(null);
      await loadSnapshot();
      await loadRecommendations(payload.incident);
      setNotice("사고가 등록되었습니다.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    }
  }

  async function updateIncidentStatus(status: IncidentStatus) {
    if (!activeIncident) {
      return;
    }

    setIsStatusUpdating(true);
    setNotice("사고 상태를 업데이트하는 중입니다.");

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

      if (!response.ok || !payload.incident) {
        throw new Error(payload.error ?? "사고 상태 변경에 실패했습니다.");
      }

      setActiveIncident(payload.incident);
      await loadSnapshot();
      await loadRecommendations(payload.incident);
      setNotice("사고 상태가 업데이트되었습니다.");
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

    if (!editIncidentId || !editIncidentForm) {
      return;
    }

    setIsIncidentSaving(true);
    setNotice("사고 정보를 수정하는 중입니다.");

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

      if (!response.ok || !payload.incident) {
        throw new Error(payload.error ?? "사고 정보 수정에 실패했습니다.");
      }

      setEditIncidentId(null);
      setEditIncidentForm(null);
      setActiveIncident(payload.incident);
      setActiveIncidentEvents(payload.events ?? []);
      await loadSnapshot();
      await loadRecommendations(payload.incident);
      setNotice("사고 정보가 수정되었습니다.");
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

    const confirmed = window.confirm(
      `"${activeIncident.title}" 사고를 삭제할까요? 삭제한 사고는 목록과 지도에서 제거됩니다.`,
    );

    if (!confirmed) {
      return;
    }

    setIsIncidentDeleting(true);
    setNotice("사고를 삭제하는 중입니다.");

    try {
      const response = await fetch(
        `/api/disaster/incidents/${encodeURIComponent(activeIncident.id)}`,
        { method: "DELETE" },
      );
      const payload = (await response.json().catch(() => null)) as {
        deleted?: boolean;
        error?: string;
      } | null;

      if (!response.ok || !payload?.deleted) {
        throw new Error(payload?.error ?? "사고 삭제에 실패했습니다.");
      }

      popupRef.current?.remove();
      setActiveIncident(null);
      setActiveIncidentEvents([]);
      setDispatchRecommendation(null);
      setHospitalRecommendations([]);
      cancelIncidentEdit();
      await loadSnapshot();
      setNotice("사고가 삭제되었습니다.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setIsIncidentDeleting(false);
    }
  }

  const riskAreas = snapshot?.riskAreas ?? [];
  const incidents = snapshot?.incidents ?? [];
  const recommendations = snapshot?.resourceRecommendations ?? [];
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
          Platelets 통합 재난 지도
        </a>
        <nav className={styles.nav} aria-label="재난 대응 화면">
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
              {label}
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
          새로고침
        </button>
      </header>

      <main className={styles.shell}>
        <section className={styles.mapPane}>
          <div className={styles.map} ref={mapContainerRef} />
          <div
            className={styles.mapControls}
            aria-label="지도 도구"
            role="toolbar"
          >
            <button
              aria-pressed={isThreeDimensional}
              className={
                isThreeDimensional ? styles.mapToggleActive : styles.mapToggle
              }
              onClick={() => setIsThreeDimensional((current) => !current)}
              title="3D 건물 보기"
              type="button"
            >
              3D
            </button>
            <button
              className={styles.mapToggle}
              disabled={isLocating}
              onClick={locateUser}
              title="내 위치로 이동"
              type="button"
            >
              <LocateFixed aria-hidden="true" size={15} />
              {isLocating ? "확인 중" : "내 위치"}
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
              title="소방안전 빅데이터 특정소방대상물 표시"
              type="button"
            >
              대상물
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
              title="소방안전 빅데이터 소방용수 표시"
              type="button"
            >
              소방용수
            </button>
          </div>
          <div className={styles.mapLegend}>
            <span>
              <i className={styles.legendIncident} /> 사고
            </span>
            <span>
              <i className={styles.legendStation} /> 소방서
            </span>
            <span>
              <i className={styles.legendHospital} /> 병원
            </span>
            <span>
              <i className={styles.legendRisk} /> 위험도
            </span>
            <span>
              <i className={styles.legendBigDataTarget} /> 특정소방대상물
            </span>
            <span>
              <i className={styles.legendBigDataWater} /> 소방용수
            </span>
          </div>
        </section>

        <aside className={styles.panel}>
          <section className={styles.summaryGrid} aria-label="운영 지표">
            <article className={styles.metric}>
              <AlertTriangle aria-hidden="true" size={18} />
              <span>{summary.activeIncidents}</span>
              <small>진행 사고</small>
            </article>
            <article className={styles.metric}>
              <Flame aria-hidden="true" size={18} />
              <span>{summary.fireStations}</span>
              <small>소방 거점</small>
            </article>
            <article className={styles.metric}>
              <Hospital aria-hidden="true" size={18} />
              <span>{summary.hospitals}</span>
              <small>응급 병원</small>
            </article>
            <article className={styles.metric}>
              <Layers aria-hidden="true" size={18} />
              <span>{summary.highRiskAreas}</span>
              <small>고위험 지역</small>
            </article>
            <article className={styles.metric}>
              <Database aria-hidden="true" size={18} />
              <span>{summary.bigData119Points}</span>
              <small>빅데이터 포인트</small>
            </article>
            <article className={styles.metric}>
              <Route aria-hidden="true" size={18} />
              <span>{summary.bigData119OperationalRows}</span>
              <small>신고·출동 행</small>
            </article>
          </section>

          {notice ? <output className={styles.notice}>{notice}</output> : null}

          {snapshot?.bigData119Summaries.length ? (
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <span className={styles.kicker}>소방안전 빅데이터 활용</span>
                <strong>
                  플랫폼 CSV {snapshot.bigData119Summaries.length}종 지도 반영
                </strong>
              </div>
              <div className={styles.dataSourceGrid}>
                {snapshot.bigData119Summaries.map((source) => (
                  <a
                    className={styles.dataSourceItem}
                    href={source.sourceUrl}
                    key={source.sourceId}
                    rel="noreferrer"
                    target="_blank"
                  >
                    {source.kind === "fire-water-source" ? (
                      <Droplets aria-hidden="true" size={16} />
                    ) : (
                      <Building2 aria-hidden="true" size={16} />
                    )}
                    <div>
                      <strong>{source.sourceLabel}</strong>
                      <span>
                        {source.mappedCount.toLocaleString("ko-KR")}개 좌표 ·{" "}
                        {source.regions.slice(0, 2).join(", ") ||
                          "지역 정보 없음"}
                        {source.regions.length > 2 ? " 외" : ""} ·{" "}
                        {source.isSample ? "샘플" : "승인 CSV"}
                      </span>
                    </div>
                  </a>
                ))}
              </div>
            </section>
          ) : null}

          {snapshot?.bigData119OperationalSummaries.length ? (
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <span className={styles.kicker}>119 신고·출동 데이터</span>
                <strong>
                  운영 CSV {snapshot.bigData119OperationalSummaries.length}종
                  위험도 반영
                </strong>
              </div>
              <div className={styles.dataSourceGrid}>
                {snapshot.bigData119OperationalSummaries.map((source) => (
                  <a
                    className={styles.dataSourceItem}
                    href={source.sourceUrl}
                    key={source.sourceId}
                    rel="noreferrer"
                    target="_blank"
                  >
                    {source.kind === "ems-dispatch" ? (
                      <Ambulance aria-hidden="true" size={16} />
                    ) : source.kind === "rescue-dispatch" ? (
                      <Truck aria-hidden="true" size={16} />
                    ) : (
                      <AlertTriangle aria-hidden="true" size={16} />
                    )}
                    <div>
                      <strong>{source.sourceLabel}</strong>
                      <span>
                        {BIGDATA119_OPERATIONAL_KIND_LABEL[source.kind]} ·{" "}
                        {source.rowCount.toLocaleString("ko-KR")}행 ·{" "}
                        {source.regions.slice(0, 2).join(", ") ||
                          "지역 정보 없음"}
                        {source.regions.length > 2 ? " 외" : ""} ·{" "}
                        {source.isSample ? "샘플" : "승인 CSV"}
                      </span>
                      <span>
                        {source.incidentTypeHints.slice(0, 2).join(", ") ||
                          "유형 정보 없음"}{" "}
                        · {source.timeHints[0] ?? "시간 정보 없음"}
                        {source.averageDispatchDistanceMeters
                          ? ` · 평균 거리 ${distanceText(
                              source.averageDispatchDistanceMeters,
                            )}`
                          : ""}
                      </span>
                      {source.areaLoads.length ? (
                        <span>
                          위험권역 매칭:{" "}
                          {source.areaLoads
                            .slice(0, 2)
                            .map(
                              (areaLoad) =>
                                `${areaLoad.areaName} ${areaLoad.rowCount.toLocaleString(
                                  "ko-KR",
                                )}건`,
                            )
                            .join(", ")}
                          {source.areaLoads.length > 2 ? " 외" : ""}
                        </span>
                      ) : null}
                    </div>
                  </a>
                ))}
              </div>
            </section>
          ) : null}

          {(view === "dashboard" || view === "incidents") && activeIncident ? (
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <span className={styles.kicker}>선택 사고</span>
                <strong>{activeIncident.title}</strong>
              </div>
              <dl className={styles.detailGrid}>
                <div>
                  <dt>유형</dt>
                  <dd>{INCIDENT_TYPE_LABEL[activeIncident.type]}</dd>
                </div>
                <div>
                  <dt>위험도</dt>
                  <dd>{RISK_LEVEL_LABEL[activeIncident.riskLevel]}</dd>
                </div>
                <div>
                  <dt>상태</dt>
                  <dd>{INCIDENT_STATUS_LABEL[activeIncident.status]}</dd>
                </div>
                <div>
                  <dt>발생시각</dt>
                  <dd>{formatDateTime(activeIncident.occurredAt)}</dd>
                </div>
                <div>
                  <dt>위치</dt>
                  <dd>{activeIncident.address}</dd>
                </div>
              </dl>
              <p className={styles.description}>{activeIncident.description}</p>
              <div className={styles.statusActions}>
                {activeIncident.status !== "dispatched" ? (
                  <button
                    className={styles.primaryButton}
                    disabled={isStatusUpdating || isIncidentDeleting}
                    onClick={() => updateIncidentStatus("dispatched")}
                    type="button"
                  >
                    출동 처리
                  </button>
                ) : null}
                {activeIncident.status !== "closed" ? (
                  <button
                    className={styles.dangerButton}
                    disabled={isStatusUpdating || isIncidentDeleting}
                    onClick={() => updateIncidentStatus("closed")}
                    type="button"
                  >
                    종료
                  </button>
                ) : null}
                {activeIncident.status !== "reported" ? (
                  <button
                    className={styles.secondaryButton}
                    disabled={isStatusUpdating || isIncidentDeleting}
                    onClick={() => updateIncidentStatus("reported")}
                    type="button"
                  >
                    접수로 되돌리기
                  </button>
                ) : null}
                <button
                  className={styles.secondaryButton}
                  disabled={isIncidentSaving || isIncidentDeleting}
                  onClick={() => startIncidentEdit(activeIncident)}
                  type="button"
                >
                  수정
                </button>
                <button
                  className={styles.dangerButton}
                  disabled={isIncidentDeleting}
                  onClick={deleteActiveIncident}
                  type="button"
                >
                  삭제
                </button>
              </div>
              {editIncidentId === activeIncident.id && editIncidentForm ? (
                <form className={styles.form} onSubmit={saveIncidentEdit}>
                  <label>
                    사고명
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
                      유형
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
                        <option value="fire">화재</option>
                        <option value="medical">구급</option>
                        <option value="rescue">구조</option>
                        <option value="traffic">교통사고</option>
                      </select>
                    </label>
                    <label>
                      위험도
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
                        <option value="low">낮음</option>
                        <option value="medium">보통</option>
                        <option value="high">높음</option>
                      </select>
                    </label>
                  </div>
                  <div className={styles.formGrid}>
                    <label>
                      위도
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
                      경도
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
                    발생시각
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
                    주소
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
                    설명
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
                      저장
                    </button>
                    <button
                      className={styles.secondaryButton}
                      disabled={isIncidentSaving}
                      onClick={cancelIncidentEdit}
                      type="button"
                    >
                      취소
                    </button>
                  </div>
                </form>
              ) : null}
              {activeIncidentEvents.length > 0 ? (
                <div className={styles.timeline}>
                  {activeIncidentEvents.slice(0, 5).map((event) => (
                    <article className={styles.timelineItem} key={event.id}>
                      <strong>{INCIDENT_EVENT_LABEL[event.type]}</strong>
                      <span>
                        {event.message}
                        {event.fromStatus && event.toStatus
                          ? ` · ${INCIDENT_STATUS_LABEL[event.fromStatus]} -> ${INCIDENT_STATUS_LABEL[event.toStatus]}`
                          : ""}
                      </span>
                      <small>{formatDateTime(event.createdAt)}</small>
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
                <span className={styles.kicker}>소방서 추천</span>
                <strong>{dispatchRecommendation.station.name}</strong>
              </div>
              <div className={styles.recommendationMeta}>
                <span>
                  <Route size={15} />{" "}
                  {distanceText(dispatchRecommendation.distanceMeters)}
                </span>
                <span>
                  <Truck size={15} /> {dispatchRecommendation.etaMinutes}분
                </span>
                <span>{dispatchRecommendation.score}점</span>
              </div>
              {dispatchRouteStatus ? (
                <p className={styles.itemReasons}>
                  {isDispatchRouteLoading ? "계산 중 · " : ""}
                  {dispatchRouteStatus}
                </p>
              ) : null}
              <div className={styles.criteriaGrid}>
                <span>거리 기반 우선</span>
                <span>예상 출동 시간</span>
                <span>관할/인접 권역</span>
                <span>보유 장비 가점</span>
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
                <span className={styles.kicker}>병원 추천</span>
                <strong>사고 유형 기반 후보</strong>
              </div>
              <div className={styles.criteriaGrid}>
                <span>응급실 운영</span>
                <span>전문 진료 분야</span>
                <span>거리/접근성</span>
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
                        {distanceText(recommendation.distanceMeters)} ·{" "}
                        {recommendation.hospital.emergencyRoom
                          ? "응급실 운영"
                          : "응급실 정보 없음"}
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
                <span className={styles.kicker}>사고 등록</span>
                <strong>지도 클릭 또는 좌표 입력</strong>
              </div>
              {reportLocation ? (
                <div className={styles.locationPreview}>
                  <MapPin aria-hidden="true" size={16} />
                  <div>
                    <strong>신고 예정 위치가 지도에 표시 중입니다</strong>
                    <span>
                      {reportLocation.address} ·{" "}
                      {reportLocation.latitude.toFixed(5)},{" "}
                      {reportLocation.longitude.toFixed(5)}
                    </span>
                  </div>
                </div>
              ) : null}
              <form className={styles.form} onSubmit={createIncident}>
                <label>
                  사고명
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
                    유형
                    <select
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          type: event.target.value as IncidentType,
                        }))
                      }
                      value={form.type}
                    >
                      <option value="fire">화재</option>
                      <option value="medical">구급</option>
                      <option value="rescue">구조</option>
                      <option value="traffic">교통사고</option>
                    </select>
                  </label>
                  <label>
                    위험도
                    <select
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          riskLevel: event.target.value as RiskLevel,
                        }))
                      }
                      value={form.riskLevel}
                    >
                      <option value="low">낮음</option>
                      <option value="medium">보통</option>
                      <option value="high">높음</option>
                    </select>
                  </label>
                </div>
                <div className={styles.formGrid}>
                  <label>
                    위도
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
                    경도
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
                  발생시각
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
                  주소
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
                  설명
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
                  <Plus aria-hidden="true" size={16} /> 사고 등록
                </button>
              </form>
            </section>
          ) : null}

          {(view === "incidents" || view === "dashboard") && (
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <span className={styles.kicker}>사고 목록</span>
                <strong>
                  {filteredIncidents.length.toLocaleString("ko-KR")} /{" "}
                  {incidents.length.toLocaleString("ko-KR")}건
                </strong>
              </div>
              <div className={styles.filterBar}>
                <input
                  aria-label="사고 검색"
                  onChange={(event) => setIncidentSearch(event.target.value)}
                  placeholder="사고명, 주소, 설명 검색"
                  value={incidentSearch}
                />
                <select
                  aria-label="사고 유형 필터"
                  onChange={(event) =>
                    setIncidentTypeFilter(
                      event.target.value as IncidentTypeFilter,
                    )
                  }
                  value={incidentTypeFilter}
                >
                  <option value="all">전체 유형</option>
                  <option value="fire">화재</option>
                  <option value="medical">구급</option>
                  <option value="rescue">구조</option>
                  <option value="traffic">교통사고</option>
                </select>
                <select
                  aria-label="사고 상태 필터"
                  onChange={(event) =>
                    setIncidentStatusFilter(
                      event.target.value as IncidentStatusFilter,
                    )
                  }
                  value={incidentStatusFilter}
                >
                  <option value="all">전체 상태</option>
                  <option value="reported">접수</option>
                  <option value="dispatched">출동</option>
                  <option value="closed">종료</option>
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
                      {INCIDENT_TYPE_LABEL[incident.type]} ·{" "}
                      {RISK_LEVEL_LABEL[incident.riskLevel]} ·{" "}
                      {INCIDENT_STATUS_LABEL[incident.status]} ·{" "}
                      {formatDateTime(incident.occurredAt)}
                    </small>
                  </button>
                ))}
                {filteredIncidents.length === 0 ? (
                  <p className={styles.emptyState}>
                    조건에 맞는 사고가 없습니다.
                  </p>
                ) : null}
              </div>
            </section>
          )}

          {view === "risk" ? (
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <span className={styles.kicker}>위험도 예측</span>
                <strong>규칙 기반 점수</strong>
              </div>
              {activeRiskArea ? (
                <article className={styles.analysisCard}>
                  <div>
                    <strong>{activeRiskArea.name}</strong>
                    <span>
                      {RISK_LEVEL_LABEL[activeRiskArea.riskLevel]} ·{" "}
                      {activeRiskArea.riskScore}점
                    </span>
                  </div>
                  <dl>
                    <div>
                      <dt>기준 점수</dt>
                      <dd>{activeRiskArea.baseScore}점</dd>
                    </div>
                    <div>
                      <dt>최근 사고</dt>
                      <dd>{activeRiskArea.recentIncidentCount}건</dd>
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
                      {RISK_LEVEL_LABEL[area.riskLevel]} · {area.riskScore}점 ·{" "}
                      {area.factors.join(", ")}
                    </small>
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          {view === "resources" ? (
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <span className={styles.kicker}>자원 배치 지원</span>
                <strong>의사결정 권고</strong>
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
                        {recommendation.timeWindow} ·{" "}
                        {RISK_LEVEL_LABEL[recommendation.priority]} 우선순위 ·{" "}
                        위험도 {recommendation.riskScore}점
                      </small>
                    </div>
                    <div className={styles.resourceCounts}>
                      <span>
                        <Truck size={15} /> 소방차{" "}
                        {recommendation.recommendedFireEngines}대
                      </span>
                      <span>
                        <Ambulance size={15} /> 구급차{" "}
                        {recommendation.recommendedAmbulances}대
                      </span>
                      <span>
                        <ShieldAlert size={15} /> 구조차{" "}
                        {recommendation.recommendedRescueTrucks}대
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
