import { getIntegrationSettings } from "@/lib/integration-settings";

export type FireSafetyApiSummary = {
  configured: boolean;
  dataFamilies: string[];
  status: "configured" | "unconfigured";
  updatedAt: string;
};

const FIRE_SAFETY_DATA_FAMILIES = [
  "national-ems",
  "national-ems-control",
  "fire-safety-targets",
  "multi-use-businesses",
  "national-fire-incidents",
  "119-call-reception",
  "rescue-operations",
  "fire-safety-target-detail",
  "fire-facility-detail",
] as const;

export async function getFireSafetyApiSummary(): Promise<FireSafetyApiSummary> {
  const { fireSafetyApiKey } = await getIntegrationSettings();

  return {
    configured: Boolean(fireSafetyApiKey),
    dataFamilies: Array.from(FIRE_SAFETY_DATA_FAMILIES),
    status: fireSafetyApiKey ? "configured" : "unconfigured",
    updatedAt: new Date().toISOString(),
  };
}
