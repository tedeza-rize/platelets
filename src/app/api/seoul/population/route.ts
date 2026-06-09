import type { NextRequest } from "next/server";
import {
  SEOUL_CITYDATA_AREA_BY_CODE,
  SEOUL_CITYDATA_AREA_BY_NAME,
} from "@/data/seoul-citydata-areas";
import { noStoreJson } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SeoulPopulationStatus = {
  areaCode: string;
  areaName: string;
  congestionLevel: string | null;
  congestionMessage: string | null;
  maleRate: string | null;
  minPopulation: number | null;
  maxPopulation: number | null;
  populationTime: string | null;
  residentRate: string | null;
  nonResidentRate: string | null;
  sourceUpdatedAt: string | null;
};

type SeoulCitydataRow = SeoulLivePopulationStatus & {
  AREA_CD?: string;
  AREA_NM?: string;
  LIVE_PPLTN_STTS?: SeoulLivePopulationStatus | SeoulLivePopulationStatus[];
};

type SeoulLivePopulationStatus = {
  AREA_CONGEST_LVL?: string;
  AREA_CONGEST_MSG?: string;
  AREA_PPLTN_MAX?: string | number;
  AREA_PPLTN_MIN?: string | number;
  MALE_PPLTN_RATE?: string | number;
  NON_RESNT_PPLTN_RATE?: string | number;
  PPLTN_TIME?: string;
  RESNT_PPLTN_RATE?: string | number;
};

type CacheEntry = {
  expiresAt: number;
  payload: SeoulPopulationStatus;
};

const SEOUL_CITYDATA_CACHE_MS = 60_000;
const seoulPopulationCache = new Map<string, CacheEntry>();

function getSeoulOpenApiKey() {
  return (
    process.env.SEOUL_OPEN_API_KEY?.trim() ??
    process.env.SEOUL_CITYDATA_API_KEY?.trim() ??
    null
  );
}

function toNumber(value: string | number | undefined) {
  if (value === undefined) {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number) ? number : null;
}

function toText(value: string | number | undefined) {
  if (value === undefined) {
    return null;
  }

  const text = String(value).trim();

  return text.length > 0 ? text : null;
}

function findCitydataRow(value: unknown): SeoulCitydataRow | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findCitydataRow(item);

      if (found) {
        return found;
      }
    }

    return null;
  }

  const record = value as Record<string, unknown>;

  if (
    typeof record.AREA_NM === "string" &&
    (record.LIVE_PPLTN_STTS || record.AREA_CD)
  ) {
    return record as SeoulCitydataRow;
  }

  for (const item of Object.values(record)) {
    const found = findCitydataRow(item);

    if (found) {
      return found;
    }
  }

  return null;
}

function firstPopulationStatus(row: SeoulCitydataRow) {
  const status = row.LIVE_PPLTN_STTS;

  if (Array.isArray(status)) {
    return status[0] ?? row;
  }

  return status ?? row;
}

function mapPopulationStatus(row: SeoulCitydataRow): SeoulPopulationStatus {
  const status = firstPopulationStatus(row) ?? {};

  return {
    areaCode: row.AREA_CD ?? "",
    areaName: row.AREA_NM ?? "",
    congestionLevel: toText(status.AREA_CONGEST_LVL),
    congestionMessage: toText(status.AREA_CONGEST_MSG),
    maleRate: toText(status.MALE_PPLTN_RATE),
    maxPopulation: toNumber(status.AREA_PPLTN_MAX),
    minPopulation: toNumber(status.AREA_PPLTN_MIN),
    nonResidentRate: toText(status.NON_RESNT_PPLTN_RATE),
    populationTime: toText(status.PPLTN_TIME),
    residentRate: toText(status.RESNT_PPLTN_RATE),
    sourceUpdatedAt: toText(status.PPLTN_TIME),
  };
}

export async function GET(request: NextRequest) {
  const areaCode = request.nextUrl.searchParams.get("areaCode")?.trim() ?? "";
  const areaName = request.nextUrl.searchParams.get("areaName")?.trim() ?? "";
  const area =
    (areaCode ? SEOUL_CITYDATA_AREA_BY_CODE.get(areaCode) : undefined) ??
    (areaName ? SEOUL_CITYDATA_AREA_BY_NAME.get(areaName) : undefined);

  if (!area) {
    return noStoreJson(
      { error: "Unknown Seoul citydata area" },
      { status: 400 },
    );
  }

  const cached = seoulPopulationCache.get(area.areaCode);

  if (cached && cached.expiresAt > Date.now()) {
    return noStoreJson({ population: cached.payload });
  }

  const apiKey = getSeoulOpenApiKey();

  if (!apiKey) {
    return noStoreJson(
      { error: "SEOUL_OPEN_API_KEY is required." },
      { status: 503 },
    );
  }

  const url = new URL(
    `http://openapi.seoul.go.kr:8088/${encodeURIComponent(
      apiKey,
    )}/json/citydata_ppltn/1/5/${encodeURIComponent(area.areaName)}`,
  );
  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    return noStoreJson(
      { error: `Seoul citydata failed with HTTP ${response.status}` },
      { status: 502 },
    );
  }

  const payload = (await response.json()) as unknown;
  const row = findCitydataRow(payload);

  if (!row) {
    return noStoreJson(
      { error: "Seoul citydata returned no population row" },
      { status: 502 },
    );
  }

  const population = {
    ...mapPopulationStatus(row),
    areaCode: area.areaCode,
    areaName: area.areaName,
  };

  seoulPopulationCache.set(area.areaCode, {
    expiresAt: Date.now() + SEOUL_CITYDATA_CACHE_MS,
    payload: population,
  });

  return noStoreJson({ population });
}
