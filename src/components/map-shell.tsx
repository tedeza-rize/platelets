"use client";

import {
  Check,
  ChevronDown,
  Database,
  Globe2,
  Home,
  Layers,
  ListFilter,
  MapPin,
} from "lucide-react";
import type {
  GeoJSONSource,
  MapGeoJSONFeature,
  MapLayerMouseEvent,
  Map as MapLibreMap,
  StyleSpecification,
} from "maplibre-gl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DatasetSourceId } from "@/lib/dataset-sources";
import type { AppDictionary } from "@/lib/i18n";
import styles from "./map-shell.module.css";

type MapProvider = "vworld" | "osm";

type MapShellProps = {
  dictionary: AppDictionary;
  initialProvider: MapProvider;
  vworldApiKey: string;
};

type EmergencyPoint = {
  address: string;
  category: string;
  fetchedAt: string | null;
  id: number;
  latitude: number | null;
  longitude: number | null;
  name: string;
  parentName: string | null;
  phone: string | null;
  source: DatasetSourceId;
  sourceRecordId: string;
  sourceUpdatedAt: string | null;
};

type MappedEmergencyPoint = EmergencyPoint & {
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
  points: EmergencyPoint[];
};

type DatasetsResponse = {
  datasets: DatasetStatus[];
};

const SEOUL_CENTER: [number, number] = [37.5665, 126.978];
const MAP_CENTER: [number, number] = [SEOUL_CENTER[1], SEOUL_CENTER[0]];
const DEFAULT_ZOOM = 16;
const STYLE_LOAD_TIMEOUT_MS = 8000;
const OSM_TILE_SIZE = 256;
const OSM_MAX_ZOOM = 19;
const VWORLD_TILE_SIZE = 256;
const VWORLD_MAX_ZOOM = 19;
const POINTS_SOURCE_ID = "emergency-points";
const POINTS_HALO_LAYER_ID = "emergency-points-halo";
const POINTS_LAYER_ID = "emergency-points-circle";
const SOURCE_COLORS: Record<DatasetSourceId, string> = {
  aeds: "#059669",
  "fire-stations": "#dc2626",
  "police-stations": "#1d4ed8",
};
const SOURCE_HALO_COLORS: Record<DatasetSourceId, string> = {
  aeds: "#10b981",
  "fire-stations": "#f97316",
  "police-stations": "#2563eb",
};

type PointFeatureProperties = {
  address: string;
  category: string;
  fetchedAt: string;
  id: number;
  latitude: number;
  longitude: number;
  name: string;
  parentName: string;
  phone: string;
  source: DatasetSourceId;
  sourceRecordId: string;
  sourceUpdatedAt: string;
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

function createVworldStyle(vworldApiKey: string): StyleSpecification {
  return {
    glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
    layers: [
      {
        id: "vworld-base",
        source: "vworld-base",
        type: "raster",
      },
    ],
    sources: {
      "vworld-base": {
        attribution: "VWorld",
        maxzoom: VWORLD_MAX_ZOOM,
        tileSize: VWORLD_TILE_SIZE,
        tiles: [
          `https://api.vworld.kr/req/wmts/1.0.0/${encodeURIComponent(
            vworldApiKey,
          )}/Base/{z}/{y}/{x}.png`,
        ],
        type: "raster",
      },
    },
    version: 8,
  };
}

function createOsmStyle(): StyleSpecification {
  return {
    glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
    layers: [
      {
        id: "osm-base",
        source: "osm-base",
        type: "raster",
      },
    ],
    sources: {
      "osm-base": {
        attribution: "OpenStreetMap contributors",
        maxzoom: OSM_MAX_ZOOM,
        tileSize: OSM_TILE_SIZE,
        tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
        type: "raster",
      },
    },
    version: 8,
  };
}

function isMappedPoint(point: EmergencyPoint): point is MappedEmergencyPoint {
  return point.latitude !== null && point.longitude !== null;
}

function createPointData(points: EmergencyPoint[]) {
  return {
    features: points.filter(isMappedPoint).map((point) => ({
      geometry: {
        coordinates: [point.longitude, point.latitude],
        type: "Point" as const,
      },
      properties: {
        address: point.address,
        category: point.category,
        fetchedAt: point.fetchedAt ?? "",
        id: point.id,
        latitude: point.latitude,
        longitude: point.longitude,
        name: point.name,
        parentName: point.parentName ?? "",
        phone: point.phone ?? "",
        source: point.source,
        sourceRecordId: point.sourceRecordId,
        sourceUpdatedAt: point.sourceUpdatedAt ?? "",
      } satisfies PointFeatureProperties,
      type: "Feature" as const,
    })),
    type: "FeatureCollection" as const,
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

  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function buildKakaoMapUrl(point: PointFeatureProperties) {
  return `https://map.kakao.com/link/search/${encodeURIComponent(
    point.address,
  )}`;
}

function buildNaverMapUrl(point: PointFeatureProperties) {
  return `https://map.naver.com/p/search/${encodeURIComponent(point.address)}`;
}

function buildPopupHtml(
  point: PointFeatureProperties,
  dictionary: AppDictionary,
) {
  const rows = [
    [dictionary.map.popup.address, point.address],
    [dictionary.map.popup.phone, point.phone],
    [dictionary.map.popup.sourceUpdatedAt, point.sourceUpdatedAt],
  ].filter(([, value]) => value);
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
      <span>${escapeHtml(point.category)}</span>
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

function syncPointLayer(map: MapLibreMap, points: EmergencyPoint[]) {
  if (!map.isStyleLoaded()) {
    return;
  }

  const pointData = createPointData(points);
  const source = map.getSource(POINTS_SOURCE_ID) as GeoJSONSource | undefined;

  if (source) {
    source.setData(pointData);
    return;
  }

  map.addSource(POINTS_SOURCE_ID, {
    data: pointData,
    type: "geojson",
  });
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
        "#6b7280",
      ],
      "circle-opacity": 0.2,
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 6, 8, 12, 20],
    },
    source: POINTS_SOURCE_ID,
    type: "circle",
  });
  map.addLayer({
    id: POINTS_LAYER_ID,
    paint: {
      "circle-color": [
        "match",
        ["get", "source"],
        "fire-stations",
        SOURCE_COLORS["fire-stations"],
        "police-stations",
        SOURCE_COLORS["police-stations"],
        "aeds",
        SOURCE_COLORS.aeds,
        "#374151",
      ],
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 6, 4, 12, 9],
      "circle-stroke-color": "#ffffff",
      "circle-stroke-width": 1.5,
    },
    source: POINTS_SOURCE_ID,
    type: "circle",
  });
}

function syncPointLayerWhenReady(map: MapLibreMap, points: EmergencyPoint[]) {
  if (map.isStyleLoaded()) {
    syncPointLayer(map, points);
    return;
  }

  map.once("idle", () => {
    syncPointLayer(map, points);
  });
}

export function MapShell({
  dictionary,
  initialProvider,
  vworldApiKey,
}: MapShellProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const providerMenuRef = useRef<HTMLDivElement>(null);
  const sourceMenuRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const popupRef = useRef<import("maplibre-gl").Popup | null>(null);
  const pointsRef = useRef<EmergencyPoint[]>([]);
  const initialStyleRef = useRef<StyleSpecification | string>(
    initialProvider === "vworld" && vworldApiKey.trim().length > 0
      ? createVworldStyle(vworldApiKey)
      : createOsmStyle(),
  );
  const [provider, setProvider] = useState<MapProvider>(initialProvider);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSourceMenuOpen, setIsSourceMenuOpen] = useState(false);
  const [points, setPoints] = useState<EmergencyPoint[]>([]);
  const [datasets, setDatasets] = useState<DatasetStatus[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);
  const [visibleSources, setVisibleSources] = useState<
    Partial<Record<DatasetSourceId, boolean>>
  >({});

  const isVworldReady = vworldApiKey.trim().length > 0;
  const activeProvider =
    provider === "vworld" && !isVworldReady ? "osm" : provider;
  const selectedProviderConfig = PROVIDERS[provider];
  const SelectedProviderIcon = selectedProviderConfig.icon;
  const selectedProviderLabel =
    dictionary.map.providers[selectedProviderConfig.labelKey];
  const visiblePoints = useMemo(
    () => points.filter((point) => visibleSources[point.source] ?? true),
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
  const selectedDatasetCount = datasets.filter(
    (dataset) => visibleSources[dataset.id] ?? true,
  ).length;

  const refreshData = useCallback(async () => {
    const [pointsResponse, datasetsResponse] = await Promise.all([
      fetch("/api/points", { cache: "no-store" }),
      fetch("/api/datasets", { cache: "no-store" }),
    ]);

    if (!pointsResponse.ok || !datasetsResponse.ok) {
      throw new Error("Failed to load map data");
    }

    const pointsPayload = (await pointsResponse.json()) as PointsResponse;
    const datasetsPayload = (await datasetsResponse.json()) as DatasetsResponse;

    setPoints(pointsPayload.points);
    setDatasets(datasetsPayload.datasets);
  }, []);

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
    if (datasets.length === 0) {
      return;
    }

    setVisibleSources((current) => {
      const next: Partial<Record<DatasetSourceId, boolean>> = {};

      for (const dataset of datasets) {
        next[dataset.id] = current[dataset.id] ?? true;
      }

      return next;
    });
  }, [datasets]);

  useEffect(() => {
    pointsRef.current = visiblePoints;

    if (!mapRef.current) {
      return;
    }

    syncPointLayerWhenReady(mapRef.current, visiblePoints);
  }, [visiblePoints]);

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

      map.on("click", POINTS_LAYER_ID, (event: MapLayerMouseEvent) => {
        const feature = event.features?.[0] as MapGeoJSONFeature | undefined;
        const coordinates = (
          feature?.geometry.type === "Point"
            ? feature.geometry.coordinates
            : null
        ) as [number, number] | null;

        if (!feature?.properties || !coordinates) {
          return;
        }

        const point = feature.properties as PointFeatureProperties;
        popupRef.current?.remove();
        popupRef.current = new maplibre.Popup({
          closeButton: true,
          maxWidth: "320px",
          offset: 16,
        })
          .setLngLat(coordinates)
          .setHTML(buildPopupHtml(point, dictionary))
          .addTo(map);
      });

      map.on("mouseenter", POINTS_LAYER_ID, () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", POINTS_LAYER_ID, () => {
        map.getCanvas().style.cursor = "";
      });

      map.once("load", () => {
        syncPointLayerWhenReady(map, pointsRef.current);
      });
    }

    initializeMap();

    return () => {
      isDisposed = true;
      popupRef.current?.remove();
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [dictionary]);

  useEffect(() => {
    if (!mapRef.current) {
      return;
    }

    const map = mapRef.current;
    let isDisposed = false;
    let timeoutId: number | undefined;

    async function updateStyle() {
      let style: StyleSpecification;

      if (activeProvider === "vworld") {
        style = createVworldStyle(vworldApiKey);
      } else {
        style = createOsmStyle();
      }

      if (isDisposed) {
        return;
      }

      map.setStyle(style);

      timeoutId = window.setTimeout(() => {
        map.resize();
        syncPointLayerWhenReady(map, pointsRef.current);
      }, STYLE_LOAD_TIMEOUT_MS);

      map.once("styledata", () => {
        if (timeoutId) {
          window.clearTimeout(timeoutId);
        }
        map.resize();
        syncPointLayerWhenReady(map, pointsRef.current);
      });
    }

    updateStyle();

    return () => {
      isDisposed = true;
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [activeProvider, vworldApiKey]);

  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }

    function closeMenu(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        providerMenuRef.current?.contains(event.target)
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

  return (
    <div className={styles.page}>
      <nav className={styles.navbar} aria-label={dictionary.navigation.label}>
        <a
          aria-label={dictionary.navigation.homeLabel}
          className={styles.homeLink}
          href="/"
          title={dictionary.navigation.homeLabel}
        >
          <Home aria-hidden="true" size={22} strokeWidth={2.6} />
        </a>

        <h1 className={styles.navTitle}>{dictionary.navigation.title}</h1>

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
          {isMenuOpen ? (
            <div className={styles.providerDropdown} role="menu">
              {(Object.keys(PROVIDERS) as MapProvider[]).map((providerKey) => {
                const providerConfig = PROVIDERS[providerKey];
                const Icon = providerConfig.icon;
                const providerLabel =
                  dictionary.map.providers[providerConfig.labelKey];

                return (
                  <button
                    className={styles.providerItem}
                    key={providerKey}
                    onClick={() => {
                      setProvider(providerKey);
                      setIsMenuOpen(false);
                    }}
                    aria-checked={provider === providerKey}
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
          ) : null}
        </div>
      </nav>

      <main className={styles.main}>
        <div
          aria-label={dictionary.map.ariaLabel}
          className={styles.map}
          ref={mapContainerRef}
          role="application"
        />
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
            <fieldset
              aria-label={dictionary.map.datasets.sourceMenuTitle}
              className={styles.sourceDropdown}
            >
              <legend>{dictionary.map.datasets.sourceMenuTitle}</legend>
              <div className={styles.sourceList}>
                {datasets.map((dataset) => (
                  <label className={styles.sourceItem} key={dataset.id}>
                    <input
                      checked={visibleSources[dataset.id] ?? true}
                      onChange={() =>
                        setVisibleSources((current) => ({
                          ...current,
                          [dataset.id]: !(current[dataset.id] ?? true),
                        }))
                      }
                      type="checkbox"
                    />
                    <span>{dataset.label}</span>
                    <small>
                      {(sourcePointCounts.get(dataset.id) ?? 0).toLocaleString(
                        "ko-KR",
                      )}
                    </small>
                  </label>
                ))}
              </div>
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
          </div>

          {isLoadingData || dataError ? (
            <output className={styles.dataNotice}>
              {dataError ?? dictionary.map.datasets.loading}
            </output>
          ) : null}
        </section>
        {provider === "vworld" && !isVworldReady ? (
          <output className={styles.notice}>
            <strong>{dictionary.map.missingKeyTitle}</strong>
            <span>{dictionary.map.missingKeyBody}</span>
          </output>
        ) : null}
      </main>
    </div>
  );
}
