import fs from "node:fs";
import https from "node:https";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { XMLParser } from "fast-xml-parser";
import type { DatasetProgressReporter } from "@/lib/dataset-progress";
import { DATASET_SOURCES, type DatasetSourceId } from "@/lib/dataset-sources";
import { geocodeAddress } from "@/lib/geocoding";
import {
  importChildcareCenters,
  importEmergencyMedicalInstitutions,
  importHospitals,
  importPharmacies,
} from "@/lib/medical-dataset-import";
import {
  clearDatasetImportProgress,
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

type BigData119FireSafetyTargetSource =
  | "fire-safety-targets"
  | "busan-fire-safety-targets";
type BigData119FireWaterSource =
  | "fire-water-sources"
  | "busan-fire-water-sources";
type BigData119PointSource =
  | BigData119FireSafetyTargetSource
  | BigData119FireWaterSource;

const CSV_ENCODING = "euc-kr";
const AED_NUM_OF_ROWS = 10_000;
const DOWNLOAD_RETRY_COUNT = 3;
const SCHOOL_NUM_OF_ROWS = 10_000;
const SCHOOL_TOTAL_COUNT_HINT = 12_011;
const UNIVERSITY_SOURCE_UPDATED_AT = "2025-11-26";
const BIGDATA119_DATA_DIR = path.join(
  /*turbopackIgnore: true*/ process.cwd(),
  "data",
  "bigdata-119",
);
const BIGDATA119_TARGET_FILE_CANDIDATES = [
  "seoul-fire-safety-targets.csv",
  "서울소방재난본부_특정소방대상물 현황.csv",
  "특정소방대상물_2024.csv",
  "특정소방대상물 현황.csv",
];
const BIGDATA119_WATER_FILE_CANDIDATES = [
  "seoul-fire-water-sources.csv",
  "서울소방재난본부_소방용수 현황.csv",
  "소방용수_2024.csv",
  "소방용수 현황.csv",
];
const BIGDATA119_BUSAN_TARGET_FILE_CANDIDATES = [
  "busan-fire-safety-targets.csv",
  "부산소방재난본부_특정소방대상물 현황_2025_부산.csv",
  "부산소방재난본부_특정소방대상물 현황.csv",
  "부산_특정소방대상물_2025.csv",
  "특정소방대상물_2023.csv",
];
const BIGDATA119_BUSAN_WATER_FILE_CANDIDATES = [
  "busan-fire-water-sources.csv",
  "부산소방재난본부_소방용수 현황_2025_부산.csv",
  "부산소방재난본부_소방용수 현황.csv",
  "부산_소방용수_2025.csv",
  "소방용수_2023.csv",
];
const LATITUDE_FIELDS = [
  "위도",
  "위도좌표",
  "WGS84위도",
  "latitude",
  "Latitude",
  "LATITUDE",
  "lat",
  "LAT",
  "y",
  "Y",
  "Y좌표",
  "wgs84_lat",
  "wgs84Lat",
];
const LONGITUDE_FIELDS = [
  "경도",
  "경도좌표",
  "WGS84경도",
  "longitude",
  "Longitude",
  "LONGITUDE",
  "lon",
  "lng",
  "LON",
  "LNG",
  "x",
  "X",
  "X좌표",
  "wgs84_lon",
  "wgs84Lon",
];
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

const BIGDATA119_TARGET_FALLBACK_ROWS: CsvRecord[] = [
  {
    _platelets_sample: "true",
    bdst_sn: "sample-fst-001",
    bdst_usg_nm: "업무시설",
    bldg_nm: "서울시청 본관",
    cntr_nm: "현장대응단",
    conm_addr: "서울특별시 중구 세종대로 110",
    frstn_nm: "중부소방서",
    grnds_ctpv_nm: "서울특별시",
    grnds_sgg_nm: "중구",
    latitude: "37.5665",
    longitude: "126.9780",
    trgtobj_nm: "서울시청 본관",
    trgtobj_se_nm: "일반대상물",
  },
  {
    _platelets_sample: "true",
    bdst_sn: "sample-fst-002",
    bdst_usg_nm: "문화재",
    bldg_nm: "숭례문",
    cntr_nm: "회현119안전센터",
    conm_addr: "서울특별시 중구 세종대로 40",
    frstn_nm: "중부소방서",
    grnds_ctpv_nm: "서울특별시",
    grnds_sgg_nm: "중구",
    latitude: "37.55998",
    longitude: "126.97531",
    trgtobj_nm: "숭례문",
    trgtobj_se_nm: "2급대상",
  },
  {
    _platelets_sample: "true",
    bdst_sn: "sample-fst-003",
    bdst_usg_nm: "복합건축물",
    bldg_nm: "동대문디자인플라자",
    cntr_nm: "을지로119안전센터",
    conm_addr: "서울특별시 중구 을지로 281",
    frstn_nm: "중부소방서",
    grnds_ctpv_nm: "서울특별시",
    grnds_sgg_nm: "중구",
    latitude: "37.56648",
    longitude: "127.00954",
    trgtobj_nm: "동대문디자인플라자",
    trgtobj_se_nm: "일반대상물",
  },
];

const BIGDATA119_WATER_FALLBACK_ROWS: CsvRecord[] = [
  {
    _platelets_sample: "true",
    cntr_nm: "회현119안전센터",
    frstn_nm: "중부소방서",
    fruswtr_se_nm: "소화전",
    grnds_ctpv_nm: "서울특별시",
    grnds_sgg_nm: "중구",
    hnum_nm: "110",
    latitude: "37.56583",
    longitude: "126.97722",
    nghb_bldg_nm: "서울시청 인근",
    pipe_calbr_vl: "100",
    road_nm: "세종대로",
    road_nm_addr: "서울특별시 중구 세종대로 110",
    sn: "sample-fws-001",
    stts_se_nm: "양호",
    wtrprsr_vl: "3.2",
  },
  {
    _platelets_sample: "true",
    cntr_nm: "회현119안전센터",
    frstn_nm: "중부소방서",
    fruswtr_se_nm: "소화전",
    grnds_ctpv_nm: "서울특별시",
    grnds_sgg_nm: "중구",
    hnum_nm: "40",
    latitude: "37.56027",
    longitude: "126.97507",
    nghb_bldg_nm: "숭례문 인근",
    pipe_calbr_vl: "100",
    road_nm: "세종대로",
    road_nm_addr: "서울특별시 중구 세종대로 40",
    sn: "sample-fws-002",
    stts_se_nm: "양호",
    wtrprsr_vl: "2.8",
  },
  {
    _platelets_sample: "true",
    cntr_nm: "을지로119안전센터",
    frstn_nm: "중부소방서",
    fruswtr_se_nm: "저수조",
    grnds_ctpv_nm: "서울특별시",
    grnds_sgg_nm: "중구",
    hnum_nm: "281",
    latitude: "37.56602",
    longitude: "127.00889",
    nghb_bldg_nm: "동대문디자인플라자",
    pipe_calbr_vl: "150",
    road_nm: "을지로",
    road_nm_addr: "서울특별시 중구 을지로 281",
    sn: "sample-fws-003",
    stts_se_nm: "양호",
    wtrprsr_vl: "3.5",
  },
];

const BIGDATA119_BUSAN_TARGET_FALLBACK_ROWS: CsvRecord[] = [
  {
    _platelets_sample: "true",
    bdst_sn: "sample-busan-fst-001",
    bdst_usg_nm: "업무시설",
    bldg_nm: "부산광역시청",
    cntr_nm: "연산119안전센터",
    conm_addr: "부산광역시 연제구 중앙대로 1001",
    frstn_nm: "동래소방서",
    grnds_ctpv_nm: "부산광역시",
    grnds_sgg_nm: "연제구",
    latitude: "35.17982",
    longitude: "129.07508",
    trgtobj_nm: "부산광역시청",
    trgtobj_se_nm: "공공업무시설",
  },
  {
    _platelets_sample: "true",
    bdst_sn: "sample-busan-fst-002",
    bdst_usg_nm: "운수시설",
    bldg_nm: "부산역",
    cntr_nm: "초량119안전센터",
    conm_addr: "부산광역시 동구 중앙대로 206",
    frstn_nm: "부산진소방서",
    grnds_ctpv_nm: "부산광역시",
    grnds_sgg_nm: "동구",
    latitude: "35.11518",
    longitude: "129.04109",
    trgtobj_nm: "부산역",
    trgtobj_se_nm: "다중이용시설",
  },
  {
    _platelets_sample: "true",
    bdst_sn: "sample-busan-fst-003",
    bdst_usg_nm: "문화및집회시설",
    bldg_nm: "벡스코",
    cntr_nm: "우동119안전센터",
    conm_addr: "부산광역시 해운대구 APEC로 55",
    frstn_nm: "해운대소방서",
    grnds_ctpv_nm: "부산광역시",
    grnds_sgg_nm: "해운대구",
    latitude: "35.16949",
    longitude: "129.13661",
    trgtobj_nm: "벡스코",
    trgtobj_se_nm: "다중이용시설",
  },
];

const BIGDATA119_BUSAN_WATER_FALLBACK_ROWS: CsvRecord[] = [
  {
    _platelets_sample: "true",
    cntr_nm: "연산119안전센터",
    frstn_nm: "동래소방서",
    fruswtr_se_nm: "소화전",
    grnds_ctpv_nm: "부산광역시",
    grnds_sgg_nm: "연제구",
    hnum_nm: "1001",
    latitude: "35.18022",
    longitude: "129.07464",
    nghb_bldg_nm: "부산광역시청 인근",
    pipe_calbr_vl: "100",
    road_nm: "중앙대로",
    road_nm_addr: "부산광역시 연제구 중앙대로 1001",
    sn: "sample-busan-fws-001",
    stts_se_nm: "사용가",
    wtrprsr_vl: "3.1",
  },
  {
    _platelets_sample: "true",
    cntr_nm: "초량119안전센터",
    frstn_nm: "부산진소방서",
    fruswtr_se_nm: "소화전",
    grnds_ctpv_nm: "부산광역시",
    grnds_sgg_nm: "동구",
    hnum_nm: "206",
    latitude: "35.11555",
    longitude: "129.04149",
    nghb_bldg_nm: "부산역 광장",
    pipe_calbr_vl: "100",
    road_nm: "중앙대로",
    road_nm_addr: "부산광역시 동구 중앙대로 206",
    sn: "sample-busan-fws-002",
    stts_se_nm: "사용가",
    wtrprsr_vl: "2.9",
  },
  {
    _platelets_sample: "true",
    cntr_nm: "우동119안전센터",
    frstn_nm: "해운대소방서",
    fruswtr_se_nm: "저수조",
    grnds_ctpv_nm: "부산광역시",
    grnds_sgg_nm: "해운대구",
    hnum_nm: "55",
    latitude: "35.16902",
    longitude: "129.13618",
    nghb_bldg_nm: "벡스코",
    pipe_calbr_vl: "150",
    road_nm: "APEC로",
    road_nm_addr: "부산광역시 해운대구 APEC로 55",
    sn: "sample-busan-fws-003",
    stts_se_nm: "사용가",
    wtrprsr_vl: "3.4",
  },
];

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

function parseCsv(csv: string) {
  return parse(csv, {
    bom: true,
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as CsvRecord[];
}

function decodeLocalCsvBuffer(buffer: Buffer) {
  const utf8 = new TextDecoder("utf-8").decode(buffer);
  const utf8ReplacementCount = (utf8.match(/\uFFFD/g) ?? []).length;

  if (utf8ReplacementCount === 0) {
    return utf8;
  }

  const eucKr = new TextDecoder(CSV_ENCODING).decode(buffer);
  const eucKrReplacementCount = (eucKr.match(/\uFFFD/g) ?? []).length;

  return eucKrReplacementCount < utf8ReplacementCount ? eucKr : utf8;
}

function findBigData119CsvFile(candidates: readonly string[]) {
  if (!fs.existsSync(/* turbopackIgnore: true */ BIGDATA119_DATA_DIR)) {
    return null;
  }

  for (const fileName of candidates) {
    const filePath = path.join(
      /* turbopackIgnore: true */ BIGDATA119_DATA_DIR,
      fileName,
    );

    if (fs.existsSync(/* turbopackIgnore: true */ filePath)) {
      return { fileName, filePath };
    }
  }

  const keywords = candidates
    .map((candidate) => candidate.replace(/\.csv$/i, ""))
    .filter((candidate) => candidate.length > 0);
  const files = fs
    .readdirSync(/* turbopackIgnore: true */ BIGDATA119_DATA_DIR)
    .filter((fileName) => fileName.toLowerCase().endsWith(".csv"));
  const matchedFileName = files.find((fileName) =>
    keywords.some((keyword) => fileName.includes(keyword)),
  );

  return matchedFileName
    ? {
        fileName: matchedFileName,
        filePath: path.join(
          /* turbopackIgnore: true */ BIGDATA119_DATA_DIR,
          matchedFileName,
        ),
      }
    : null;
}

function readBigData119Csv(candidates: readonly string[]) {
  const file = findBigData119CsvFile(candidates);

  if (!file) {
    return null;
  }

  return {
    csv: decodeLocalCsvBuffer(
      fs.readFileSync(/* turbopackIgnore: true */ file.filePath),
    ),
    fileName: file.fileName,
  };
}

function field(record: CsvRecord, candidates: readonly string[]) {
  for (const candidate of candidates) {
    const direct = nullableText(record[candidate]);

    if (direct) {
      return direct;
    }

    const matchingKey = Object.keys(record).find(
      (key) => key.toLowerCase() === candidate.toLowerCase(),
    );
    const matched = matchingKey ? nullableText(record[matchingKey]) : null;

    if (matched) {
      return matched;
    }
  }

  return "";
}

function coordinateFromFields(
  record: CsvRecord,
  candidates: readonly string[],
) {
  const value = field(record, candidates);

  return value ? toNumber(value) : null;
}

function wgs84Coordinates(record: CsvRecord) {
  let latitude = coordinateFromFields(record, LATITUDE_FIELDS);
  let longitude = coordinateFromFields(record, LONGITUDE_FIELDS);

  if (
    latitude !== null &&
    longitude !== null &&
    Math.abs(latitude) > 90 &&
    Math.abs(longitude) <= 90
  ) {
    [latitude, longitude] = [longitude, latitude];
  }

  return { latitude, longitude };
}

function joinAddressParts(record: CsvRecord, candidates: readonly string[]) {
  return Array.from(
    new Set(
      candidates
        .map((candidate) => field(record, [candidate]))
        .filter((value) => value.length > 0),
    ),
  ).join(" ");
}

function sourceRecordIdFromRecord(
  record: CsvRecord,
  index: number,
  candidates: readonly string[],
  fallbackPrefix: string,
) {
  return field(record, candidates) || `${fallbackPrefix}-${index + 1}`;
}

async function fetchAedPage(pageNo: number) {
  const serviceKey = await getPublicDataApiKey();

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

function mapFireSafetyTargetRecord(
  record: CsvRecord,
  index: number,
  source: BigData119FireSafetyTargetSource = "fire-safety-targets",
): EmergencyPointInput | null {
  const coordinates = wgs84Coordinates(record);
  const address =
    field(record, [
      "conm_addr",
      "상호주소",
      "주소",
      "도로명주소",
      "소재지도로명주소",
      "road_nm_addr",
    ]) || joinAddressParts(record, ["grnds_ctpv_nm", "grnds_sgg_nm"]);
  const category =
    field(record, [
      "bdst_usg_nm",
      "건축물용도명",
      "용도",
      "주용도",
      "trgtobj_se_nm",
      "대상물구분명",
    ]) || "특정소방대상물";
  const targetName = field(record, [
    "trgtobj_nm",
    "대상물명",
    "bldg_nm",
    "건물명",
    "시설명",
    "명칭",
  ]);
  const sourceRecordId = sourceRecordIdFromRecord(
    record,
    index,
    ["bdst_sn", "건축물일련번호", "관리번호", "일련번호", "sn"],
    "fire-safety-target",
  );
  const name = targetName || `${category} ${sourceRecordId}`;

  if (!name) {
    return null;
  }

  return {
    address,
    category,
    latitude: coordinates.latitude,
    longitude: coordinates.longitude,
    name,
    parentName:
      nullableText(
        [
          field(record, ["frstn_nm", "소방서명", "관할소방서"]),
          field(record, ["cntr_nm", "센터명", "안전센터명"]),
        ]
          .filter(Boolean)
          .join(" / "),
      ) ?? null,
    phone: null,
    raw: compactRecord({
      ...record,
      데이터상품: DATASET_SOURCES[source].label,
      데이터상품URL: DATASET_SOURCES[source].url,
      데이터출처: "소방안전 빅데이터 플랫폼",
    }),
    source,
    sourceRecordId,
    sourceUpdatedAt: nullableText(
      field(record, [
        "기준일자",
        "등록일자",
        "수정일자",
        "data_crtr_ymd",
        "std_ymd",
      ]),
    ),
  };
}

function mapFireWaterSourceRecord(
  record: CsvRecord,
  index: number,
  source: BigData119FireWaterSource = "fire-water-sources",
): EmergencyPointInput | null {
  const coordinates = wgs84Coordinates(record);
  const address =
    field(record, [
      "road_nm_addr",
      "도로명주소",
      "주소",
      "소재지도로명주소",
      "conm_addr",
    ]) ||
    joinAddressParts(record, [
      "grnds_ctpv_nm",
      "grnds_sgg_nm",
      "emd_nm",
      "road_nm",
      "hnum_nm",
    ]);
  const category =
    field(record, [
      "fruswtr_se_nm",
      "소방용수구분명",
      "구분",
      "시설구분",
      "용수구분",
      "종류",
    ]) || "소방용수";
  const sourceRecordId = sourceRecordIdFromRecord(
    record,
    index,
    ["sn", "일련번호", "관리번호", "용수번호"],
    "fire-water-source",
  );
  const nearbyBuilding = field(record, [
    "nghb_bldg_nm",
    "인근건물명",
    "시설명",
    "소방용수명",
    "명칭",
  ]);
  const name = nearbyBuilding
    ? `${category} - ${nearbyBuilding}`
    : `${category} ${sourceRecordId}`;

  if (!name) {
    return null;
  }

  return {
    address,
    category,
    latitude: coordinates.latitude,
    longitude: coordinates.longitude,
    name,
    parentName:
      nullableText(
        [
          field(record, ["frstn_nm", "소방서명", "관할소방서"]),
          field(record, ["cntr_nm", "센터명", "안전센터명"]),
        ]
          .filter(Boolean)
          .join(" / "),
      ) ?? null,
    phone: null,
    raw: compactRecord({
      ...record,
      데이터상품: DATASET_SOURCES[source].label,
      데이터상품URL: DATASET_SOURCES[source].url,
      데이터출처: "소방안전 빅데이터 플랫폼",
    }),
    source,
    sourceRecordId,
    sourceUpdatedAt: nullableText(
      field(record, [
        "기준일자",
        "등록일자",
        "수정일자",
        "data_crtr_ymd",
        "std_ymd",
      ]),
    ),
  };
}

function compactRecord(record: CsvRecord) {
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [key, text(value)]),
  );
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

async function importBigData119LocalCsv(
  source: BigData119PointSource,
  candidates: readonly string[],
  fallbackRows: CsvRecord[],
  mapper: (record: CsvRecord, index: number) => EmergencyPointInput | null,
  report: DatasetProgressReporter,
): Promise<ImportResult> {
  await report(
    "requesting",
    10,
    "소방안전 빅데이터 플랫폼 CSV 파일을 확인하고 있습니다.",
  );

  const localCsv = readBigData119Csv(candidates);
  const fetchedAt = new Date().toISOString();
  const rows = localCsv ? parseCsv(localCsv.csv) : fallbackRows;
  const sourceFile = localCsv?.fileName ?? "presentation-sample";

  await report(
    "receiving",
    42,
    localCsv
      ? `${sourceFile} 파일을 읽었습니다.`
      : "승인 CSV가 없어 발표용 샘플 데이터를 사용합니다.",
  );

  const points = rows
    .map((row, index) =>
      mapper(
        {
          ...row,
          _platelets_source_file: sourceFile,
          _platelets_source_url: DATASET_SOURCES[source].url,
        },
        index,
      ),
    )
    .filter((point): point is EmergencyPointInput => point !== null);
  const geocodedCount = countGeocoded(points);

  await report(
    "processing",
    68,
    "소방안전 빅데이터 플랫폼 레코드를 지도 포인트로 정규화했습니다.",
  );

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
    case "fire-safety-targets":
      return importBigData119LocalCsv(
        source,
        BIGDATA119_TARGET_FILE_CANDIDATES,
        BIGDATA119_TARGET_FALLBACK_ROWS,
        mapFireSafetyTargetRecord,
        report,
      );
    case "fire-water-sources":
      return importBigData119LocalCsv(
        source,
        BIGDATA119_WATER_FILE_CANDIDATES,
        BIGDATA119_WATER_FALLBACK_ROWS,
        mapFireWaterSourceRecord,
        report,
      );
    case "busan-fire-safety-targets":
      return importBigData119LocalCsv(
        source,
        BIGDATA119_BUSAN_TARGET_FILE_CANDIDATES,
        BIGDATA119_BUSAN_TARGET_FALLBACK_ROWS,
        (record, index) => mapFireSafetyTargetRecord(record, index, source),
        report,
      );
    case "busan-fire-water-sources":
      return importBigData119LocalCsv(
        source,
        BIGDATA119_BUSAN_WATER_FILE_CANDIDATES,
        BIGDATA119_BUSAN_WATER_FALLBACK_ROWS,
        (record, index) => mapFireWaterSourceRecord(record, index, source),
        report,
      );
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
