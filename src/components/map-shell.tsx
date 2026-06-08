"use client";

import type { Map as LeafletMap, TileLayer } from "leaflet";
import { Globe2, Home, Layers } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { AppDictionary } from "@/lib/i18n";
import styles from "./map-shell.module.css";

type MapProvider = "vworld" | "osm";

type MapShellProps = {
  dictionary: AppDictionary;
  initialProvider: MapProvider;
  vworldApiKey: string;
};

type LeafletModule = typeof import("leaflet");

const SEOUL_CENTER: [number, number] = [37.5665, 126.978];
const DEFAULT_ZOOM = 12;
const TILE_SIZE = 256;
const MAX_ZOOM = 19;

const PROVIDERS: Record<
  MapProvider,
  {
    attribution: string;
    icon: typeof Layers;
    labelKey: keyof AppDictionary["map"]["providers"];
    url: (vworldApiKey: string) => string;
  }
> = {
  vworld: {
    attribution: "VWorld",
    icon: Layers,
    labelKey: "vworld",
    url: (vworldApiKey) =>
      `https://api.vworld.kr/req/wmts/1.0.0/${encodeURIComponent(
        vworldApiKey,
      )}/Base/{z}/{y}/{x}.png`,
  },
  osm: {
    attribution: "&copy; OpenStreetMap contributors",
    icon: Globe2,
    labelKey: "osm",
    url: () => "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  },
};

export function MapShell({
  dictionary,
  initialProvider,
  vworldApiKey,
}: MapShellProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const tileLayerRef = useRef<TileLayer | null>(null);
  const [leaflet, setLeaflet] = useState<LeafletModule | null>(null);
  const [provider, setProvider] = useState<MapProvider>(initialProvider);

  const isVworldReady = vworldApiKey.trim().length > 0;
  const activeProvider =
    provider === "vworld" && !isVworldReady ? "osm" : provider;
  const activeProviderConfig = PROVIDERS[activeProvider];

  useEffect(() => {
    let isDisposed = false;

    async function initializeMap() {
      if (!mapContainerRef.current || mapRef.current) {
        return;
      }

      const leafletModule = await import("leaflet");

      if (isDisposed || !mapContainerRef.current || mapRef.current) {
        return;
      }

      mapRef.current = leafletModule.map(mapContainerRef.current, {
        center: SEOUL_CENTER,
        zoom: DEFAULT_ZOOM,
        zoomControl: false,
      });

      leafletModule.control
        .zoom({
          position: "topright",
        })
        .addTo(mapRef.current);

      setLeaflet(leafletModule);
    }

    initializeMap();

    return () => {
      isDisposed = true;
      mapRef.current?.remove();
      mapRef.current = null;
      tileLayerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!leaflet || !mapRef.current) {
      return;
    }

    tileLayerRef.current?.remove();
    tileLayerRef.current = leaflet
      .tileLayer(activeProviderConfig.url(vworldApiKey), {
        attribution: activeProviderConfig.attribution,
        maxZoom: MAX_ZOOM,
        tileSize: TILE_SIZE,
      })
      .addTo(mapRef.current);
    mapRef.current.invalidateSize();
  }, [activeProviderConfig, leaflet, vworldApiKey]);

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

        <fieldset className={styles.providerActions}>
          <legend className={styles.providerLegend}>
            {dictionary.map.providerLegend}
          </legend>
          {(Object.keys(PROVIDERS) as MapProvider[]).map((providerKey) => {
            const providerConfig = PROVIDERS[providerKey];
            const Icon = providerConfig.icon;
            const providerLabel =
              dictionary.map.providers[providerConfig.labelKey];

            return (
              <button
                aria-label={dictionary.map.providerButtonLabel.replace(
                  "{provider}",
                  providerLabel,
                )}
                aria-pressed={provider === providerKey}
                className={styles.providerButton}
                data-active={provider === providerKey}
                key={providerKey}
                onClick={() => setProvider(providerKey)}
                title={providerLabel}
                type="button"
              >
                <Icon aria-hidden="true" size={18} strokeWidth={2.5} />
              </button>
            );
          })}
        </fieldset>
      </nav>

      <main className={styles.main}>
        <div
          aria-label={dictionary.map.ariaLabel}
          className={styles.map}
          ref={mapContainerRef}
          role="application"
        />
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
