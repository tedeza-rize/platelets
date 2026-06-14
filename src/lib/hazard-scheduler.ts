import { updateHazardEvents } from "@/lib/hazard-events";
import { getOperationalSettings } from "@/lib/operational-settings";
import { databaseFileExists, recordApiLog } from "@/lib/points-db";
import { getPublicDataApiKey } from "@/lib/public-data";
import { isSetupCompleteFromDatabaseFile } from "@/lib/setup-state";

const SCHEDULER_TICK_MS = 60_000;

type SchedulerState = {
  intervalId?: ReturnType<typeof setInterval>;
  isRunning: boolean;
  lastRunAt: number;
};

const schedulerGlobal = globalThis as typeof globalThis & {
  __plateletsHazardScheduler?: SchedulerState;
};

export function startHazardEventScheduler() {
  if (!schedulerGlobal.__plateletsHazardScheduler) {
    schedulerGlobal.__plateletsHazardScheduler = {
      isRunning: false,
      lastRunAt: 0,
    };
  }

  const state = schedulerGlobal.__plateletsHazardScheduler;

  if (state.intervalId) {
    return;
  }

  async function run() {
    if (state.isRunning) {
      return;
    }

    state.isRunning = true;

    try {
      if (
        !(databaseFileExists() && (await isSetupCompleteFromDatabaseFile()))
      ) {
        return;
      }

      const settings = await getOperationalSettings();
      const now = Date.now();

      if (now - state.lastRunAt < settings.kmaEarthquakePollIntervalMs) {
        return;
      }

      if (!(await getPublicDataApiKey())) {
        return;
      }

      state.lastRunAt = now;
      await updateHazardEvents("background");
    } catch (error) {
      await recordApiLog({
        action: "hazard-background-update",
        category: "hazard",
        level: "warn",
        message: error instanceof Error ? error.message : String(error),
        status: "failure",
      });
    } finally {
      state.isRunning = false;
    }
  }

  state.intervalId = setInterval(run, SCHEDULER_TICK_MS);
  setTimeout(run, 5_000);
}
