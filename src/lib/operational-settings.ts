import { getAppSetting, setAppSetting } from "@/lib/points-db";

export type OperationalSettings = {
  aiAllowPrivateBaseUrl: boolean;
  datasetAutoUpdateEnabled: boolean;
  kmaEarthquakePollIntervalMs: number;
  overpassApiUrl: string;
};

const SETTINGS_KEY = "operational-settings";
const DEFAULT_OVERPASS_API_URL = "https://overpass-api.de/api/interpreter";
const DEFAULT_KMA_INTERVAL_MS = 120_000;
const MINIMUM_KMA_INTERVAL_MS = 60_000;

export const DEFAULT_OPERATIONAL_SETTINGS: OperationalSettings = {
  aiAllowPrivateBaseUrl: false,
  datasetAutoUpdateEnabled: process.env.NODE_ENV === "production",
  kmaEarthquakePollIntervalMs: DEFAULT_KMA_INTERVAL_MS,
  overpassApiUrl: DEFAULT_OVERPASS_API_URL,
};

function cleanBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function cleanInterval(value: unknown) {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue) || numberValue <= 0) {
    return DEFAULT_KMA_INTERVAL_MS;
  }

  return Math.max(MINIMUM_KMA_INTERVAL_MS, Math.round(numberValue));
}

function cleanOverpassUrl(value: unknown) {
  const candidate = String(value ?? "").trim() || DEFAULT_OVERPASS_API_URL;
  const url = new URL(candidate);

  if (url.protocol !== "https:") {
    throw new Error("Overpass API URL must use HTTPS.");
  }

  return url.toString();
}

export async function getOperationalSettings() {
  const stored = await getAppSetting<Partial<OperationalSettings>>(
    SETTINGS_KEY,
    {},
  );

  return {
    aiAllowPrivateBaseUrl: cleanBoolean(
      stored.aiAllowPrivateBaseUrl,
      DEFAULT_OPERATIONAL_SETTINGS.aiAllowPrivateBaseUrl,
    ),
    datasetAutoUpdateEnabled: cleanBoolean(
      stored.datasetAutoUpdateEnabled,
      DEFAULT_OPERATIONAL_SETTINGS.datasetAutoUpdateEnabled,
    ),
    kmaEarthquakePollIntervalMs: cleanInterval(
      stored.kmaEarthquakePollIntervalMs,
    ),
    overpassApiUrl: cleanOverpassUrl(stored.overpassApiUrl),
  } satisfies OperationalSettings;
}

export async function saveOperationalSettings(
  input: Partial<OperationalSettings>,
) {
  const settings = {
    aiAllowPrivateBaseUrl: cleanBoolean(
      input.aiAllowPrivateBaseUrl,
      DEFAULT_OPERATIONAL_SETTINGS.aiAllowPrivateBaseUrl,
    ),
    datasetAutoUpdateEnabled: cleanBoolean(
      input.datasetAutoUpdateEnabled,
      DEFAULT_OPERATIONAL_SETTINGS.datasetAutoUpdateEnabled,
    ),
    kmaEarthquakePollIntervalMs: cleanInterval(
      input.kmaEarthquakePollIntervalMs,
    ),
    overpassApiUrl: cleanOverpassUrl(input.overpassApiUrl),
  } satisfies OperationalSettings;

  await setAppSetting(SETTINGS_KEY, settings);
  return settings;
}
