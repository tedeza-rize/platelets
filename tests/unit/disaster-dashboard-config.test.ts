import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

const dataDirectory = mkdtempSync(
  path.join(tmpdir(), "platelets-dashboard-config-"),
);
process.env.PLATELETS_DATA_DIR = dataDirectory;

const pointsDb = await import("@/lib/points-db");
const { getDisasterDashboardConfig } = await import(
  "@/lib/disaster-dashboard-config"
);
const { saveOperationalSettings } = await import("@/lib/operational-settings");

test("dashboard config falls back to OSM when VWorld has no API key", async () => {
  const originalVworld = process.env.VWORLD_API_KEY;
  const originalPublicVworld = process.env.NEXT_PUBLIC_VWORLD_API_KEY;
  delete process.env.VWORLD_API_KEY;
  delete process.env.NEXT_PUBLIC_VWORLD_API_KEY;

  try {
    await saveOperationalSettings({
      mapProvider: "vworld",
      mapTileMode: "vector",
      osmTileSource: "openfreemap",
    });

    const config = await getDisasterDashboardConfig();

    assert.equal(config.mapSettings.mapProvider, "osm");
    assert.equal(config.mapSettings.osmTileSource, "openfreemap");
    assert.equal(config.vworldApiKey, "");
  } finally {
    if (originalVworld === undefined) {
      delete process.env.VWORLD_API_KEY;
    } else {
      process.env.VWORLD_API_KEY = originalVworld;
    }

    if (originalPublicVworld === undefined) {
      delete process.env.NEXT_PUBLIC_VWORLD_API_KEY;
    } else {
      process.env.NEXT_PUBLIC_VWORLD_API_KEY = originalPublicVworld;
    }

    await pointsDb.closeDatabase();
  }
});
