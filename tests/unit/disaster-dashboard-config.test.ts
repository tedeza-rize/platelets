import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { setDataDirectoryPathForTests } from "@/lib/data-paths";

const dataDirectory = mkdtempSync(
  path.join(tmpdir(), "platelets-dashboard-config-"),
);
setDataDirectoryPathForTests(dataDirectory);

const pointsDb = await import("@/lib/points-db");
const { getDisasterDashboardConfig } = await import(
  "@/lib/disaster-dashboard-config"
);
const { saveOperationalSettings } = await import("@/lib/operational-settings");

test("dashboard config falls back to OSM when VWorld has no API key", async () => {
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
    await pointsDb.closeDatabase();
  }
});
