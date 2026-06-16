"use client";

import type { Map as MapLibreMap, StyleSpecification } from "maplibre-gl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DatasetSourceId } from "@/lib/dataset-sources";
import * as mapCore from "@/lib/map-shell-core";
import type { EmergencyRouteResult } from "./emergency-routing-panel";
import styles from "./map-shell.module.css";
import { useInitializeMap, useMapStyleSync } from "./map-shell-map-effects";
import { MapShellView } from "./map-shell-view";

const popupClassNames: mapCore.PopupClassNames = {
  popup: styles.popup,
  popupActions: styles.popupActions,
  popupDetails: styles.popupDetails,
  popupHeader: styles.popupHeader,
  popupRow: styles.popupRow,
};

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

export function MapShell({
  dictionary,
  initialProvider,
  mapSettings,
  vworldApiKey,
}: mapCore.MapShellProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const providerMenuRef = useRef<HTMLDivElement>(null);
  const mobileProviderMenuRef = useRef<HTMLDivElement>(null);
  const sourceMenuRef = useRef<HTMLDivElement>(null);
  const sourceSearchInputRef = useRef<HTMLInputElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const popupRef = useRef<import("maplibre-gl").Popup | null>(null);
  const pointsRef = useRef<mapCore.EmergencyPointMarker[]>([]);
  const hazardsRef = useRef<mapCore.HazardEvent[]>([]);
  const seoulAreasRef = useRef<mapCore.SeoulAreasData | null>(null);
  const emergencyRouteRef = useRef<EmergencyRouteResult | null>(null);
  const isThreeDimensionalRef = useRef(false);
  const pointRequestRef = useRef<{
    controller: AbortController;
    id: number;
  } | null>(null);
  const sourceLabelsRef = useRef<Map<DatasetSourceId, string>>(new Map());
  const knownHazardIdsRef = useRef<Set<string>>(new Set());
  const initialStyleRef = useRef<StyleSpecification>(
    mapCore.createMapStyle(initialProvider, vworldApiKey, mapSettings, {
      includeThreeDimensionalBuildings: true,
    }),
  );
  const [provider, setProvider] =
    useState<mapCore.MapProvider>(initialProvider);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSourceMenuOpen, setIsSourceMenuOpen] = useState(false);
  const [points, setPoints] = useState<mapCore.EmergencyPointMarker[]>([]);
  const [datasets, setDatasets] = useState<mapCore.DatasetStatus[]>([]);
  const [hazards, setHazards] = useState<mapCore.HazardEvent[]>([]);
  const [seoulAreas, setSeoulAreas] = useState<mapCore.SeoulAreasData | null>(
    null,
  );
  const [activeHazard, setActiveHazard] = useState<mapCore.HazardEvent | null>(
    null,
  );
  const [isEmergencyPanelOpen, setIsEmergencyPanelOpen] = useState(false);
  const [emergencyOrigin, setEmergencyOrigin] = useState({
    latitude: mapCore.SEOUL_CENTER[0],
    longitude: mapCore.SEOUL_CENTER[1],
  });
  const [emergencyRoute, setEmergencyRoute] =
    useState<EmergencyRouteResult | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isMapReady, setIsMapReady] = useState(false);
  const [isThreeDimensional, setIsThreeDimensional] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [autoFocusHazards, setAutoFocusHazards] = useState(true);
  const [sourceQuery, setSourceQuery] = useState("");
  const [visibleSources, setVisibleSources] = useState<
    Partial<Record<DatasetSourceId, boolean>>
  >({});

  const activeProvider = provider;
  const selectedProviderLabel =
    dictionary.map.providers[mapCore.PROVIDERS[provider].labelKey];
  const visiblePoints = useMemo(
    () =>
      points.filter((point) =>
        mapCore.isSourceVisible(visibleSources, point.source),
      ),
    [points, visibleSources],
  );
  const mappedPointCount = visiblePoints.filter(mapCore.isMappedPoint).length;
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
    mapCore.isSourceVisible(visibleSources, dataset.id),
  ).length;
  const activeHazardImageUrl = mapCore.safeKmaImageUrl(
    activeHazard?.imageUrl ?? null,
  );
  const selectedDimensionLabel = isThreeDimensional
    ? dictionary.map.dimensions.threeDimensional
    : dictionary.map.dimensions.twoDimensional;

  function openSourceSearch() {
    setIsSourceMenuOpen(true);
    window.setTimeout(() => sourceSearchInputRef.current?.focus(), 0);
  }

  const refreshData = useCallback(async () => {
    const [datasetsResponse, hazardsResponse, seoulResponse] =
      await Promise.all([
        fetch("/api/datasets", { cache: "no-store" }),
        fetch("/api/hazards", { cache: "no-store" }),
        fetch("/data/seoul-citydata-areas.geojson", { cache: "no-store" }),
      ]);

    if (!(datasetsResponse.ok && hazardsResponse.ok && seoulResponse.ok)) {
      throw new Error("Failed to load map data");
    }

    const datasetsPayload =
      (await datasetsResponse.json()) as mapCore.DatasetsResponse;
    const hazardsPayload =
      (await hazardsResponse.json()) as mapCore.HazardsResponse;
    const seoulPayload = (await seoulResponse.json()) as mapCore.SeoulAreasData;

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
      .filter((dataset) => mapCore.isSourceVisible(visibleSources, dataset.id))
      .map((dataset) => dataset.id);

    pointRequestRef.current?.controller.abort();

    if (selectedSources.length === 0) {
      pointRequestRef.current = null;
      setPoints([]);
      return;
    }

    const controller = new AbortController();
    const requestId = (pointRequestRef.current?.id ?? 0) + 1;
    pointRequestRef.current = { controller, id: requestId };

    const viewport = mapCore.getViewportFromMap(map);
    const responses = await Promise.all(
      selectedSources.map((source) =>
        fetch(mapCore.buildPointsUrl(source, viewport), {
          cache: "no-store",
          signal: controller.signal,
        }),
      ),
    );

    if (
      pointRequestRef.current?.id !== requestId ||
      controller.signal.aborted
    ) {
      return;
    }

    if (responses.some((response) => !response.ok)) {
      throw new Error("Failed to load viewport points");
    }

    const payloads = (await Promise.all(
      responses.map((response) => response.json()),
    )) as mapCore.PointsResponse[];

    if (
      pointRequestRef.current?.id !== requestId ||
      controller.signal.aborted
    ) {
      return;
    }

    setPoints(payloads.flatMap((payload) => payload.points));
    setDataError(null);
  }, [datasets, visibleSources]);

  const focusHazard = useCallback((event: mapCore.HazardEvent) => {
    setActiveHazard(event);

    if (
      !mapCore.isDomesticHazardEvent(event) ||
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

    const payload = (await response.json()) as mapCore.HazardsResponse;
    const previousIds = knownHazardIdsRef.current;
    const nextIds = new Set(payload.events.map((event) => event.eventId));
    const newEvent = payload.events.find(
      (event) =>
        !previousIds.has(event.eventId) && mapCore.isDomesticHazardEvent(event),
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
    const storedValue = window.localStorage.getItem(
      mapCore.HAZARD_AUTO_FOCUS_KEY,
    );

    if (storedValue !== null) {
      setAutoFocusHazards(storedValue === "true");
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      mapCore.HAZARD_AUTO_FOCUS_KEY,
      String(autoFocusHazards),
    );
  }, [autoFocusHazards]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      refreshHazards().catch(() => undefined);
    }, mapCore.HAZARD_POLL_INTERVAL_MS);

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
          current[dataset.id] ?? dataset.id === mapCore.DEFAULT_VISIBLE_SOURCE;
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
          if (isAbortError(error)) {
            return;
          }

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

    mapCore.syncHazardLayerWhenReady(mapRef.current, hazards);
  }, [hazards]);

  useEffect(() => {
    seoulAreasRef.current = seoulAreas;

    if (!mapRef.current) {
      return;
    }

    mapCore.syncSeoulAreaLayerWhenReady(mapRef.current, seoulAreas, dictionary);
  }, [dictionary, seoulAreas]);

  useEffect(() => {
    pointsRef.current = visiblePoints;

    if (!mapRef.current) {
      return;
    }

    mapCore.syncPointLayerWhenReady(mapRef.current, visiblePoints);
  }, [visiblePoints]);

  useEffect(() => {
    emergencyRouteRef.current = emergencyRoute;

    if (!mapRef.current) {
      return;
    }

    mapCore.syncEmergencyRouteLayerWhenReady(mapRef.current, emergencyRoute);

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

  useInitializeMap({
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
  });

  useEffect(() => {
    isThreeDimensionalRef.current = isThreeDimensional;

    if (!(mapRef.current && isMapReady)) {
      return;
    }

    mapCore.syncThreeDimensionalView(mapRef.current, isThreeDimensional);
  }, [isMapReady, isThreeDimensional]);

  useMapStyleSync({
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
  });

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
    <MapShellView
      activeHazard={activeHazard}
      activeHazardImageUrl={activeHazardImageUrl}
      autoFocusHazards={autoFocusHazards}
      dataError={dataError}
      datasets={datasets}
      dictionary={dictionary}
      emergencyOrigin={emergencyOrigin}
      filteredDatasets={filteredDatasets}
      hazardsCount={hazards.length}
      isEmergencyPanelOpen={isEmergencyPanelOpen}
      isLoadingData={isLoadingData}
      isMenuOpen={isMenuOpen}
      isSourceMenuOpen={isSourceMenuOpen}
      isThreeDimensional={isThreeDimensional}
      latestFetchedAt={latestFetchedAt}
      mappedPointCount={mappedPointCount}
      mapContainerRef={mapContainerRef}
      mobileProviderMenuRef={mobileProviderMenuRef}
      onOpenEmergencyPanel={openEmergencyPanel}
      onOpenSourceSearch={openSourceSearch}
      provider={provider}
      providerMenuRef={providerMenuRef}
      selectedDatasetCount={selectedDatasetCount}
      selectedDimensionLabel={selectedDimensionLabel}
      selectedProviderLabel={selectedProviderLabel}
      setActiveHazard={setActiveHazard}
      setAutoFocusHazards={setAutoFocusHazards}
      setEmergencyRoute={setEmergencyRoute}
      setIsEmergencyPanelOpen={setIsEmergencyPanelOpen}
      setIsMenuOpen={setIsMenuOpen}
      setIsSourceMenuOpen={setIsSourceMenuOpen}
      setIsThreeDimensional={setIsThreeDimensional}
      setProvider={setProvider}
      setSourceQuery={setSourceQuery}
      setVisibleSources={setVisibleSources}
      sourceMenuRef={sourceMenuRef}
      sourcePointCounts={sourcePointCounts}
      sourceQuery={sourceQuery}
      sourceSearchInputRef={sourceSearchInputRef}
      visibleSources={visibleSources}
    />
  );
}
