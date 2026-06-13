import { updateDataset } from "@/lib/dataset-import";
import {
  DATASET_SOURCE_IDS,
  type DatasetSourceId,
} from "@/lib/dataset-sources";
import { getOperationalSettings } from "@/lib/operational-settings";
import {
  databaseFileExists,
  getAppSetting,
  listDatasetStatuses,
  recordApiLog,
  setAppSetting,
} from "@/lib/points-db";
import { isSetupCompleteFromDatabaseFile } from "@/lib/setup-state";

export type DatasetSchedule = {
  enabled: boolean;
  intervalDays: number;
};

export type DatasetScheduleSettings = Record<DatasetSourceId, DatasetSchedule>;

const SETTINGS_KEY = "dataset-update-schedules";
const SCHEDULER_INTERVAL_MS = 30 * 60 * 1000;
const MEDICAL_DAILY_SOURCES = new Set<DatasetSourceId>([
  "pharmacies",
  "hospitals",
  "emergency-medical-institutions",
]);

const schedulerGlobal = globalThis as typeof globalThis & {
  __plateletsDatasetScheduler?: {
    intervalId?: ReturnType<typeof setInterval>;
    isRunning: boolean;
  };
};

export function defaultDatasetScheduleSettings(): DatasetScheduleSettings {
  return Object.fromEntries(
    DATASET_SOURCE_IDS.map((source) => [
      source,
      {
        enabled: true,
        intervalDays: MEDICAL_DAILY_SOURCES.has(source) ? 1 : 14,
      },
    ]),
  ) as DatasetScheduleSettings;
}

function normalizeSchedule(value: unknown, fallback: DatasetSchedule) {
  const candidate = value as Partial<DatasetSchedule> | null;
  const intervalDays = Number(candidate?.intervalDays);

  return {
    enabled:
      typeof candidate?.enabled === "boolean"
        ? candidate.enabled
        : fallback.enabled,
    intervalDays: Number.isFinite(intervalDays)
      ? Math.min(365, Math.max(1, Math.round(intervalDays)))
      : fallback.intervalDays,
  };
}

export async function getDatasetScheduleSettings() {
  const defaults = defaultDatasetScheduleSettings();
  const stored = await getAppSetting<Partial<DatasetScheduleSettings>>(
    SETTINGS_KEY,
    {},
  );

  return Object.fromEntries(
    DATASET_SOURCE_IDS.map((source) => [
      source,
      normalizeSchedule(stored[source], defaults[source]),
    ]),
  ) as DatasetScheduleSettings;
}

export async function saveDatasetScheduleSettings(value: unknown) {
  const defaults = defaultDatasetScheduleSettings();
  const candidate = value as Partial<DatasetScheduleSettings> | null;
  const normalized = Object.fromEntries(
    DATASET_SOURCE_IDS.map((source) => [
      source,
      normalizeSchedule(candidate?.[source], defaults[source]),
    ]),
  ) as DatasetScheduleSettings;

  await setAppSetting(SETTINGS_KEY, normalized);

  return normalized;
}

function lastAttemptAt(
  status: Awaited<ReturnType<typeof listDatasetStatuses>>[number],
) {
  const values = [status.fetchedAt, status.updateProgress?.updatedAt]
    .filter((value): value is string => Boolean(value))
    .map((value) => new Date(value).getTime())
    .filter(Number.isFinite);

  return values.length > 0 ? Math.max(...values) : null;
}

export async function runDueDatasetUpdates() {
  if (!databaseFileExists() || !(await isSetupCompleteFromDatabaseFile())) {
    return;
  }

  const [operationalSettings, settings, statuses] = await Promise.all([
    getOperationalSettings(),
    getDatasetScheduleSettings(),
    listDatasetStatuses(),
  ]);

  if (!operationalSettings.datasetAutoUpdateEnabled) {
    return;
  }

  const now = Date.now();

  for (const status of statuses) {
    const schedule = settings[status.id];
    const lastAttempt = lastAttemptAt(status);
    const due =
      schedule.enabled &&
      status.updateProgress?.status !== "running" &&
      (lastAttempt === null ||
        now - lastAttempt >= schedule.intervalDays * 24 * 60 * 60 * 1000);

    if (!due) {
      continue;
    }

    try {
      await updateDataset(status.id, { mode: "restart" });
    } catch (error) {
      await recordApiLog({
        action: "dataset-scheduled-update",
        category: "dataset",
        level: "warn",
        message: error instanceof Error ? error.message : String(error),
        source: status.id,
        status: "failure",
      });
    }
  }
}

export function startDatasetScheduler() {
  if (!schedulerGlobal.__plateletsDatasetScheduler) {
    schedulerGlobal.__plateletsDatasetScheduler = { isRunning: false };
  }

  const state = schedulerGlobal.__plateletsDatasetScheduler;

  if (state.intervalId) {
    return;
  }

  async function run() {
    if (state.isRunning) {
      return;
    }

    state.isRunning = true;

    try {
      await runDueDatasetUpdates();
    } finally {
      state.isRunning = false;
    }
  }

  state.intervalId = setInterval(run, SCHEDULER_INTERVAL_MS);
  setTimeout(run, 60_000);
}
