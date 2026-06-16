"use client";

import { Ambulance, Box } from "lucide-react";
import type {
  MapGeoJSONFeature,
  MapLayerMouseEvent,
  Map as MapLibreMap,
  StyleSpecification,
} from "maplibre-gl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DatasetSourceId } from "@/lib/dataset-sources";
import { uiText } from "@/lib/i18n";
import * as mapCore from "@/lib/map-shell-core";
import {
  type EmergencyRouteResult,
  EmergencyRoutingPanel,
} from "./emergency-routing-panel";
import styles from "./map-shell.module.css";
import {
  DatasetPanel,
  HazardModal,
  MapNavbar,
  MobileMapTools,
  MobileNav,
  SourceMenu,
} from "./map-shell-controls";

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
    const response = await fetch(
      mapCore.buildPointsUrl(selectedSources, viewport),
      {
        cache: "no-store",
        signal: controller.signal,
      },
    );

    if (
      pointRequestRef.current?.id !== requestId ||
      controller.signal.aborted
    ) {
      return;
    }

    if (!response.ok) {
      throw new Error("Failed to load viewport points");
    }

    const payload = (await response.json()) as mapCore.PointsResponse;

    if (
      pointRequestRef.current?.id !== requestId ||
      controller.signal.aborted
    ) {
      return;
    }

    setPoints(payload.points);
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
        bearing: isThreeDimensionalRef.current
          ? mapCore.THREE_DIMENSIONAL_BEARING
          : 0,
        canvasContextAttributes: {
          antialias: true,
        },
        center: mapCore.MAP_CENTER,
        container: mapContainerRef.current,
        pitch: isThreeDimensionalRef.current
          ? mapCore.THREE_DIMENSIONAL_PITCH
          : 0,
        style: initialStyleRef.current,
        zoom: mapCore.DEFAULT_ZOOM,
      });

      mapRef.current = map;

      map.addControl(
        new maplibre.NavigationControl({
          showCompass: true,
        }),
        "top-right",
      );

      async function showPointPopup(feature: MapGeoJSONFeature) {
        if (!feature?.properties) {
          return;
        }

        const point = feature.properties as mapCore.PointFeatureProperties;
        const coordinates: [number, number] = [
          Number(point.longitude),
          Number(point.latitude),
        ];

        if (
          !(Number.isFinite(coordinates[0]) && Number.isFinite(coordinates[1]))
        ) {
          return;
        }

        const response = await fetch(`/api/points/${point.id}`, {
          cache: "no-store",
        });

        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as mapCore.PointDetailResponse;
        popupRef.current?.remove();
        popupRef.current = new maplibre.Popup({
          closeButton: true,
          maxWidth: "320px",
          offset: 16,
        })
          .setLngLat(coordinates)
          .setHTML(
            mapCore.buildPopupHtml(
              payload.point,
              dictionary,
              sourceLabelsRef.current.get(payload.point.source) ??
                payload.point.source,
              popupClassNames,
            ),
          )
          .addTo(map);
      }

      async function showSeoulPopulationPopup(feature: MapGeoJSONFeature) {
        if (!feature?.properties) {
          return;
        }

        const area = feature.properties as mapCore.SeoulAreaProperties;
        const point = feature.properties as mapCore.SeoulAreaPointProperties;
        const coordinates: [number, number] = [
          Number(point.longitude),
          Number(point.latitude),
        ];

        if (
          !(Number.isFinite(coordinates[0]) && Number.isFinite(coordinates[1]))
        ) {
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
          setSeoulAreas((current) =>
            current
              ? mapCore.updateSeoulAreaPopulation(current, population)
              : current,
          );
        }

        popupRef.current?.remove();
        popupRef.current = new maplibre.Popup({
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
                    uiText(dictionary, "실시간 인구 조회 실패")),
              dictionary,
              popupClassNames,
            ),
          )
          .addTo(map);
      }

      map.on("click", async (event: MapLayerMouseEvent) => {
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
          await showPointPopup(feature);
          return;
        }

        if (
          feature.layer.id === mapCore.SEOUL_AREAS_HALO_LAYER_ID ||
          feature.layer.id === mapCore.SEOUL_AREAS_LAYER_ID ||
          feature.layer.id === mapCore.SEOUL_AREAS_SYMBOL_LAYER_ID
        ) {
          await showSeoulPopulationPopup(feature);
          return;
        }

        const eventId = String(
          (feature.properties as mapCore.HazardFeatureProperties).eventId,
        );
        const hazard = hazardsRef.current.find(
          (current) => current.eventId === eventId,
        );

        if (hazard) {
          focusHazard(hazard);
        }
      });

      map.on("mouseenter", mapCore.POINTS_LAYER_ID, () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", mapCore.POINTS_LAYER_ID, () => {
        map.getCanvas().style.cursor = "";
      });
      map.on("mouseenter", mapCore.POINTS_SYMBOL_LAYER_ID, () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", mapCore.POINTS_SYMBOL_LAYER_ID, () => {
        map.getCanvas().style.cursor = "";
      });
      map.on("mouseenter", mapCore.SEOUL_AREAS_HALO_LAYER_ID, () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", mapCore.SEOUL_AREAS_HALO_LAYER_ID, () => {
        map.getCanvas().style.cursor = "";
      });
      map.on("mouseenter", mapCore.SEOUL_AREAS_LAYER_ID, () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", mapCore.SEOUL_AREAS_LAYER_ID, () => {
        map.getCanvas().style.cursor = "";
      });
      map.on("mouseenter", mapCore.SEOUL_AREAS_SYMBOL_LAYER_ID, () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", mapCore.SEOUL_AREAS_SYMBOL_LAYER_ID, () => {
        map.getCanvas().style.cursor = "";
      });
      map.on("mouseenter", mapCore.HAZARDS_LAYER_ID, () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", mapCore.HAZARDS_LAYER_ID, () => {
        map.getCanvas().style.cursor = "";
      });

      map.once("load", () => {
        setIsMapReady(true);
        mapCore.syncSeoulAreaLayerWhenReady(
          map,
          seoulAreasRef.current,
          dictionary,
        );
        mapCore.syncPointLayerWhenReady(map, pointsRef.current);
        mapCore.syncHazardLayerWhenReady(map, hazardsRef.current);
        mapCore.syncEmergencyRouteLayerWhenReady(
          map,
          emergencyRouteRef.current,
        );
      });
    }

    void initializeMap();

    return () => {
      isDisposed = true;
      pointRequestRef.current?.controller.abort();
      popupRef.current?.remove();
      mapRef.current?.remove();
      mapRef.current = null;
      setIsMapReady(false);
    };
  }, [dictionary, focusHazard]);

  useEffect(() => {
    isThreeDimensionalRef.current = isThreeDimensional;

    if (!(mapRef.current && isMapReady)) {
      return;
    }

    mapCore.syncThreeDimensionalView(mapRef.current, isThreeDimensional);
  }, [isMapReady, isThreeDimensional]);

  useEffect(() => {
    if (!mapRef.current) {
      return;
    }

    const map = mapRef.current;
    let isDisposed = false;
    let timeoutId: number | undefined;

    async function updateStyle() {
      const style = mapCore.createMapStyle(
        activeProvider,
        vworldApiKey,
        mapSettings,
        {
          includeThreeDimensionalBuildings: true,
          threeDimensionalVisible: isThreeDimensionalRef.current,
        },
      );
      const syncOverlays = () => {
        map.resize();
        mapCore.syncSeoulAreaLayerWhenReady(
          map,
          seoulAreasRef.current,
          dictionary,
        );
        mapCore.syncPointLayerWhenReady(map, pointsRef.current);
        mapCore.syncHazardLayerWhenReady(map, hazardsRef.current);
        mapCore.syncEmergencyRouteLayerWhenReady(
          map,
          emergencyRouteRef.current,
        );
        mapCore.syncThreeDimensionalView(map, isThreeDimensionalRef.current, {
          animate: false,
        });
      };

      if (isDisposed) {
        return;
      }

      map.setStyle(style);

      timeoutId = window.setTimeout(() => {
        syncOverlays();
      }, mapCore.STYLE_LOAD_TIMEOUT_MS);

      map.once("style.load", () => {
        if (timeoutId) {
          window.clearTimeout(timeoutId);
        }
        syncOverlays();
      });
    }

    void updateStyle();

    return () => {
      isDisposed = true;
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [activeProvider, dictionary, mapSettings, vworldApiKey]);

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
      <MapNavbar
        dictionary={dictionary}
        isMenuOpen={isMenuOpen}
        onOpenSourceSearch={openSourceSearch}
        provider={provider}
        providerMenuRef={providerMenuRef}
        selectedProviderLabel={selectedProviderLabel}
        setIsMenuOpen={setIsMenuOpen}
        setProvider={setProvider}
      />
      <main className={styles.main}>
        <div
          aria-label={dictionary.map.ariaLabel}
          className={styles.map}
          ref={mapContainerRef}
          role="application"
        />
        <button
          aria-label={dictionary.map.dimensionButtonLabel.replace(
            "{dimension}",
            selectedDimensionLabel,
          )}
          aria-pressed={isThreeDimensional}
          className={
            isThreeDimensional
              ? styles.dimensionButtonActive
              : styles.dimensionButton
          }
          onClick={() => setIsThreeDimensional((current) => !current)}
          title={selectedDimensionLabel}
          type="button"
        >
          <Box aria-hidden="true" size={15} strokeWidth={2.5} />
          <span>{selectedDimensionLabel}</span>
        </button>
        <button
          className={styles.emergencyLauncher}
          onClick={openEmergencyPanel}
          type="button"
        >
          <Ambulance aria-hidden="true" size={18} strokeWidth={2.5} />
          <span>{uiText(dictionary, "응급 출동·이송")}</span>
        </button>
        {isEmergencyPanelOpen ? (
          <EmergencyRoutingPanel
            dictionary={dictionary}
            onClose={() => setIsEmergencyPanelOpen(false)}
            onRoute={setEmergencyRoute}
            origin={emergencyOrigin}
          />
        ) : null}
        <SourceMenu
          autoFocusHazards={autoFocusHazards}
          datasetsLength={datasets.length}
          dictionary={dictionary}
          filteredDatasets={filteredDatasets}
          isOpen={isSourceMenuOpen}
          selectedDatasetCount={selectedDatasetCount}
          setAutoFocusHazards={setAutoFocusHazards}
          setIsOpen={setIsSourceMenuOpen}
          setSourceQuery={setSourceQuery}
          setVisibleSources={setVisibleSources}
          sourceMenuRef={sourceMenuRef}
          sourcePointCounts={sourcePointCounts}
          sourceQuery={sourceQuery}
          sourceSearchInputRef={sourceSearchInputRef}
          visibleSources={visibleSources}
        />
        <MobileMapTools
          dictionary={dictionary}
          isMenuOpen={isMenuOpen}
          mobileProviderMenuRef={mobileProviderMenuRef}
          provider={provider}
          selectedProviderLabel={selectedProviderLabel}
          setIsMenuOpen={setIsMenuOpen}
          setProvider={setProvider}
        />
        <DatasetPanel
          dataError={dataError}
          dictionary={dictionary}
          hazardsCount={hazards.length}
          isLoadingData={isLoadingData}
          latestFetchedAt={latestFetchedAt}
          mappedPointCount={mappedPointCount}
        />
        {activeHazard ? (
          <HazardModal
            activeHazard={activeHazard}
            activeHazardImageUrl={activeHazardImageUrl}
            dictionary={dictionary}
            onClose={() => setActiveHazard(null)}
          />
        ) : null}
      </main>
      <MobileNav
        dictionary={dictionary}
        onOpenSourceSearch={openSourceSearch}
      />
    </div>
  );
}
