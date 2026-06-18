"use client";

import type {
  MapLayerMouseEvent,
  Map as MapLibreMap,
  Popup,
  StyleSpecification,
} from "maplibre-gl";
import type { Dispatch, SetStateAction } from "react";
import { useEffect } from "react";
import type { DatasetSourceId } from "@/lib/dataset-sources";
import type { AppDictionary } from "@/lib/i18n";
import * as mapCore from "@/lib/map-shell-core";
import type { EmergencyRouteResult } from "./emergency-routing-panel";
import { handleMapClick } from "./map-shell-clicks";

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
    minZoom: 6,
    pitch: options.isThreeDimensionalRef.current
      ? mapCore.THREE_DIMENSIONAL_PITCH
      : 0,
    renderWorldCopies: false,
    style: options.initialStyleRef.current,
    zoom: mapCore.DEFAULT_ZOOM,
  });
}

function resetMapContainer(container: HTMLDivElement) {
  container.replaceChildren();
  container.classList.remove("maplibregl-map");
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
