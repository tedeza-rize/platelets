import https from "node:https";
import { parse } from "csv-parse/sync";
import { DATASET_SOURCES, type DatasetSourceId } from "@/lib/dataset-sources";
import {
  type DatasetUpdateResult,
  type EmergencyPointInput,
  recordDatasetError,
  replaceDataset,
} from "@/lib/points-db";

type CsvRecord = Record<string, string | undefined>;

type ImportResult = {
  failedCount: number;
  fetchedAt: string;
  geocodedCount: number;
  points: EmergencyPointInput[];
  skippedCount: number;
};

type VworldAddressResponse = {
  response?: {
    result?: {
      point?: {
        x?: string;
        y?: string;
      };
    };
    status?: string;
  };
};

const CSV_ENCODING = "euc-kr";
const GEOCODE_CONCURRENCY = 4;
const DOWNLOAD_RETRY_COUNT = 3;

function text(value: string | undefined) {
  return value?.trim() ?? "";
}

function nullableText(value: string | undefined) {
  const trimmed = text(value);
  return trimmed.length > 0 ? trimmed : null;
}

function toNumber(value: string | undefined) {
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

function parseCsv(csv: string) {
  return parse(csv, {
    bom: true,
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as CsvRecord[];
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

function compactRecord(record: CsvRecord) {
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [key, text(value)]),
  );
}

async function geocodeAddress(address: string) {
  const key =
    process.env.VWORLD_API_KEY ?? process.env.NEXT_PUBLIC_VWORLD_API_KEY;

  if (!key || !address) {
    return null;
  }

  for (const type of ["road", "parcel"]) {
    const url = new URL("https://api.vworld.kr/req/address");
    url.searchParams.set("service", "address");
    url.searchParams.set("request", "getcoord");
    url.searchParams.set("format", "json");
    url.searchParams.set("crs", "epsg:4326");
    url.searchParams.set("type", type);
    url.searchParams.set("address", address);
    url.searchParams.set("key", key);

    const response = await fetch(url, { cache: "no-store" });

    if (!response.ok) {
      continue;
    }

    const payload = (await response.json()) as VworldAddressResponse;
    const point = payload.response?.result?.point;
    const longitude = Number(point?.x);
    const latitude = Number(point?.y);

    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      return { latitude, longitude };
    }
  }

  return null;
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

export async function updateDataset(source: DatasetSourceId) {
  try {
    const result =
      source === "fire-stations"
        ? await importFireStations()
        : await importPoliceStations();

    return replaceDataset({
      ...result,
      source,
    });
  } catch (error) {
    await recordDatasetError(source, error);
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
