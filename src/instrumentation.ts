export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }

  const { startHazardEventScheduler } = await import("@/lib/hazard-scheduler");
  startHazardEventScheduler();
}
