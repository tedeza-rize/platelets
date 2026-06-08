import https from "node:https";
import { parse } from "csv-parse/sync";
import { XMLParser } from "fast-xml-parser";
import { DATASET_SOURCES, type DatasetSourceId } from "@/lib/dataset-sources";
import {
  consumeNaverGeocodingQuota,
  type DatasetUpdateResult,
  type EmergencyPointInput,
  recordApiLog,
  recordDatasetError,
  replaceDataset,
} from "@/lib/points-db";
import { getPublicDataApiKey } from "@/lib/public-data";

type CsvRecord = Record<string, unknown>;
type AedRecord = Record<string, unknown>;

type ImportResult = {
  failedCount: number;
  fetchedAt: string;
  geocodedCount: number;
  points: EmergencyPointInput[];
  skippedCount: number;
};

type NaverGeocodingResponse = {
  addresses?: Array<{
    jibunAddress?: string;
    roadAddress?: string;
    x?: string;
    y?: string;
  }>;
  errorMessage?: string;
  meta?: {
    count?: number;
    page?: number;
    totalCount?: number;
  };
  status?: string;
};

const CSV_ENCODING = "euc-kr";
const AED_NUM_OF_ROWS = 10_000;
const GEOCODE_CONCURRENCY = 4;
const DOWNLOAD_RETRY_COUNT = 3;

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

function wait(milliseconds: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function downloadCsvOnce(source: DatasetSourceId) {
  return new Promise<Buffer>((resolve, reject) => {
    const request = https.get(
      DATASET_SOURCES[source].url,
      {
        headers: {
          "User-Agent": "platelets/0.1",
        },
      },
      (response) => {
        if (response.statusCode !== 200) {
          response.resume();
          reject(new Error(`CSV download failed (${response.statusCode})`));
          return;
        }

        const chunks: Buffer[] = [];

        response.on("data", (chunk: Buffer) => {
          chunks.push(chunk);
        });
        response.on("end", () => {
          resolve(Buffer.concat(chunks));
        });
      },
    );

    request.on("error", reject);
  });
}

async function downloadCsv(source: DatasetSourceId) {
  let lastError: unknown;

  for (let attempt = 1; attempt <= DOWNLOAD_RETRY_COUNT; attempt += 1) {
    try {
      const buffer = await downloadCsvOnce(source);
      return new TextDecoder(CSV_ENCODING).decode(buffer);
    } catch (error) {
      lastError = error;
      await wait(200 * attempt);
    }
  }

  throw lastError;
}

function getNaverCredentials() {
  const keyId =
    process.env.NAVER_MAPS_CLIENT_ID?.trim() ??
    process.env.NAVER_MAPS_API_KEY_ID?.trim() ??
    process.env.NCP_APIGW_API_KEY_ID?.trim();
  const key =
    process.env.NAVER_MAPS_CLIENT_SECRET?.trim() ??
    process.env.NAVER_MAPS_API_KEY?.trim() ??
    process.env.NCP_APIGW_API_KEY?.trim();

  if (!keyId || !key) {
    return null;
  }

  return {
    key,
    keyId,
    source:
      process.env.NAVER_MAPS_CLIENT_ID || process.env.NAVER_MAPS_CLIENT_SECRET
        ? "NAVER_MAPS_CLIENT_ID/NAVER_MAPS_CLIENT_SECRET"
        : "legacy NCP API gateway env",
  };
}

function parseCsv(csv: string) {
  return parse(csv, {
    bom: true,
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as CsvRecord[];
}

async function fetchAedPage(pageNo: number) {
  const serviceKey = getPublicDataApiKey();

  if (!serviceKey) {
    throw new Error(
      "PUBLIC_DATA_API_KEY, DATA_GO_KR_API_KEY, or DATA_GO_KR_SERVICE_KEY is required to update AED data.",
    );
  }

  const url = new URL(DATASET_SOURCES.aeds.url);
  url.searchParams.set("serviceKey", serviceKey);
  url.searchParams.set("pageNo", String(pageNo));
  url.searchParams.set("numOfRows", String(AED_NUM_OF_ROWS));

  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      Accept: "application/xml,text/xml,*/*",
      "User-Agent": "platelets/0.1",
    },
  });

  await recordApiLog({
    action: "dataset-download",
    category: "dataset",
    level: response.ok ? "info" : "error",
    message: response.ok
      ? `AED page downloaded: ${pageNo}`
      : `AED page download failed with HTTP ${response.status}.`,
    metadata: {
      pageNo,
      statusCode: response.status,
    },
    requestCount: 1,
    source: "aeds",
    status: response.ok ? "success" : "failure",
  });

  if (!response.ok) {
    throw new Error(`AED API request failed (${response.status})`);
  }

  const xml = await response.text();
  const payload = new XMLParser({
    ignoreAttributes: false,
    trimValues: true,
  }).parse(xml) as {
    response?: {
      body?: {
        items?: {
          item?: AedRecord | AedRecord[];
        };
        pageNo?: number | string;
        totalCount?: number | string;
      };
      header?: {
        resultCode?: string;
        resultMsg?: string;
      };
    };
  };
  const header = payload.response?.header;

  if (header?.resultCode && header.resultCode !== "00") {
    throw new Error(
      `AED API returned ${header.resultCode}: ${header.resultMsg ?? "unknown error"}`,
    );
  }

  const body = payload.response?.body;
  const rawItems = body?.items?.item;
  const items = Array.isArray(rawItems) ? rawItems : rawItems ? [rawItems] : [];

  return {
    items,
    totalCount: Number(body?.totalCount ?? items.length),
  };
}

function mapFireRecord(record: CsvRecord): EmergencyPointInput | null {
  const latitude = toNumber(record.X좌표);
  const longitude = toNumber(record.Y좌표);
  const sourceRecordId = text(record.번호);
  const name = text(record["소방서 및 안전센터명"]);

  if (!sourceRecordId || !name) {
    return null;
  }

  return {
    address: text(record.주소),
    category: text(record.유형) || "소방",
    latitude,
    longitude,
    name,
    parentName: nullableText(record["상위 본부명"]),
    phone: nullableText(record.전화번호),
    raw: compactRecord(record),
    source: "fire-stations",
    sourceRecordId,
    sourceUpdatedAt: nullableText(record.등록일),
  };
}

function mapPoliceRecord(
  record: CsvRecord,
  coordinates: { latitude: number; longitude: number } | null,
): EmergencyPointInput | null {
  const sourceRecordId = text(record.연번);
  const office = text(record.경찰서);
  const station = text(record.관서명);
  const category = text(record.구분) || "경찰";

  if (!sourceRecordId || !station) {
    return null;
  }

  return {
    address: text(record.주소),
    category,
    latitude: coordinates?.latitude ?? null,
    longitude: coordinates?.longitude ?? null,
    name: `${office} ${station}${category}`.trim(),
    parentName: nullableText(record.시도청),
    phone: null,
    raw: compactRecord(record),
    source: "police-stations",
    sourceRecordId,
    sourceUpdatedAt: null,
  };
}

function mapAedRecord(record: AedRecord): EmergencyPointInput | null {
  const sourceRecordId = text(record.serialSeq);
  const latitude = toNumber(record.wgs84Lat);
  const longitude = toNumber(record.wgs84Lon);
  const buildAddress = text(record.buildAddress);
  const addressParts = [
    text(record.sido),
    text(record.gugun),
    buildAddress,
  ].filter(Boolean);
  const address = Array.from(new Set(addressParts)).join(" ");
  const org = text(record.org);
  const buildPlace = text(record.buildPlace);
  const name = org || buildPlace || "AED";

  if (!sourceRecordId || !name) {
    return null;
  }

  return {
    address,
    category: "AED",
    latitude,
    longitude,
    name,
    parentName: nullableText(buildPlace),
    phone: nullableText(record.clerkTel) ?? nullableText(record.managerTel),
    raw: compactRecord(record),
    source: "aeds",
    sourceRecordId,
    sourceUpdatedAt: null,
  };
}

function compactRecord(record: CsvRecord) {
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [key, text(value)]),
  );
}

async function geocodeAddress(address: string) {
  const credentials = getNaverCredentials();

  if (!address) {
    return null;
  }

  if (!credentials) {
    await recordApiLog({
      action: "geocode",
      category: "geocoding",
      level: "warn",
      message: "Naver geocoding skipped because API credentials are missing.",
      metadata: { address },
      status: "skipped",
    });
    return null;
  }

  await consumeNaverGeocodingQuota();

  const url = new URL(
    "https://naveropenapi.apigw.ntruss.com/map-geocode/v2/geocode",
  );
  url.searchParams.set("query", address);
  url.searchParams.set("count", "1");

  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "x-ncp-apigw-api-key": credentials.key,
        "x-ncp-apigw-api-key-id": credentials.keyId,
      },
    });

    if (!response.ok) {
      await recordApiLog({
        action: "geocode",
        category: "geocoding",
        level: "error",
        message: `Naver geocoding failed with HTTP ${response.status}.`,
        metadata: {
          address,
          credentialSource: credentials.source,
          naverHint:
            response.status === 401
              ? "Use Naver Cloud Platform Maps Geocoding API Key ID/API Key and confirm the service/restriction settings."
              : null,
          statusCode: response.status,
          usedHeaders: ["x-ncp-apigw-api-key-id", "x-ncp-apigw-api-key"],
        },
        requestCount: 1,
        status: "failure",
      });
      return null;
    }

    const payload = (await response.json()) as NaverGeocodingResponse;
    const firstAddress = payload.addresses?.[0];
    const longitude = Number(firstAddress?.x);
    const latitude = Number(firstAddress?.y);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      await recordApiLog({
        action: "geocode",
        category: "geocoding",
        level: "warn",
        message: "Naver geocoding returned no coordinate result.",
        metadata: {
          address,
          count: payload.meta?.count,
          errorMessage: payload.errorMessage,
          status: payload.status,
          totalCount: payload.meta?.totalCount,
        },
        requestCount: 1,
        status: "skipped",
      });
      return null;
    }

    await recordApiLog({
      action: "geocode",
      category: "geocoding",
      level: "info",
      message: "Naver geocoding returned a coordinate result.",
      metadata: {
        address,
        latitude,
        longitude,
        matchedAddress: firstAddress?.roadAddress || firstAddress?.jibunAddress,
      },
      requestCount: 1,
      status: "success",
    });

    return { latitude, longitude };
  } catch (error) {
    await recordApiLog({
      action: "geocode",
      category: "geocoding",
      level: "error",
      message: error instanceof Error ? error.message : String(error),
      metadata: { address },
      requestCount: 1,
      status: "failure",
    });
    throw error;
  }
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T) => Promise<R>,
) {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(items[currentIndex]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker()),
  );

  return results;
}

async function importFireStations(): Promise<ImportResult> {
  const csv = await downloadCsv("fire-stations");
  const fetchedAt = new Date().toISOString();
  const rows = parseCsv(csv);
  const points = rows
    .map(mapFireRecord)
    .filter((point): point is EmergencyPointInput => point !== null);
  const skippedCount = rows.length - points.length;

  return {
    failedCount: points.filter(
      (point) => point.latitude === null || point.longitude === null,
    ).length,
    fetchedAt,
    geocodedCount: points.filter(
      (point) => point.latitude !== null && point.longitude !== null,
    ).length,
    points,
    skippedCount,
  };
}

async function importPoliceStations(): Promise<ImportResult> {
  const csv = await downloadCsv("police-stations");
  const fetchedAt = new Date().toISOString();
  const rows = parseCsv(csv);
  let failedCount = 0;
  let geocodedCount = 0;
  const coordinates = await mapWithConcurrency(
    rows,
    GEOCODE_CONCURRENCY,
    async (record) => {
      const coordinate = await geocodeAddress(text(record.주소));

      if (coordinate) {
        geocodedCount += 1;
      } else {
        failedCount += 1;
      }

      return coordinate;
    },
  );
  const points = rows
    .map((record, index) => mapPoliceRecord(record, coordinates[index]))
    .filter((point): point is EmergencyPointInput => point !== null);
  const skippedCount = rows.length - points.length;

  return {
    failedCount,
    fetchedAt,
    geocodedCount,
    points,
    skippedCount,
  };
}

async function importAeds(): Promise<ImportResult> {
  const firstPage = await fetchAedPage(1);
  const totalCount = Number.isFinite(firstPage.totalCount)
    ? firstPage.totalCount
    : firstPage.items.length;
  const pageCount = Math.max(1, Math.ceil(totalCount / AED_NUM_OF_ROWS));
  const pages = [firstPage];

  for (let pageNo = 2; pageNo <= pageCount; pageNo += 1) {
    pages.push(await fetchAedPage(pageNo));
  }

  const fetchedAt = new Date().toISOString();
  const rows = pages.flatMap((page) => page.items);
  const points = rows
    .map(mapAedRecord)
    .filter((point): point is EmergencyPointInput => point !== null);
  const skippedCount = rows.length - points.length;

  return {
    failedCount: points.filter(
      (point) => point.latitude === null || point.longitude === null,
    ).length,
    fetchedAt,
    geocodedCount: points.filter(
      (point) => point.latitude !== null && point.longitude !== null,
    ).length,
    points,
    skippedCount,
  };
}

export async function updateDataset(source: DatasetSourceId) {
  try {
    await recordApiLog({
      action: "dataset-update",
      category: "dataset",
      level: "info",
      message: `Dataset update started: ${source}`,
      source,
      status: "success",
    });

    const result =
      source === "fire-stations"
        ? await importFireStations()
        : source === "police-stations"
          ? await importPoliceStations()
          : await importAeds();

    const dataset = await replaceDataset({
      ...result,
      source,
    });

    await recordApiLog({
      action: "dataset-update",
      category: "dataset",
      level: "info",
      message: `Dataset update completed: ${source}`,
      metadata: {
        failedCount: dataset.failedCount,
        geocodedCount: dataset.geocodedCount,
        importedCount: dataset.importedCount,
        skippedCount: dataset.skippedCount,
      },
      source,
      status: "success",
    });

    return dataset;
  } catch (error) {
    await recordDatasetError(source, error);
    await recordApiLog({
      action: "dataset-update",
      category: "dataset",
      level: "error",
      message: error instanceof Error ? error.message : String(error),
      source,
      status: "failure",
    });
    throw error;
  }
}

export async function updateAllDatasets() {
  const results: DatasetUpdateResult[] = [];

  for (const source of Object.keys(DATASET_SOURCES) as DatasetSourceId[]) {
    results.push(await updateDataset(source));
  }

  return results;
}
