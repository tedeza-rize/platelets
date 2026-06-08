import {
  type HazardEventInput,
  type HazardEventType,
  type HazardEventUpdateResult,
  recordApiLog,
  replaceHazardEvents,
} from "@/lib/points-db";
import { getPublicDataApiKey } from "@/lib/public-data";

type KmaRecord = Record<string, unknown>;

type KmaResponse = {
  response?: {
    body?: {
      items?: {
        item?: KmaRecord | KmaRecord[];
      };
      totalCount?: number | string;
    };
    header?: {
      resultCode?: number | string;
      resultMsg?: string;
    };
  };
};

const KMA_EQK_BASE_URL = "http://apis.data.go.kr/1360000/EqkInfoService";
const HAZARD_NUM_OF_ROWS = 100;

function text(value: unknown) {
  return value === null || value === undefined ? "" : String(value).trim();
}

function nullableText(value: unknown) {
  const trimmed = text(value);
  return trimmed.length > 0 ? trimmed : null;
}

function toNumber(value: unknown) {
  const number = Number(text(value));
  return Number.isFinite(number) ? number : null;
}

function compactRecord(record: KmaRecord) {
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [key, text(value)]),
  );
}

function kstDateValue(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Seoul",
    year: "numeric",
  }).formatToParts(date);
  const byType = new Map(parts.map((part) => [part.type, part.value]));

  return `${byType.get("year")}${byType.get("month")}${byType.get("day")}`;
}

function recentDateRange() {
  const today = new Date();
  const from = new Date(today);
  from.setDate(today.getDate() - 3);

  return {
    fromTmFc: kstDateValue(from),
    toTmFc: kstDateValue(today),
  };
}

function parseKmaDate(value: unknown) {
  const digits = text(value).replace(/\D/g, "");

  if (digits.length < 12) {
    return null;
  }

  const year = digits.slice(0, 4);
  const month = digits.slice(4, 6);
  const day = digits.slice(6, 8);
  const hour = digits.slice(8, 10);
  const minute = digits.slice(10, 12);
  const second = digits.length >= 14 ? digits.slice(12, 14) : "00";

  return `${year}-${month}-${day}T${hour}:${minute}:${second}+09:00`;
}

function normalizeItems(payload: KmaResponse) {
  const rawItems = payload.response?.body?.items?.item;

  if (Array.isArray(rawItems)) {
    return rawItems;
  }

  return rawItems ? [rawItems] : [];
}

async function fetchKmaRecords(
  eventType: HazardEventType,
  operation: "getEqkMsg" | "getTsunamiMsg",
) {
  const serviceKey = getPublicDataApiKey();

  if (!serviceKey) {
    throw new Error(
      "PUBLIC_DATA_API_KEY, DATA_GO_KR_API_KEY, or DATA_GO_KR_SERVICE_KEY is required to update earthquake events.",
    );
  }

  const dateRange = recentDateRange();
  const url = new URL(`${KMA_EQK_BASE_URL}/${operation}`);
  url.searchParams.set("serviceKey", serviceKey);
  url.searchParams.set("numOfRows", String(HAZARD_NUM_OF_ROWS));
  url.searchParams.set("pageNo", "1");
  url.searchParams.set("dataType", "JSON");
  url.searchParams.set("fromTmFc", dateRange.fromTmFc);
  url.searchParams.set("toTmFc", dateRange.toTmFc);

  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      Accept: "application/json,*/*",
      "User-Agent": "platelets/0.1",
    },
  });

  await recordApiLog({
    action: "hazard-download",
    category: "hazard",
    level: response.ok ? "info" : "error",
    message: response.ok
      ? `${operation} downloaded.`
      : `${operation} failed with HTTP ${response.status}.`,
    metadata: {
      eventType,
      fromTmFc: dateRange.fromTmFc,
      statusCode: response.status,
      toTmFc: dateRange.toTmFc,
    },
    requestCount: 1,
    status: response.ok ? "success" : "failure",
  });

  if (!response.ok) {
    throw new Error(`${operation} request failed (${response.status})`);
  }

  const payload = (await response.json()) as KmaResponse;
  const resultCode = text(payload.response?.header?.resultCode);

  if (resultCode && !["0", "00", "03"].includes(resultCode)) {
    throw new Error(
      `${operation} returned ${resultCode}: ${
        payload.response?.header?.resultMsg ?? "unknown error"
      }`,
    );
  }

  return normalizeItems(payload);
}

function mapEarthquakeRecord(record: KmaRecord): HazardEventInput | null {
  const issuedAt = parseKmaDate(record.tmFc);
  const occurredAt = parseKmaDate(record.tmEqk);
  const location = text(record.loc);
  const latitude = toNumber(record.lat);
  const longitude = toNumber(record.lon);
  const magnitude = nullableText(record.mt);
  const sequence = text(record.tmSeq) || text(record.cnt) || text(record.tmEqk);

  if (!issuedAt || !location) {
    return null;
  }

  return {
    depth: nullableText(record.dep),
    description: nullableText(record.rem),
    eventId: `earthquake:${text(record.fcTp)}:${text(record.tmFc)}:${sequence}`,
    eventType: "earthquake",
    imageUrl: nullableText(record.img),
    intensity: nullableText(record.inT),
    issuedAt,
    latitude,
    location,
    longitude,
    magnitude,
    occurredAt,
    raw: compactRecord(record),
    title: magnitude ? `지진 M${magnitude}` : "지진 정보",
  };
}

function mapTsunamiRecord(record: KmaRecord): HazardEventInput | null {
  const issuedAt = parseKmaDate(record.tmFc);
  const occurredAt = parseKmaDate(record.tmEqk);
  const location = text(record.loc);
  const latitude = toNumber(record.lat);
  const longitude = toNumber(record.lon);
  const sequence = text(record.cnt) || text(record.tmEf) || text(record.tmFc);

  if (!issuedAt || !location) {
    return null;
  }

  return {
    depth: null,
    description: nullableText(record.rem) ?? nullableText(record.ann),
    eventId: `tsunami:${text(record.fcTp)}:${text(record.tmFc)}:${sequence}`,
    eventType: "tsunami",
    imageUrl: null,
    intensity: nullableText(record.reg),
    issuedAt,
    latitude,
    location,
    longitude,
    magnitude: nullableText(record.mt),
    occurredAt,
    raw: compactRecord(record),
    title: "지진해일 통보",
  };
}

export async function updateHazardEvents(): Promise<HazardEventUpdateResult> {
  const fetchedAt = new Date().toISOString();

  try {
    await recordApiLog({
      action: "hazard-update",
      category: "hazard",
      level: "info",
      message: "Hazard event update started.",
      status: "success",
    });

    const [earthquakeRecords, tsunamiRecords] = await Promise.all([
      fetchKmaRecords("earthquake", "getEqkMsg"),
      fetchKmaRecords("tsunami", "getTsunamiMsg"),
    ]);
    const events = [
      ...earthquakeRecords
        .map(mapEarthquakeRecord)
        .filter((event): event is HazardEventInput => event !== null),
      ...tsunamiRecords
        .map(mapTsunamiRecord)
        .filter((event): event is HazardEventInput => event !== null),
    ];

    await replaceHazardEvents({
      events,
      fetchedAt,
    });

    await recordApiLog({
      action: "hazard-update",
      category: "hazard",
      level: "info",
      message: "Hazard event update completed.",
      metadata: {
        earthquakeCount: earthquakeRecords.length,
        importedCount: events.length,
        tsunamiCount: tsunamiRecords.length,
      },
      requestCount: 2,
      status: "success",
    });

    return {
      fetchedAt,
      importedCount: events.length,
      sources: [
        {
          count: earthquakeRecords.length,
          eventType: "earthquake",
        },
        {
          count: tsunamiRecords.length,
          eventType: "tsunami",
        },
      ],
    };
  } catch (error) {
    await recordApiLog({
      action: "hazard-update",
      category: "hazard",
      level: "error",
      message: error instanceof Error ? error.message : String(error),
      status: "failure",
    });
    throw error;
  }
}
