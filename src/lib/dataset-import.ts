import https from "node:https";
import { parse } from "csv-parse/sync";
import { XMLParser } from "fast-xml-parser";
import type { DatasetProgressReporter } from "@/lib/dataset-progress";
import { DATASET_SOURCES, type DatasetSourceId } from "@/lib/dataset-sources";
import {
  importChildcareCenters,
  importEmergencyMedicalInstitutions,
  importHospitals,
  importPharmacies,
} from "@/lib/medical-dataset-import";
import {
  clearDatasetImportProgress,
  consumeKakaoLocalQuota,
  type DatasetImportCheckpoint,
  type DatasetImportMode,
  type DatasetUpdateResult,
  type EmergencyPointInput,
  getDatasetImportCheckpoint,
  getDatasetStatus,
  recordApiLog,
  recordDatasetError,
  replaceDataset,
  saveDatasetImportProgress,
  setDatasetUpdateProgress,
} from "@/lib/points-db";
import { getPublicDataApiKey } from "@/lib/public-data";
import { parseFirstWorksheetRows } from "@/lib/xlsx-lite";

type CsvRecord = Record<string, unknown>;
type AedRecord = Record<string, unknown>;
type SchoolRecord = Record<string, unknown>;
type UniversityRecord = Record<string, unknown>;

type ImportResult = {
  failedCount: number;
  fetchedAt: string;
  geocodedCount: number;
  points: EmergencyPointInput[];
  skippedCount: number;
};

type DatasetUpdateOptions = {
  mode?: DatasetImportMode;
};

type KakaoAddressSearchResponse = {
  documents?: Array<{
    address?: {
      address_name?: string;
    } | null;
    address_name?: string;
    road_address?: {
      address_name?: string;
    } | null;
    x?: string;
    y?: string;
  }>;
  meta?: {
    is_end?: boolean;
    pageable_count?: number;
    total_count?: number;
  };
  errorType?: string;
  message?: string;
};

const CSV_ENCODING = "euc-kr";
const AED_NUM_OF_ROWS = 10_000;
const DOWNLOAD_RETRY_COUNT = 3;
const SCHOOL_NUM_OF_ROWS = 10_000;
const SCHOOL_TOTAL_COUNT_HINT = 12_011;
const UNIVERSITY_SOURCE_UPDATED_AT = "2025-11-26";
const SCHOOL_COLUMN_NAMES = [
  "SCHOOL_ID",
  "SCHOOL_NM",
  "SCHOOL_SE",
  "FOND_DATE",
  "FOND_TYPE",
  "BNHH_SE",
  "OPER_STTUS",
  "LNMADR",
  "RDNMADR",
  "CDDC_CODE",
  "CDDC_NM",
  "EDC_SPORT",
  "EDC_SPORT_NM",
  "CREAT_DATE",
  "CHANGE_DATE",
  "LATITUDE",
  "LONGITUDE",
  "REFERENCE_DATE",
] as const;

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

export class DatasetImportPausedError extends Error {
  source: DatasetSourceId;

  constructor(source: DatasetSourceId, message: string) {
    super(message);
    this.name = "DatasetImportPausedError";
    this.source = source;
  }
}

function isQuotaExceededError(error: unknown) {
  return (
    error instanceof Error &&
    error.message.toLowerCase().includes("quota exceeded")
  );
}

async function fetchWithRetry(url: string, source: DatasetSourceId) {
  let lastError: unknown;

  for (let attempt = 1; attempt <= DOWNLOAD_RETRY_COUNT; attempt += 1) {
    try {
      const response = await fetch(url, {
        cache: "no-store",
        headers: {
          "User-Agent": "platelets/0.1",
        },
      });

      await recordApiLog({
        action: "dataset-download",
        category: "dataset",
        level: response.ok ? "info" : "error",
        message: response.ok
          ? `Dataset download completed: ${source}`
          : `Dataset download failed with HTTP ${response.status}: ${source}`,
        metadata: {
          attempt,
          statusCode: response.status,
          url,
        },
        requestCount: 1,
        source,
        status: response.ok ? "success" : "failure",
      });

      if (!response.ok) {
        throw new Error(`Dataset download failed (${response.status})`);
      }

      return response;
    } catch (error) {
      lastError = error;
      await wait(200 * attempt);
    }
  }

  throw lastError;
}

async function downloadBufferFromUrl(url: string, source: DatasetSourceId) {
  const response = await fetchWithRetry(url, source);

  return Buffer.from(await response.arrayBuffer());
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

function getKakaoRestApiKey() {
  return (
    process.env.KAKAO_REST_API_KEY?.trim() ??
    process.env.KAKAO_LOCAL_REST_API_KEY?.trim() ??
    null
  );
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

function buildSchoolPageUrl(page: number) {
  const url = new URL(DATASET_SOURCES.schools.url);

  for (const column of SCHOOL_COLUMN_NAMES) {
    url.searchParams.append("colNmList", column);
  }

  url.searchParams.set("totalCount", String(SCHOOL_TOTAL_COUNT_HINT));
  url.searchParams.set("perPage", String(SCHOOL_NUM_OF_ROWS));
  url.searchParams.set("page", String(page));

  return url.toString();
}

async function fetchSchoolPage(page: number) {
  const response = await fetchWithRetry(buildSchoolPageUrl(page), "schools");
  const payload = (await response.json()) as unknown;

  if (!Array.isArray(payload)) {
    throw new Error("School dataset returned an unexpected JSON payload.");
  }

  return payload as SchoolRecord[];
}

function worksheetRowsToRecords(rows: string[][]) {
  const [headerRow, ...dataRows] = rows;

  if (!headerRow) {
    return [];
  }

  const headers = headerRow.map((header) =>
    header.replace(/_x000D_\n/g, "").trim(),
  );

  return dataRows.map(
    (row) =>
      Object.fromEntries(
        headers.map((header, index) => [header, row[index]?.trim() ?? ""]),
      ) as UniversityRecord,
  );
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

  if (!sourceRecordId || !station || !coordinates) {
    return null;
  }

  return {
    address: text(record.주소),
    category,
    latitude: coordinates.latitude,
    longitude: coordinates.longitude,
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

function mapSchoolRecord(record: SchoolRecord): EmergencyPointInput | null {
  const sourceRecordId = text(record.SCHOOL_ID);
  const name = text(record.SCHOOL_NM);

  if (!sourceRecordId || !name) {
    return null;
  }

  return {
    address: text(record.RDNMADR) || text(record.LNMADR),
    category: text(record.SCHOOL_SE) || "학교",
    latitude: toNumber(record.LATITUDE),
    longitude: toNumber(record.LONGITUDE),
    name,
    parentName:
      nullableText(record.EDC_SPORT_NM) ?? nullableText(record.CDDC_NM),
    phone: null,
    raw: compactRecord(record),
    source: "schools",
    sourceRecordId,
    sourceUpdatedAt:
      nullableText(record.REFERENCE_DATE) ?? nullableText(record.CHANGE_DATE),
  };
}

function mapUniversityRecord(
  record: UniversityRecord,
): EmergencyPointInput | null {
  const sourceRecordId = text(record.학교코드변환) || text(record.학교코드);
  const name = text(record.학교명);

  if (!sourceRecordId || !name) {
    return null;
  }

  return {
    address:
      text(record["도로명 주소"]) ||
      text(record.도로명주소) ||
      text(record.지번주소),
    category: text(record.학제) || text(record.학교구분) || "대학교",
    latitude: toNumber(record.위도),
    longitude: toNumber(record.경도),
    name,
    parentName:
      nullableText(
        [record.지역, record.설립구분, record.본분교]
          .map(text)
          .filter(Boolean)
          .join(" / "),
      ) ?? nullableText(record.법인명),
    phone: nullableText(record.학교대표번호),
    raw: compactRecord(record),
    source: "universities",
    sourceRecordId,
    sourceUpdatedAt: UNIVERSITY_SOURCE_UPDATED_AT,
  };
}

function compactRecord(record: CsvRecord) {
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [key, text(value)]),
  );
}

async function geocodeAddress(address: string) {
  const restApiKey = getKakaoRestApiKey();

  if (!address) {
    return null;
  }

  if (!restApiKey) {
    await recordApiLog({
      action: "geocode",
      category: "geocoding",
      level: "warn",
      message: "Kakao Local geocoding skipped because REST API key is missing.",
      metadata: { address },
      status: "skipped",
    });
    return null;
  }

  await consumeKakaoLocalQuota();

  const url = new URL("https://dapi.kakao.com/v2/local/search/address.json");
  url.searchParams.set("query", address);
  url.searchParams.set("size", "1");

  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: {
        Accept: "application/json",
        Authorization: `KakaoAK ${restApiKey}`,
      },
    });

    if (!response.ok) {
      await recordApiLog({
        action: "geocode",
        category: "geocoding",
        level: "error",
        message: `Kakao Local geocoding failed with HTTP ${response.status}.`,
        metadata: {
          address,
          kakaoHint:
            response.status === 401 || response.status === 403
              ? "Check KAKAO_REST_API_KEY and Kakao Map/Local API activation for the app."
              : null,
          statusCode: response.status,
          usedHeaders: ["Authorization: KakaoAK"],
        },
        requestCount: 1,
        status: "failure",
      });
      return null;
    }

    const payload = (await response.json()) as KakaoAddressSearchResponse;
    const firstAddress = payload.documents?.[0];
    const longitude = Number(firstAddress?.x);
    const latitude = Number(firstAddress?.y);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      await recordApiLog({
        action: "geocode",
        category: "geocoding",
        level: "warn",
        message: "Kakao Local geocoding returned no coordinate result.",
        metadata: {
          address,
          errorMessage: payload.message,
          errorType: payload.errorType,
          totalCount: payload.meta?.total_count,
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
      message: "Kakao Local geocoding returned a coordinate result.",
      metadata: {
        address,
        latitude,
        longitude,
        matchedAddress:
          firstAddress?.road_address?.address_name ??
          firstAddress?.address?.address_name ??
          firstAddress?.address_name,
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

function countGeocoded(points: EmergencyPointInput[]) {
  return points.filter(
    (point) => point.latitude !== null && point.longitude !== null,
  ).length;
}

function buildImportCheckpoint(params: {
  fetchedAt: string;
  mode: DatasetImportMode;
  nextIndex: number;
  points: EmergencyPointInput[];
  reason: string | null;
  skippedCount: number;
  startedAt: string;
  status: DatasetImportCheckpoint["status"];
  totalCount: number;
}): DatasetImportCheckpoint {
  const geocodedCount = countGeocoded(params.points);

  return {
    failedCount: params.points.length - geocodedCount,
    fetchedAt: params.fetchedAt,
    geocodedCount,
    importedCount: params.points.length,
    mode: params.mode,
    nextIndex: params.nextIndex,
    points: params.points,
    reason: params.reason,
    skippedCount: params.skippedCount,
    source: "police-stations",
    startedAt: params.startedAt,
    status: params.status,
    totalCount: params.totalCount,
    updatedAt: new Date().toISOString(),
  };
}

async function savePoliceProgress(params: {
  fetchedAt: string;
  mode: DatasetImportMode;
  nextIndex: number;
  points: EmergencyPointInput[];
  reason: string | null;
  skippedCount: number;
  startedAt: string;
  status: DatasetImportCheckpoint["status"];
  totalCount: number;
}) {
  return saveDatasetImportProgress(buildImportCheckpoint(params));
}

async function importFireStations(
  report: DatasetProgressReporter,
): Promise<ImportResult> {
  await report("requesting", 10, "소방 좌표 CSV를 요청하고 있습니다.");
  const csv = await downloadCsv("fire-stations");
  await report("receiving", 38, "원본 CSV 응답을 받았습니다.");
  const fetchedAt = new Date().toISOString();
  const rows = parseCsv(csv);
  const points = rows
    .map(mapFireRecord)
    .filter((point): point is EmergencyPointInput => point !== null);
  const skippedCount = rows.length - points.length;
  await report("processing", 68, "소방 좌표를 정규화했습니다.");

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

async function importPoliceStations(
  mode: DatasetImportMode,
  report: DatasetProgressReporter,
): Promise<ImportResult> {
  await report("requesting", 10, "경찰관서 CSV를 요청하고 있습니다.");
  const csv = await downloadCsv("police-stations");
  await report("receiving", 30, "원본 CSV 응답을 받았습니다.");
  const rows = parseCsv(csv);
  const existing =
    mode === "resume"
      ? await getDatasetImportCheckpoint("police-stations")
      : null;
  const fetchedAt = existing?.fetchedAt ?? new Date().toISOString();
  const startedAt = existing?.startedAt ?? fetchedAt;
  const points = existing?.points ?? [];
  let skippedCount = existing?.skippedCount ?? 0;
  const startIndex = Math.min(existing?.nextIndex ?? 0, rows.length);

  if (mode === "restart") {
    await clearDatasetImportProgress("police-stations");
  }

  await savePoliceProgress({
    fetchedAt,
    mode,
    nextIndex: startIndex,
    points,
    reason: null,
    skippedCount,
    startedAt,
    status: "running",
    totalCount: rows.length,
  });

  for (let index = startIndex; index < rows.length; index += 1) {
    const record = rows[index];

    try {
      const coordinates = await geocodeAddress(text(record.주소));
      const point = mapPoliceRecord(record, coordinates);

      if (point) {
        points.push(point);
      } else {
        skippedCount += 1;
      }
    } catch (error) {
      if (!isQuotaExceededError(error)) {
        throw error;
      }

      const reason =
        "Kakao Local API daily request quota exceeded. 다음 리셋 이후 이어서 할 수 있습니다.";
      await savePoliceProgress({
        fetchedAt,
        mode,
        nextIndex: index,
        points,
        reason,
        skippedCount,
        startedAt,
        status: "paused",
        totalCount: rows.length,
      });
      throw new DatasetImportPausedError("police-stations", reason);
    }

    if ((index + 1) % 25 === 0 || index + 1 === rows.length) {
      await report(
        "processing",
        35 + Math.round(((index + 1) / Math.max(rows.length, 1)) * 33),
        `주소 좌표 변환 ${index + 1}/${rows.length}`,
      );
      await savePoliceProgress({
        fetchedAt,
        mode,
        nextIndex: index + 1,
        points,
        reason: null,
        skippedCount,
        startedAt,
        status: "running",
        totalCount: rows.length,
      });
    }
  }

  const geocodedCount = countGeocoded(points);

  return {
    failedCount: points.length - geocodedCount,
    fetchedAt,
    geocodedCount,
    points,
    skippedCount,
  };
}

async function importAeds(
  report: DatasetProgressReporter,
): Promise<ImportResult> {
  await report("requesting", 10, "AED API 첫 페이지를 요청하고 있습니다.");
  const firstPage = await fetchAedPage(1);
  const totalCount = Number.isFinite(firstPage.totalCount)
    ? firstPage.totalCount
    : firstPage.items.length;
  const pageCount = Math.max(1, Math.ceil(totalCount / AED_NUM_OF_ROWS));
  const pages = [firstPage];

  for (let pageNo = 2; pageNo <= pageCount; pageNo += 1) {
    pages.push(await fetchAedPage(pageNo));
    await report(
      "receiving",
      15 + Math.round((pageNo / pageCount) * 35),
      `AED 응답 ${pageNo}/${pageCount} 페이지 수신`,
    );
  }

  const fetchedAt = new Date().toISOString();
  const rows = pages.flatMap((page) => page.items);
  const points = rows
    .map(mapAedRecord)
    .filter((point): point is EmergencyPointInput => point !== null);
  const skippedCount = rows.length - points.length;
  await report("processing", 68, "AED 위치와 연락처를 정규화했습니다.");

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

async function importSchools(
  report: DatasetProgressReporter,
): Promise<ImportResult> {
  const pages: SchoolRecord[][] = [];

  await report("requesting", 10, "학교 표준데이터를 요청하고 있습니다.");

  for (let page = 1; page <= 20; page += 1) {
    const rows = await fetchSchoolPage(page);
    pages.push(rows);
    await report(
      "receiving",
      Math.min(50, 12 + page * 4),
      `학교 데이터 ${page} 페이지 수신`,
    );

    if (rows.length < SCHOOL_NUM_OF_ROWS) {
      break;
    }
  }

  const fetchedAt = new Date().toISOString();
  const rows = pages.flat();
  const points = rows
    .map(mapSchoolRecord)
    .filter((point): point is EmergencyPointInput => point !== null);
  const geocodedCount = countGeocoded(points);
  await report("processing", 68, "학교 좌표를 정규화했습니다.");

  return {
    failedCount: points.length - geocodedCount,
    fetchedAt,
    geocodedCount,
    points,
    skippedCount: rows.length - points.length,
  };
}

async function importUniversities(
  report: DatasetProgressReporter,
): Promise<ImportResult> {
  await report("requesting", 10, "대학교 좌표 XLSX를 요청하고 있습니다.");
  const buffer = await downloadBufferFromUrl(
    DATASET_SOURCES.universities.url,
    "universities",
  );
  await report("receiving", 40, "대학교 XLSX 응답을 받았습니다.");
  const fetchedAt = new Date().toISOString();
  const rows = worksheetRowsToRecords(parseFirstWorksheetRows(buffer));
  const points = rows
    .map(mapUniversityRecord)
    .filter((point): point is EmergencyPointInput => point !== null);
  const geocodedCount = countGeocoded(points);
  await report("processing", 68, "대학교 워크시트를 정규화했습니다.");

  return {
    failedCount: points.length - geocodedCount,
    fetchedAt,
    geocodedCount,
    points,
    skippedCount: rows.length - points.length,
  };
}

async function importDataset(
  source: DatasetSourceId,
  mode: DatasetImportMode,
  report: DatasetProgressReporter,
) {
  switch (source) {
    case "fire-stations":
      return importFireStations(report);
    case "police-stations":
      return importPoliceStations(mode, report);
    case "aeds":
      return importAeds(report);
    case "childcare-centers":
      return importChildcareCenters(report);
    case "pharmacies":
      return importPharmacies(report);
    case "hospitals":
      return importHospitals(report);
    case "emergency-medical-institutions":
      return importEmergencyMedicalInstitutions(report);
    case "schools":
      return importSchools(report);
    case "universities":
      return importUniversities(report);
  }
}

export async function updateDataset(
  source: DatasetSourceId,
  options: DatasetUpdateOptions = {},
) {
  const mode = options.mode ?? "restart";
  const report: DatasetProgressReporter = async (stage, percent, message) => {
    await setDatasetUpdateProgress({
      message,
      percent,
      source,
      stage,
      status:
        stage === "failed"
          ? "failed"
          : stage === "completed"
            ? "completed"
            : "running",
    });
  };

  try {
    await report("preparing", 2, "업데이트 작업을 준비하고 있습니다.");
    await recordApiLog({
      action: "dataset-update",
      category: "dataset",
      level: "info",
      message: `Dataset update started: ${source}`,
      metadata: { mode },
      source,
      status: "success",
    });

    const result = await importDataset(source, mode, report);

    await report(
      "saving",
      76,
      `${result.points.length.toLocaleString("ko-KR")}건을 DB에 저장하고 있습니다.`,
    );
    const dataset = await replaceDataset({
      ...result,
      source,
    });
    await report("saving", 97, "저장 결과를 검증하고 있습니다.");

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

    await report("completed", 100, "데이터 저장이 완료되었습니다.");

    return {
      ...(await getDatasetStatus(source)),
      importedCount: dataset.importedCount,
    };
  } catch (error) {
    await report(
      "failed",
      100,
      error instanceof Error ? error.message : String(error),
    );
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
    results.push(await updateDataset(source, { mode: "restart" }));
  }

  return results;
}
