import dgram from "node:dgram";
import { getAppSetting, recordApiLog, setAppSetting } from "@/lib/points-db";

const NTP_PORT = 123;
const NTP_TIMEOUT_MS = 1800;
const NTP_UNIX_EPOCH_OFFSET_SECONDS = 2_208_988_800;
const SETTINGS_KEY = "ntp-servers";
export const TIME_SKEW_THRESHOLD_MS = 3000;
export const DEFAULT_NTP_SERVERS = [
  "0.kr.pool.ntp.org",
  "1.kr.pool.ntp.org",
  "2.kr.pool.ntp.org",
  "3.kr.pool.ntp.org",
  "time.cloudflare.com",
  "ntp.kriss.re.kr",
  "time.nist.gov",
  "time.windows.com",
] as const;

export type NtpServerResult = {
  error: string | null;
  host: string;
  offsetMs: number | null;
  receivedAt: string | null;
  roundTripDelayMs: number | null;
  stratum: number | null;
  valid: boolean;
};

export type ServerTimeStatus = {
  checkedAt: string;
  ntp: {
    error: string | null;
    responses: NtpServerResult[];
    selected: NtpServerResult | null;
  };
  ntpServers: string[];
  serverReceivedAt: string;
  serverRespondedAt: string;
  serverTime: string;
  thresholdMs: number;
};

type CachedServerTimeStatus = Omit<
  ServerTimeStatus,
  "serverReceivedAt" | "serverRespondedAt" | "serverTime"
>;

let cachedStatus: {
  expiresAt: number;
  promise: Promise<CachedServerTimeStatus>;
} | null = null;

function parseNtpTimestamp(buffer: Buffer, offset: number) {
  const seconds = buffer.readUInt32BE(offset);
  const fraction = buffer.readUInt32BE(offset + 4);

  if (seconds === 0 && fraction === 0) {
    return Number.NaN;
  }

  return (
    (seconds - NTP_UNIX_EPOCH_OFFSET_SECONDS) * 1000 +
    (fraction * 1000) / 2 ** 32
  );
}

function sanitizeServers(servers: string[]) {
  const deduped = new Set<string>();

  for (const server of servers) {
    const value = server.trim();

    if (value && !value.includes("/") && !value.includes("\\")) {
      deduped.add(value);
    }
  }

  return Array.from(deduped).slice(0, 16);
}

export async function getConfiguredNtpServers() {
  const servers = await getAppSetting<string[]>(
    SETTINGS_KEY,
    Array.from(DEFAULT_NTP_SERVERS),
  );

  const sanitized = sanitizeServers(Array.isArray(servers) ? servers : []);

  return sanitized.length > 0 ? sanitized : Array.from(DEFAULT_NTP_SERVERS);
}

export async function saveConfiguredNtpServers(servers: string[]) {
  const sanitized = sanitizeServers(servers);

  if (sanitized.length === 0) {
    throw new Error("At least one NTP server is required.");
  }

  await setAppSetting(SETTINGS_KEY, sanitized);
  cachedStatus = null;
  await recordApiLog({
    action: "ntp-settings",
    category: "system",
    level: "info",
    message: "NTP server list updated.",
    metadata: { count: sanitized.length },
    status: "success",
  });

  return sanitized;
}

function queryNtpServer(host: string): Promise<NtpServerResult> {
  return new Promise((resolve) => {
    const socket = dgram.createSocket("udp4");
    const request = Buffer.alloc(48);
    const sentAt = Date.now();
    const startedAt = performance.now();
    let settled = false;

    request[0] = 0x23;

    function finish(result: NtpServerResult) {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeout);
      try {
        socket.close();
      } catch {}
      resolve(result);
    }

    const timeout = setTimeout(() => {
      finish({
        error: "timeout",
        host,
        offsetMs: null,
        receivedAt: null,
        roundTripDelayMs: null,
        stratum: null,
        valid: false,
      });
    }, NTP_TIMEOUT_MS);

    socket.once("error", (error) => {
      finish({
        error: error.message,
        host,
        offsetMs: null,
        receivedAt: null,
        roundTripDelayMs: null,
        stratum: null,
        valid: false,
      });
    });

    socket.once("message", (message) => {
      const elapsedMs = performance.now() - startedAt;
      const receivedAt = sentAt + elapsedMs;
      const mode = message[0] & 0x07;
      const stratum = message[1];
      const receiveTimestamp = parseNtpTimestamp(message, 32);
      const transmitTimestamp = parseNtpTimestamp(message, 40);

      if (
        message.length < 48 ||
        mode !== 4 ||
        stratum === 0 ||
        !Number.isFinite(receiveTimestamp) ||
        !Number.isFinite(transmitTimestamp)
      ) {
        finish({
          error: "invalid response",
          host,
          offsetMs: null,
          receivedAt: new Date(receivedAt).toISOString(),
          roundTripDelayMs: elapsedMs,
          stratum,
          valid: false,
        });
        return;
      }

      const serverProcessingMs = transmitTimestamp - receiveTimestamp;
      const roundTripDelayMs = Math.max(0, elapsedMs - serverProcessingMs);
      const offsetMs =
        (receiveTimestamp - sentAt + transmitTimestamp - receivedAt) / 2;

      finish({
        error: null,
        host,
        offsetMs,
        receivedAt: new Date(receivedAt).toISOString(),
        roundTripDelayMs,
        stratum,
        valid: true,
      });
    });

    socket.send(request, NTP_PORT, host, (error) => {
      if (error) {
        finish({
          error: error.message,
          host,
          offsetMs: null,
          receivedAt: null,
          roundTripDelayMs: null,
          stratum: null,
          valid: false,
        });
      }
    });
  });
}

async function buildServerTimeStatus(): Promise<CachedServerTimeStatus> {
  const ntpServers = await getConfiguredNtpServers();
  const responses = await Promise.all(ntpServers.map(queryNtpServer));
  const validResponses = responses
    .filter(
      (
        response,
      ): response is NtpServerResult & {
        offsetMs: number;
        roundTripDelayMs: number;
      } => response.valid && response.roundTripDelayMs !== null,
    )
    .sort((left, right) => left.roundTripDelayMs - right.roundTripDelayMs);
  const selected = validResponses[0] ?? null;

  return {
    checkedAt: new Date().toISOString(),
    ntp: {
      error: selected ? null : "No valid NTP response.",
      responses,
      selected,
    },
    ntpServers,
    thresholdMs: TIME_SKEW_THRESHOLD_MS,
  };
}

export async function getServerTimeStatus(
  options: { serverReceivedAt?: Date } = {},
) {
  const now = Date.now();

  if (!cachedStatus || cachedStatus.expiresAt <= now) {
    cachedStatus = {
      expiresAt: now + 30_000,
      promise: buildServerTimeStatus(),
    };
  }

  const status = await cachedStatus.promise;
  const respondedAt = new Date();

  return {
    ...status,
    serverReceivedAt: (options.serverReceivedAt ?? respondedAt).toISOString(),
    serverRespondedAt: respondedAt.toISOString(),
    serverTime: respondedAt.toISOString(),
  };
}
