import type { MapRenderingSettings } from "@/lib/map-settings";
import { getOperationalSettings } from "@/lib/operational-settings";
import { getRuntimeApiKeys } from "@/lib/runtime-config";

export type DisasterDashboardConfig = {
  mapSettings: MapRenderingSettings;
  vworldApiKey: string;
};

export async function getDisasterDashboardConfig(): Promise<DisasterDashboardConfig> {
  const [operationalSettings, runtimeApiKeys] = await Promise.all([
    getOperationalSettings(),
    getRuntimeApiKeys(),
  ]);

  return {
    mapSettings: {
      mapProvider: operationalSettings.mapProvider,
      mapTileMode: operationalSettings.mapTileMode,
      osmTileSource: operationalSettings.osmTileSource,
    },
    vworldApiKey: runtimeApiKeys.vworldApiKey,
  };
}
