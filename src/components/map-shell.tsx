"use client";

import { Check, ChevronDown, Globe2, Home, Layers } from "lucide-react";
import type { StyleSpecification } from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import type { AppDictionary } from "@/lib/i18n";
import styles from "./map-shell.module.css";

type MapProvider = "vworld" | "osm";

type MapShellProps = {
  dictionary: AppDictionary;
  initialProvider: MapProvider;
  vworldApiKey: string;
};

const SEOUL_CENTER: [number, number] = [37.5665, 126.978];
const MAP_CENTER: [number, number] = [SEOUL_CENTER[1], SEOUL_CENTER[0]];
const DEFAULT_ZOOM = 16;
const STYLE_LOAD_TIMEOUT_MS = 8000;
const VWORLD_TILE_SIZE = 256;
const VWORLD_MAX_ZOOM = 19;
const OSM_VECTOR_STYLE_URL =
  "https://vector.openstreetmap.org/demo/shortbread/colorful.json";
const OSM_VECTOR_ORIGIN = new URL(OSM_VECTOR_STYLE_URL).origin;
const EMPTY_STYLE: StyleSpecification = {
  layers: [],
  sources: {},
  version: 8,
};

type MutableStyleSource = {
  tiles?: string[];
  url?: string;
};

function toAbsoluteOsmUrl(url: string) {
  if (url.startsWith("/")) {
    return `${OSM_VECTOR_ORIGIN}${url}`;
  }

  return new URL(url, OSM_VECTOR_STYLE_URL).toString();
}

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

async function loadOsmVectorStyle(): Promise<StyleSpecification> {
  const response = await fetch(OSM_VECTOR_STYLE_URL);

  if (!response.ok) {
    throw new Error(`Failed to load OSM vector style: ${response.status}`);
  }

  const style = (await response.json()) as StyleSpecification;

  if (typeof style.sprite === "string") {
    style.sprite = toAbsoluteOsmUrl(style.sprite);
  } else if (Array.isArray(style.sprite)) {
    style.sprite = style.sprite.map((sprite) => ({
      ...sprite,
      url:
        typeof sprite.url === "string"
          ? toAbsoluteOsmUrl(sprite.url)
          : sprite.url,
    }));
  }

  if (style.glyphs) {
    style.glyphs = toAbsoluteOsmUrl(style.glyphs);
  }

  for (const source of Object.values(style.sources)) {
    const mutableSource = source as MutableStyleSource;

    if (mutableSource.url) {
      mutableSource.url = toAbsoluteOsmUrl(mutableSource.url);
    }

    if (mutableSource.tiles) {
      mutableSource.tiles = mutableSource.tiles.map((tileUrl) =>
        typeof tileUrl === "string" ? toAbsoluteOsmUrl(tileUrl) : tileUrl,
      );
    }
  }

  return style;
}

export function MapShell({
  dictionary,
  initialProvider,
  vworldApiKey,
}: MapShellProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const providerMenuRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("maplibre-gl").Map | null>(null);
  const osmStyleRef = useRef<StyleSpecification | null>(null);
  const initialStyleRef = useRef<StyleSpecification | string>(
    initialProvider === "vworld" && vworldApiKey.trim().length > 0
      ? createVworldStyle(vworldApiKey)
      : EMPTY_STYLE,
  );
  const [provider, setProvider] = useState<MapProvider>(initialProvider);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const isVworldReady = vworldApiKey.trim().length > 0;
  const activeProvider =
    provider === "vworld" && !isVworldReady ? "osm" : provider;
  const selectedProviderConfig = PROVIDERS[provider];
  const SelectedProviderIcon = selectedProviderConfig.icon;
  const selectedProviderLabel =
    dictionary.map.providers[selectedProviderConfig.labelKey];

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

      mapRef.current = new maplibre.Map({
        attributionControl: {
          compact: true,
        },
        center: MAP_CENTER,
        container: mapContainerRef.current,
        style: initialStyleRef.current,
        zoom: DEFAULT_ZOOM,
      });

      mapRef.current.addControl(
        new maplibre.NavigationControl({
          showCompass: false,
        }),
        "top-right",
      );
    }

    initializeMap();

    return () => {
      isDisposed = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

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
        if (!osmStyleRef.current) {
          osmStyleRef.current = await loadOsmVectorStyle();
        }
        style = osmStyleRef.current;
      }

      if (isDisposed) {
        return;
      }

      map.setStyle(style);

      timeoutId = window.setTimeout(() => {
        map.resize();
      }, STYLE_LOAD_TIMEOUT_MS);

      map.once("styledata", () => {
        if (timeoutId) {
          window.clearTimeout(timeoutId);
        }
        map.resize();
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
