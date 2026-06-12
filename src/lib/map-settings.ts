export type MapProvider = "osm" | "vworld";
export type MapTileMode = "raster" | "vector";
export type OsmTileSource = "official" | "openfreemap";

export type MapRenderingSettings = {
  mapProvider: MapProvider;
  mapTileMode: MapTileMode;
  osmTileSource: OsmTileSource;
};

export const DEFAULT_MAP_RENDERING_SETTINGS: MapRenderingSettings = {
  mapProvider: "osm",
  mapTileMode: "vector",
  osmTileSource: "openfreemap",
};

export function cleanMapProvider(value: unknown): MapProvider {
  return value === "vworld" || value === "osm"
    ? value
    : DEFAULT_MAP_RENDERING_SETTINGS.mapProvider;
}

export function cleanMapTileMode(value: unknown): MapTileMode {
  return value === "raster" || value === "vector"
    ? value
    : DEFAULT_MAP_RENDERING_SETTINGS.mapTileMode;
}

export function cleanOsmTileSource(value: unknown): OsmTileSource {
  return value === "official" || value === "openfreemap"
    ? value
    : DEFAULT_MAP_RENDERING_SETTINGS.osmTileSource;
}
