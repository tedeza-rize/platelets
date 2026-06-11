import { updateHazardEvents } from "@/lib/hazard-events";
import { recordApiLog } from "@/lib/points-db";
import { getPublicDataApiKey } from "@/lib/public-data";

const DEFAULT_INTERVAL_MS = 120_000;
const MINIMUM_INTERVAL_MS = 60_000;

type SchedulerState = {
  intervalId?: ReturnType<typeof setInterval>;
  isRunning: boolean;
};

const schedulerGlobal = globalThis as typeof globalThis & {
  __plateletsHazardScheduler?: SchedulerState;
};

function intervalMs() {
  const value = Number(process.env.KMA_EARTHQUAKE_POLL_INTERVAL_MS);

  if (!Number.isFinite(value) || value <= 0) {
    return DEFAULT_INTERVAL_MS;
  }

  return Math.max(value, MINIMUM_INTERVAL_MS);
}

export function startHazardEventScheduler() {
  if (!schedulerGlobal.__plateletsHazardScheduler) {
    schedulerGlobal.__plateletsHazardScheduler = {
      isRunning: false,
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
      if (!(await getPublicDataApiKey())) {
        return;
      }

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

  state.intervalId = setInterval(run, intervalMs());
  setTimeout(run, 5_000);
}
