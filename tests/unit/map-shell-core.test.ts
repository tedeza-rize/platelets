import assert from "node:assert/strict";
import test from "node:test";
import {
  BUILDING_3D_LAYER_ID,
  BUILDING_FOOTPRINT_LAYER_ID,
  createMapStyle,
  createVworldStyle,
  getViewportAroundCenter,
  isSourceVisible,
  OPENFREEMAP_SOURCE_ID,
  OSM_OFFICIAL_SOURCE_ID,
  VWORLD_3D_BUILDINGS_SOURCE_ID,
  VWORLD_BASE_SOURCE_ID,
} from "@/lib/map-shell-core";

function layer(style: ReturnType<typeof createMapStyle>, id: string) {
  return style.layers.find((current) => current.id === id);
}

test("OSM styles honor the configured vector tile source", () => {
  const openFreeMapStyle = createMapStyle(
    "osm",
    "",
    { osmTileSource: "openfreemap" },
    { threeDimensionalVisible: true },
  );
  const officialStyle = createMapStyle(
    "osm",
    "",
    { osmTileSource: "official" },
    { threeDimensionalVisible: true },
  );

  assert.equal(openFreeMapStyle.sources[OPENFREEMAP_SOURCE_ID]?.type, "vector");
  assert.equal(officialStyle.sources[OSM_OFFICIAL_SOURCE_ID]?.type, "vector");
  assert.equal(
    layer(openFreeMapStyle, BUILDING_3D_LAYER_ID)?.layout?.visibility,
    "visible",
  );
  assert.equal(
    layer(officialStyle, BUILDING_FOOTPRINT_LAYER_ID)?.layout?.visibility,
    "none",
  );
});

test("VWorld vector mode keeps the base map source as vector tiles", () => {
  const style = createVworldStyle("test-key", "vector", {
    includeThreeDimensionalBuildings: true,
  });

  assert.equal(style.sources[VWORLD_BASE_SOURCE_ID]?.type, "vector");
  assert.equal(style.sources[VWORLD_3D_BUILDINGS_SOURCE_ID]?.type, "vector");
  assert.equal(layer(style, "vworld-base-raster"), undefined);
  assert.equal(layer(style, BUILDING_3D_LAYER_ID)?.type, "fill-extrusion");
});

test("default visible map sources are limited to fire and police stations", () => {
  assert.equal(isSourceVisible({}, "fire-stations"), true);
  assert.equal(isSourceVisible({}, "police-stations"), true);
  assert.equal(isSourceVisible({}, "hospitals"), false);
});

test("target viewport can be prepared before current-location movement ends", () => {
  const viewport = getViewportAroundCenter(
    { latitude: 37.5665, longitude: 126.978 },
    16,
  );

  assert.equal(viewport.zoom, 16);
  assert.ok(viewport.minLatitude < 37.5665);
  assert.ok(viewport.maxLatitude > 37.5665);
  assert.ok(viewport.minLongitude < 126.978);
  assert.ok(viewport.maxLongitude > 126.978);
});
