import { parse } from "csv-parse/sync";
import { XMLParser } from "fast-xml-parser";
import type { DatasetProgressReporter } from "@/lib/dataset-progress";
import { DATASET_SOURCES, type DatasetSourceId } from "@/lib/dataset-sources";
import { type EmergencyPointInput, recordApiLog } from "@/lib/points-db";
import { getPublicDataApiKey } from "@/lib/public-data";

type SourceRecord = Record<string, unknown>;

export type MedicalDatasetImportResult = {
  failedCount: number;
  fetchedAt: string;
  geocodedCount: number;
  points: EmergencyPointInput[];
  skippedCount: number;
};

type PublicDataPage = {
  items: SourceRecord[];
  totalCount: number;
};

const PUBLIC_DATA_ROWS_PER_PAGE = 10_000;
const REQUEST_TIMEOUT_MS = 45_000;
const CHILDCARE_DOWNLOAD_URL =
  "https://data.seoul.go.kr/bsp/wgs/dataset/dataCsvDown.do";
const CHILDCARE_FORM = {
  id: "10054",
  rowFilterList: "[]",
  tdColNmArr: "분류,시설코드,시설유형,시설명,시설위치,위도,경도",
};
const HOSPITAL_BASE_URL =
  "https://apis.data.go.kr/B552657/HsptlAsembySearchService";
const EMERGENCY_BASE_URL =
  "https://apis.data.go.kr/B552657/ErmctInfoInqireService";

function text(value: unknown) {
  return value === null || value === undefined ? "" : String(value).trim();
}

function nullableText(value: unknown) {
  const valueText = text(value);
  return valueText ? valueText : null;
}

function toNumber(value: unknown) {
  const number = Number(text(value));
  return Number.isFinite(number) ? number : null;
}

function compactRecord(record: SourceRecord) {
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [key, text(value)]),
  );
}

function pointResult(
  rows: SourceRecord[],
  mapper: (record: SourceRecord) => EmergencyPointInput | null,
): MedicalDatasetImportResult {
  const points = rows
    .map(mapper)
    .filter((point): point is EmergencyPointInput => point !== null);
  const geocodedCount = points.filter(
    (point) => point.latitude !== null && point.longitude !== null,
  ).length;

  return {
    failedCount: points.length - geocodedCount,
    fetchedAt: new Date().toISOString(),
    geocodedCount,
    points,
    skippedCount: rows.length - points.length,
  };
}

function parsePublicDataXml(xml: string, operation: string): PublicDataPage {
  const payload = new XMLParser({
    ignoreAttributes: false,
    trimValues: true,
  }).parse(xml) as {
    response?: {
      body?: {
        items?: { item?: SourceRecord | SourceRecord[] };
        totalCount?: number | string;
      };
      header?: {
        resultCode?: number | string;
        resultMsg?: string;
      };
    };
  };
  const resultCode = text(payload.response?.header?.resultCode);

  if (resultCode && !["0", "00", "03"].includes(resultCode)) {
    throw new Error(
      `${operation} returned ${resultCode}: ${
        payload.response?.header?.resultMsg ?? "unknown error"
      }`,
    );
  }

  const rawItems = payload.response?.body?.items?.item;
  const items = Array.isArray(rawItems) ? rawItems : rawItems ? [rawItems] : [];

  return {
    items,
    totalCount: Number(payload.response?.body?.totalCount ?? items.length),
  };
}

async function fetchPublicDataPage(params: {
  operation: string;
  pageNo: number;
  searchParams?: Record<string, string>;
  source: DatasetSourceId;
  url: string;
}) {
  const serviceKey = getPublicDataApiKey();

  if (!serviceKey) {
    throw new Error(
      "PUBLIC_DATA_API_KEY, DATA_GO_KR_API_KEY, or DATA_GO_KR_SERVICE_KEY is required.",
    );
  }

  const url = new URL(params.url);
  url.searchParams.set("serviceKey", serviceKey);
  url.searchParams.set("pageNo", String(params.pageNo));
  url.searchParams.set("numOfRows", String(PUBLIC_DATA_ROWS_PER_PAGE));

  for (const [key, value] of Object.entries(params.searchParams ?? {})) {
    if (value) {
      url.searchParams.set(key, value);
    }
  }

  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      Accept: "application/xml,text/xml,*/*",
      "User-Agent": "platelets/0.1",
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  await recordApiLog({
    action: "dataset-download",
    category: "dataset",
    level: response.ok ? "info" : "error",
    message: response.ok
      ? `${params.operation} page ${params.pageNo} downloaded.`
      : `${params.operation} failed with HTTP ${response.status}.`,
    metadata: {
      operation: params.operation,
      pageNo: params.pageNo,
      statusCode: response.status,
    },
    requestCount: 1,
    source: params.source,
    status: response.ok ? "success" : "failure",
  });

  if (!response.ok) {
    throw new Error(`${params.operation} request failed (${response.status})`);
  }

  return parsePublicDataXml(await response.text(), params.operation);
}

async function fetchAllPublicData(params: {
  operation: string;
  searchParams?: Record<string, string>;
  source: DatasetSourceId;
  url: string;
}) {
  const firstPage = await fetchPublicDataPage({ ...params, pageNo: 1 });
  const pageCount = Math.max(
    1,
    Math.ceil(firstPage.totalCount / PUBLIC_DATA_ROWS_PER_PAGE),
  );
  const pages = [firstPage.items];

  for (let pageNo = 2; pageNo <= pageCount; pageNo += 1) {
    pages.push((await fetchPublicDataPage({ ...params, pageNo })).items);
  }

  return pages.flat();
}

function mapChildcareRecord(record: SourceRecord): EmergencyPointInput | null {
  const sourceRecordId = text(record.시설코드);
  const name = text(record.시설명);

  if (!sourceRecordId || !name) {
    return null;
  }

  return {
    address: text(record.시설위치),
    category: text(record.시설유형) || text(record.분류) || "어린이집/유치원",
    latitude: toNumber(record.위도),
    longitude: toNumber(record.경도),
    name,
    parentName: nullableText(record.분류),
    phone: null,
    raw: compactRecord(record),
    source: "childcare-centers",
    sourceRecordId,
    sourceUpdatedAt: null,
  };
}

function mapPharmacyRecord(record: SourceRecord): EmergencyPointInput | null {
  const sourceRecordId = text(record.hpid);
  const name = text(record.dutyName);

  if (!sourceRecordId || !name) {
    return null;
  }

  return {
    address: text(record.dutyAddr),
    category: "약국",
    latitude: toNumber(record.wgs84Lat),
    longitude: toNumber(record.wgs84Lon),
    name,
    parentName: null,
    phone: nullableText(record.dutyTel1),
    raw: compactRecord(record),
    source: "pharmacies",
    sourceRecordId,
    sourceUpdatedAt: null,
  };
}

function mapHospitalRecord(record: SourceRecord): EmergencyPointInput | null {
  const sourceRecordId = text(record.hpid);
  const name = text(record.dutyName);

  if (!sourceRecordId || !name) {
    return null;
  }

  return {
    address: text(record.dutyAddr),
    category: text(record.dutyDivNam) || text(record.dutyDiv) || "병의원",
    latitude: toNumber(record.wgs84Lat),
    longitude: toNumber(record.wgs84Lon),
    name,
    parentName:
      text(record.isMoonlightChildHospital) === "Y" ? "달빛어린이병원" : null,
    phone: nullableText(record.dutyTel1) ?? nullableText(record.dutyTel3),
    raw: compactRecord(record),
    source: "hospitals",
    sourceRecordId,
    sourceUpdatedAt: null,
  };
}

function mapEmergencyRecord(record: SourceRecord): EmergencyPointInput | null {
  const sourceRecordId = text(record.hpid);
  const name = text(record.dutyName);

  if (!sourceRecordId || !name) {
    return null;
  }

  return {
    address: text(record.dutyAddr),
    category:
      text(record.dutyEmclsName) || text(record.dutyEmcls) || "응급의료기관",
    latitude: toNumber(record.wgs84Lat),
    longitude: toNumber(record.wgs84Lon),
    name,
    parentName: nullableText(record.dutyDivName),
    phone: nullableText(record.dutyTel3) ?? nullableText(record.dutyTel1),
    raw: compactRecord(record),
    source: "emergency-medical-institutions",
    sourceRecordId,
    sourceUpdatedAt: nullableText(record.hvidate),
  };
}

function mergeByHpid(
  baseRecords: SourceRecord[],
  additions: SourceRecord[],
  namespace: string,
) {
  const byHpid = new Map(
    baseRecords.map((record) => [text(record.hpid), record] as const),
  );

  for (const addition of additions) {
    const hpid = text(addition.hpid);
    const current = byHpid.get(hpid);

    if (!hpid || !current) {
      continue;
    }

    for (const [key, value] of Object.entries(addition)) {
      current[`${namespace}.${key}`] = value;
    }
  }
}

function addressArea(record: SourceRecord) {
  const [stage1 = "", stage2 = ""] = text(record.dutyAddr).split(/\s+/);
  return stage1 && stage2 ? { stage1, stage2 } : null;
}

async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  mapper: (value: T) => Promise<R>,
) {
  const results: R[] = new Array(values.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < values.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(values[index]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, worker),
  );

  return results;
}

export async function importChildcareCenters(report: DatasetProgressReporter) {
  await report(
    "requesting",
    10,
    "어린이집/유치원 좌표 CSV를 요청하고 있습니다.",
  );
  const body = new URLSearchParams(CHILDCARE_FORM);
  const response = await fetch(CHILDCARE_DOWNLOAD_URL, {
    body,
    cache: "no-store",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "platelets/0.1",
    },
    method: "POST",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Childcare CSV download failed (${response.status})`);
  }

  await report("receiving", 38, "원본 CSV 응답을 받았습니다.");
  const csv = new TextDecoder("euc-kr").decode(await response.arrayBuffer());
  const rows = parse(csv, {
    bom: true,
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as SourceRecord[];

  await recordApiLog({
    action: "dataset-download",
    category: "dataset",
    level: "info",
    message: "Childcare and kindergarten CSV downloaded.",
    metadata: { recordCount: rows.length },
    requestCount: 1,
    source: "childcare-centers",
    status: "success",
  });

  await report(
    "processing",
    68,
    `${rows.length.toLocaleString("ko-KR")}건의 시설 좌표를 정규화했습니다.`,
  );

  return pointResult(rows, mapChildcareRecord);
}

export async function importPharmacies(report: DatasetProgressReporter) {
  await report("requesting", 10, "전국 약국 FullData를 요청하고 있습니다.");
  const rows = await fetchAllPublicData({
    operation: "getParmacyFullDown",
    source: "pharmacies",
    url: DATASET_SOURCES.pharmacies.url,
  });

  await report("receiving", 50, "전국 약국 API 응답을 모두 받았습니다.");
  await report("processing", 68, "약국 위치와 운영정보를 정규화했습니다.");

  return pointResult(rows, mapPharmacyRecord);
}

export async function importHospitals(report: DatasetProgressReporter) {
  await report(
    "requesting",
    10,
    "전국 병의원과 달빛어린이병원 데이터를 요청하고 있습니다.",
  );
  const [hospitalRows, moonlightRows] = await Promise.all([
    fetchAllPublicData({
      operation: "getHsptlMdcncFullDown",
      source: "hospitals",
      url: DATASET_SOURCES.hospitals.url,
    }),
    fetchAllPublicData({
      operation: "getBabyListInfoInqire",
      source: "hospitals",
      url: `${HOSPITAL_BASE_URL}/getBabyListInfoInqire`,
    }),
  ]);
  await report("receiving", 50, "병의원 API 응답을 모두 받았습니다.");
  const moonlightIds = new Set(
    moonlightRows.map((record) => text(record.hpid)),
  );
  const rows = hospitalRows.map((record) => ({
    ...record,
    isMoonlightChildHospital: moonlightIds.has(text(record.hpid)) ? "Y" : "N",
  }));

  await report(
    "processing",
    68,
    "병의원 정보와 달빛어린이병원 여부를 병합했습니다.",
  );

  return pointResult(rows, mapHospitalRecord);
}

export async function importEmergencyMedicalInstitutions(
  report: DatasetProgressReporter,
) {
  await report("requesting", 10, "전국 응급의료기관 목록을 요청하고 있습니다.");
  const rows = await fetchAllPublicData({
    operation: "getEgytListInfoInqire",
    source: "emergency-medical-institutions",
    url: DATASET_SOURCES["emergency-medical-institutions"].url,
  });
  await report("receiving", 28, "응급의료기관 목록을 받았습니다.");
  const areas = Array.from(
    new Map(
      rows
        .map(addressArea)
        .filter(
          (area): area is { stage1: string; stage2: string } => area !== null,
        )
        .map((area) => [`${area.stage1}\u0000${area.stage2}`, area]),
    ).values(),
  );
  const [basicPages, bedPages, capabilityPages] = await Promise.all([
    mapWithConcurrency(rows, 8, async (record) => {
      const hpid = text(record.hpid);

      if (!hpid) {
        return [];
      }

      return fetchAllPublicData({
        operation: "getEgytBassInfoInqire",
        searchParams: { HPID: hpid },
        source: "emergency-medical-institutions",
        url: `${EMERGENCY_BASE_URL}/getEgytBassInfoInqire`,
      });
    }),
    mapWithConcurrency(areas, 8, (area) =>
      fetchAllPublicData({
        operation: "getEmrrmRltmUsefulSckbdInfoInqire",
        searchParams: { STAGE1: area.stage1, STAGE2: area.stage2 },
        source: "emergency-medical-institutions",
        url: `${EMERGENCY_BASE_URL}/getEmrrmRltmUsefulSckbdInfoInqire`,
      }),
    ),
    mapWithConcurrency(areas, 8, (area) =>
      fetchAllPublicData({
        operation: "getSrsillDissAceptncPosblInfoInqire",
        searchParams: { STAGE1: area.stage1, STAGE2: area.stage2 },
        source: "emergency-medical-institutions",
        url: `${EMERGENCY_BASE_URL}/getSrsillDissAceptncPosblInfoInqire`,
      }),
    ),
  ]);

  await report(
    "receiving",
    58,
    "기관 기본정보, 실시간 병상, 중증 수용정보를 받았습니다.",
  );

  mergeByHpid(rows, basicPages.flat(), "basic");
  mergeByHpid(rows, bedPages.flat(), "realtimeBed");
  mergeByHpid(rows, capabilityPages.flat(), "severeCapability");

  await report(
    "processing",
    70,
    "응급의료기관별 실시간 정보와 진료역량을 병합했습니다.",
  );

  return pointResult(rows, mapEmergencyRecord);
}
