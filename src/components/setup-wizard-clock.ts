import type { EnvironmentCheck, StatusPayload } from "./setup-wizard-types";

function formatSeconds(valueMs: number) {
  const seconds = Math.abs(valueMs) / 1000;
  return seconds.toFixed(seconds >= 10 ? 1 : 2);
}

function timestampOrNull(value: string) {
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function buildClientServerClockCheck(
  status: StatusPayload | null,
  startedAt: number,
  receivedAt: number,
): EnvironmentCheck | null {
  const time = status?.environment.time;

  if (!time) {
    return null;
  }

  const serverReceivedAt = timestampOrNull(time.serverReceivedAt);
  const serverRespondedAt = timestampOrNull(time.serverRespondedAt);

  if (serverReceivedAt === null || serverRespondedAt === null) {
    return null;
  }

  const serverClientOffsetMs =
    (serverReceivedAt - startedAt + serverRespondedAt - receivedAt) / 2;
  const clientServerOffsetMs = -serverClientOffsetMs;
  const ok = Math.abs(clientServerOffsetMs) <= time.thresholdMs;

  return {
    detailKey: ok
      ? "environment.clientClock.ok"
      : "environment.clientClock.skewed",
    detailValues: {
      offsetSeconds: formatSeconds(clientServerOffsetMs),
      thresholdSeconds: (time.thresholdMs / 1000).toFixed(0),
    },
    id: "client-server-clock",
    ok,
    titleKey: "environment.clientClock.title",
  };
}

export function buildClockSyncCheck(
  serverClockCheck: EnvironmentCheck | undefined,
  clientClockCheck: EnvironmentCheck | null,
): EnvironmentCheck | null {
  if (!serverClockCheck) {
    return null;
  }

  if (!serverClockCheck.ok) {
    return {
      detailKey:
        serverClockCheck.detailKey === "environment.ntp.unavailable"
          ? "environment.clock.unavailable"
          : "environment.clock.serverSkewed",
      id: "clock-sync",
      ok: false,
      titleKey: "environment.clock.title",
    };
  }

  if (!clientClockCheck) {
    return {
      detailKey: "environment.clock.pending",
      id: "clock-sync",
      ok: false,
      titleKey: "environment.clock.title",
    };
  }

  return {
    detailKey: clientClockCheck.ok
      ? "environment.clock.ok"
      : "environment.clock.browserSkewed",
    id: "clock-sync",
    ok: clientClockCheck.ok,
    titleKey: "environment.clock.title",
  };
}
