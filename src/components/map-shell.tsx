"use client";

import L, { type Map as LeafletMap, type TileLayer } from "leaflet";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { MapDictionary } from "@/lib/i18n";
import styles from "./map-shell.module.css";

type MapProvider = "vworld" | "osm";

type MapShellProps = {
  dictionary: MapDictionary;
  initialProvider: MapProvider;
  vworldApiKey: string;
};

const SEOUL_CENTER: L.LatLngExpression = [37.5665, 126.978];
const DEFAULT_ZOOM = 12;
const TILE_SIZE = 256;
const MAX_ZOOM = 19;

const PROVIDERS: Record<
  MapProvider,
  {
    attribution: string;
    labelKey: keyof MapDictionary["providers"];
    url: (vworldApiKey: string) => string;
  }
> = {
  vworld: {
    attribution: "VWorld",
    labelKey: "vworld",
    url: (vworldApiKey) =>
      `https://api.vworld.kr/req/wmts/1.0.0/${encodeURIComponent(
        vworldApiKey,
      )}/Base/{z}/{y}/{x}.png`,
  },
  osm: {
    attribution: "&copy; OpenStreetMap contributors",
    labelKey: "osm",
    url: () => "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  },
};

export function MapShell({
  dictionary,
  initialProvider,
  vworldApiKey,
}: MapShellProps) {
  const mapId = useId();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const tileLayerRef = useRef<TileLayer | null>(null);
  const [provider, setProvider] = useState<MapProvider>(initialProvider);

  const isVworldReady = vworldApiKey.trim().length > 0;
  const activeProvider =
    provider === "vworld" && !isVworldReady ? "osm" : provider;
  const selectedProvider = PROVIDERS[provider];
  const activeProviderConfig = PROVIDERS[activeProvider];

  const providerOptions = useMemo(
    () =>
      (Object.keys(PROVIDERS) as MapProvider[]).map((providerKey) => ({
        label: dictionary.providers[PROVIDERS[providerKey].labelKey],
        value: providerKey,
      })),
    [dictionary.providers],
  );

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) {
      return;
    }

    mapRef.current = L.map(mapContainerRef.current, {
      center: SEOUL_CENTER,
      zoom: DEFAULT_ZOOM,
      zoomControl: false,
    });

    L.control
      .zoom({
        position: "bottomright",
      })
      .addTo(mapRef.current);

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
      tileLayerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current) {
      return;
    }

    tileLayerRef.current?.remove();
    tileLayerRef.current = L.tileLayer(activeProviderConfig.url(vworldApiKey), {
      attribution: activeProviderConfig.attribution,
      maxZoom: MAX_ZOOM,
      tileSize: TILE_SIZE,
    }).addTo(mapRef.current);
  }, [activeProviderConfig, vworldApiKey]);

  return (
    <section className={styles.shell} aria-labelledby={`${mapId}-title`}>
      <div className={styles.toolbar}>
        <div>
          <h1 id={`${mapId}-title`} className={styles.title}>
            {dictionary.title}
          </h1>
          <p className={styles.status}>
            {dictionary.activeProvider.replace(
              "{provider}",
              dictionary.providers[selectedProvider.labelKey],
            )}
          </p>
        </div>

        <fieldset className={styles.providerGroup}>
          <legend className={styles.providerLegend}>
            {dictionary.providerLegend}
          </legend>
          {providerOptions.map((option) => (
            <label className={styles.providerOption} key={option.value}>
              <input
                checked={provider === option.value}
                name="map-provider"
                onChange={() => setProvider(option.value)}
                type="radio"
                value={option.value}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </fieldset>
      </div>

      <div className={styles.mapFrame}>
        <div
          aria-label={dictionary.ariaLabel}
          className={styles.map}
          ref={mapContainerRef}
          role="application"
        />
        {provider === "vworld" && !isVworldReady ? (
          <output className={styles.notice}>
            <strong>{dictionary.missingKeyTitle}</strong>
            <span>{dictionary.missingKeyBody}</span>
          </output>
        ) : null}
      </div>
    </section>
  );
}
