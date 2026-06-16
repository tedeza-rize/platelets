"use client";

import type {
  MapGeoJSONFeature,
  MapLayerMouseEvent,
  Map as MapLibreMap,
  Popup,
  StyleSpecification,
} from "maplibre-gl";
import type { Dispatch, SetStateAction } from "react";
import { useEffect } from "react";
import type { DatasetSourceId } from "@/lib/dataset-sources";
import { type AppDictionary, uiText } from "@/lib/i18n";
import * as mapCore from "@/lib/map-shell-core";
import type { EmergencyRouteResult } from "./emergency-routing-panel";

type MutableRef<T> = {
  current: T;
};

type MapLibreModule = typeof import("maplibre-gl");

type MapRequestRef = {
  controller: AbortController;
  id: number;
} | null;

type InitializeMapOptions = {
  dictionary: AppDictionary;
  emergencyRouteRef: MutableRef<EmergencyRouteResult | null>;
  focusHazard: (event: mapCore.HazardEvent) => void;
  hazardsRef: MutableRef<mapCore.HazardEvent[]>;
  initialStyleRef: MutableRef<StyleSpecification>;
  isThreeDimensionalRef: MutableRef<boolean>;
  mapContainerRef: MutableRef<HTMLDivElement | null>;
  mapRef: MutableRef<MapLibreMap | null>;
  pointRequestRef: MutableRef<MapRequestRef>;
  pointsRef: MutableRef<mapCore.EmergencyPointMarker[]>;
  popupClassNames: mapCore.PopupClassNames;
  popupRef: MutableRef<Popup | null>;
  seoulAreasRef: MutableRef<mapCore.SeoulAreasData | null>;
  setIsMapReady: Dispatch<SetStateAction<boolean>>;
  setSeoulAreas: Dispatch<SetStateAction<mapCore.SeoulAreasData | null>>;
  sourceLabelsRef: MutableRef<Map<DatasetSourceId, string>>;
};

type StyleSyncOptions = {
  activeProvider: mapCore.MapProvider;
  dictionary: AppDictionary;
  emergencyRouteRef: MutableRef<EmergencyRouteResult | null>;
  hazardsRef: MutableRef<mapCore.HazardEvent[]>;
  isThreeDimensionalRef: MutableRef<boolean>;
  mapRef: MutableRef<MapLibreMap | null>;
  mapSettings: mapCore.MapShellProps["mapSettings"];
  pointsRef: MutableRef<mapCore.EmergencyPointMarker[]>;
  seoulAreasRef: MutableRef<mapCore.SeoulAreasData | null>;
  vworldApiKey: string;
};

type MapDisposal = {
  isDisposed: boolean;
};

function createMap(
  maplibre: MapLibreModule,
  options: InitializeMapOptions,
  forceWebgl: boolean,
) {
  const container = options.mapContainerRef.current;

  if (!container) {
    return null;
  }

  return new maplibre.Map({
    attributionControl: {
      compact: true,
    },
    bearing: options.isThreeDimensionalRef.current
      ? mapCore.THREE_DIMENSIONAL_BEARING
      : 0,
    canvasContextAttributes: forceWebgl
      ? {
          antialias: true,
          contextType: "webgl",
        }
      : {
          antialias: true,
        },
    center: mapCore.MAP_CENTER,
    container,
    pitch: options.isThreeDimensionalRef.current
      ? mapCore.THREE_DIMENSIONAL_PITCH
      : 0,
    style: options.initialStyleRef.current,
    zoom: mapCore.DEFAULT_ZOOM,
  });
}

function resetMapContainer(container: HTMLDivElement) {
  container.replaceChildren();
  container.classList.remove("maplibregl-map");
}

async function showPointPopup(
  maplibre: MapLibreModule,
  map: MapLibreMap,
  feature: MapGeoJSONFeature,
  options: InitializeMapOptions,
) {
  if (!feature?.properties) {
    return;
  }

  const point = feature.properties as mapCore.PointFeatureProperties;
  const coordinates: [number, number] = [
    Number(point.longitude),
    Number(point.latitude),
  ];

  if (!(Number.isFinite(coordinates[0]) && Number.isFinite(coordinates[1]))) {
    return;
  }

  const response = await fetch(`/api/points/${point.id}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    return;
  }

  const payload = (await response.json()) as mapCore.PointDetailResponse;
  options.popupRef.current?.remove();
  options.popupRef.current = new maplibre.Popup({
    closeButton: true,
    maxWidth: "320px",
    offset: 16,
  })
    .setLngLat(coordinates)
    .setHTML(
      mapCore.buildPopupHtml(
        payload.point,
        options.dictionary,
        options.sourceLabelsRef.current.get(payload.point.source) ??
          payload.point.source,
        options.popupClassNames,
      ),
    )
    .addTo(map);
}

async function showSeoulPopulationPopup(
  maplibre: MapLibreModule,
  map: MapLibreMap,
  feature: MapGeoJSONFeature,
  options: InitializeMapOptions,
) {
  if (!feature?.properties) {
    return;
  }

  const area = feature.properties as mapCore.SeoulAreaProperties;
  const point = feature.properties as mapCore.SeoulAreaPointProperties;
  const coordinates: [number, number] = [
    Number(point.longitude),
    Number(point.latitude),
  ];

  if (!(Number.isFinite(coordinates[0]) && Number.isFinite(coordinates[1]))) {
    return;
  }

  const response = await fetch(
    `/api/seoul/population?areaCode=${encodeURIComponent(area.areaCode)}`,
    { cache: "no-store" },
  );
  const payload = (await response
    .json()
    .catch(() => ({}))) as mapCore.SeoulPopulationResponse;
  const population = response.ok ? (payload.population ?? null) : null;

  if (population) {
    options.setSeoulAreas((current) =>
      current
        ? mapCore.updateSeoulAreaPopulation(current, population)
        : current,
    );
  }

  options.popupRef.current?.remove();
  options.popupRef.current = new maplibre.Popup({
    closeButton: true,
    maxWidth: "340px",
    offset: 12,
  })
    .setLngLat(coordinates)
    .setHTML(
      mapCore.buildSeoulPopulationPopupHtml(
        area,
        population,
        population
          ? null
          : (payload.error ??
              uiText(options.dictionary, "실시간 인구 조회 실패")),
        options.dictionary,
        options.popupClassNames,
      ),
    )
    .addTo(map);
}

async function handleMapClick(
  maplibre: MapLibreModule,
  map: MapLibreMap,
  event: MapLayerMouseEvent,
  options: InitializeMapOptions,
) {
  const layers = [
    mapCore.POINTS_SYMBOL_LAYER_ID,
    mapCore.POINTS_LAYER_ID,
    mapCore.SEOUL_AREAS_SYMBOL_LAYER_ID,
    mapCore.SEOUL_AREAS_LAYER_ID,
    mapCore.SEOUL_AREAS_HALO_LAYER_ID,
    mapCore.HAZARDS_LAYER_ID,
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
    feature.layer.id === mapCore.POINTS_LAYER_ID ||
    feature.layer.id === mapCore.POINTS_SYMBOL_LAYER_ID
  ) {
    await showPointPopup(maplibre, map, feature, options);
    return;
  }

  if (
    feature.layer.id === mapCore.SEOUL_AREAS_HALO_LAYER_ID ||
    feature.layer.id === mapCore.SEOUL_AREAS_LAYER_ID ||
    feature.layer.id === mapCore.SEOUL_AREAS_SYMBOL_LAYER_ID
  ) {
    await showSeoulPopulationPopup(maplibre, map, feature, options);
    return;
  }

  const eventId = String(
    (feature.properties as mapCore.HazardFeatureProperties).eventId,
  );
  const hazard = options.hazardsRef.current.find(
    (current) => current.eventId === eventId,
  );

  if (hazard) {
    options.focusHazard(hazard);
  }
}

function bindPointerCursors(map: MapLibreMap) {
  const pointerLayers = [
    mapCore.POINTS_LAYER_ID,
    mapCore.POINTS_SYMBOL_LAYER_ID,
    mapCore.SEOUL_AREAS_HALO_LAYER_ID,
    mapCore.SEOUL_AREAS_LAYER_ID,
    mapCore.SEOUL_AREAS_SYMBOL_LAYER_ID,
    mapCore.HAZARDS_LAYER_ID,
  ];

  for (const layerId of pointerLayers) {
    map.on("mouseenter", layerId, () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", layerId, () => {
      map.getCanvas().style.cursor = "";
    });
  }
}

function syncLoadedOverlays(map: MapLibreMap, options: InitializeMapOptions) {
  options.setIsMapReady(true);
  mapCore.syncSeoulAreaLayerWhenReady(
    map,
    options.seoulAreasRef.current,
    options.dictionary,
  );
  mapCore.syncPointLayerWhenReady(map, options.pointsRef.current);
  mapCore.syncHazardLayerWhenReady(map, options.hazardsRef.current);
  mapCore.syncEmergencyRouteLayerWhenReady(
    map,
    options.emergencyRouteRef.current,
  );
}

async function initializeMap(
  options: InitializeMapOptions,
  disposal: MapDisposal,
) {
  if (!options.mapContainerRef.current || options.mapRef.current) {
    return;
  }

  const maplibre = await import("maplibre-gl");

  if (
    disposal.isDisposed ||
    !options.mapContainerRef.current ||
    options.mapRef.current
  ) {
    return;
  }

  const container = options.mapContainerRef.current;
  let map: MapLibreMap | null;

  try {
    map = createMap(maplibre, options, true);
  } catch {
    resetMapContainer(container);

    try {
      map = createMap(maplibre, options, false);
    } catch {
      resetMapContainer(container);
      return;
    }
  }

  if (!map) {
    return;
  }

  options.mapRef.current = map;
  map.addControl(
    new maplibre.NavigationControl({
      showCompass: true,
    }),
    "top-right",
  );
  map.on("click", (event: MapLayerMouseEvent) => {
    void handleMapClick(maplibre, map, event, options);
  });
  bindPointerCursors(map);
  map.once("load", () => syncLoadedOverlays(map, options));
}

export function useInitializeMap(options: InitializeMapOptions) {
  const {
    dictionary,
    emergencyRouteRef,
    focusHazard,
    hazardsRef,
    initialStyleRef,
    isThreeDimensionalRef,
    mapContainerRef,
    mapRef,
    pointRequestRef,
    pointsRef,
    popupClassNames,
    popupRef,
    seoulAreasRef,
    setIsMapReady,
    setSeoulAreas,
    sourceLabelsRef,
  } = options;

  useEffect(() => {
    const disposal = { isDisposed: false };

    const initializeOptions: InitializeMapOptions = {
      dictionary,
      emergencyRouteRef,
      focusHazard,
      hazardsRef,
      initialStyleRef,
      isThreeDimensionalRef,
      mapContainerRef,
      mapRef,
      pointRequestRef,
      pointsRef,
      popupClassNames,
      popupRef,
      seoulAreasRef,
      setIsMapReady,
      setSeoulAreas,
      sourceLabelsRef,
    };

    void initializeMap(initializeOptions, disposal);

    return () => {
      disposal.isDisposed = true;
      pointRequestRef.current?.controller.abort();
      popupRef.current?.remove();
      mapRef.current?.remove();
      mapRef.current = null;
      setIsMapReady(false);
    };
  }, [
    dictionary,
    emergencyRouteRef,
    focusHazard,
    hazardsRef,
    initialStyleRef,
    isThreeDimensionalRef,
    mapContainerRef,
    mapRef,
    pointRequestRef,
    pointsRef,
    popupClassNames,
    popupRef,
    seoulAreasRef,
    setIsMapReady,
    setSeoulAreas,
    sourceLabelsRef,
  ]);
}

function syncStyleOverlays(map: MapLibreMap, options: StyleSyncOptions) {
  map.resize();
  mapCore.syncSeoulAreaLayerWhenReady(
    map,
    options.seoulAreasRef.current,
    options.dictionary,
  );
  mapCore.syncPointLayerWhenReady(map, options.pointsRef.current);
  mapCore.syncHazardLayerWhenReady(map, options.hazardsRef.current);
  mapCore.syncEmergencyRouteLayerWhenReady(
    map,
    options.emergencyRouteRef.current,
  );
  mapCore.syncThreeDimensionalView(map, options.isThreeDimensionalRef.current, {
    animate: false,
  });
}

export function useMapStyleSync(options: StyleSyncOptions) {
  const {
    activeProvider,
    dictionary,
    emergencyRouteRef,
    hazardsRef,
    isThreeDimensionalRef,
    mapRef,
    mapSettings,
    pointsRef,
    seoulAreasRef,
    vworldApiKey,
  } = options;

  useEffect(() => {
    if (!mapRef.current) {
      return;
    }

    const map = mapRef.current;
    let isDisposed = false;
    let timeoutId: number | undefined;
    const styleOptions: StyleSyncOptions = {
      activeProvider,
      dictionary,
      emergencyRouteRef,
      hazardsRef,
      isThreeDimensionalRef,
      mapRef,
      mapSettings,
      pointsRef,
      seoulAreasRef,
      vworldApiKey,
    };
    const style = mapCore.createMapStyle(
      activeProvider,
      vworldApiKey,
      mapSettings,
      {
        includeThreeDimensionalBuildings: true,
        threeDimensionalVisible: isThreeDimensionalRef.current,
      },
    );

    if (isDisposed) {
      return;
    }

    map.setStyle(style);
    timeoutId = window.setTimeout(() => {
      syncStyleOverlays(map, styleOptions);
    }, mapCore.STYLE_LOAD_TIMEOUT_MS);

    map.once("style.load", () => {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
      syncStyleOverlays(map, styleOptions);
    });

    return () => {
      isDisposed = true;
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [
    activeProvider,
    dictionary,
    emergencyRouteRef,
    hazardsRef,
    isThreeDimensionalRef,
    mapRef,
    mapSettings,
    pointsRef,
    seoulAreasRef,
    vworldApiKey,
  ]);
}
