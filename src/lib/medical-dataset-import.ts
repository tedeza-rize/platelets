import { parse } from "csv-parse/sync";
import { XMLParser } from "fast-xml-parser";
import type { DatasetProgressReporter } from "@/lib/dataset-progress";
import { DATASET_SOURCES, type DatasetSourceId } from "@/lib/dataset-sources";
import {
  addressArea,
  mapChildcareRecord,
  mapEmergencyRecord,
  mapHiraPharmacyRecord,
  mapHospitalRecord,
  mapMoisPharmacyRecord,
  mapPharmacyRecord,
  mapWithConcurrency,
  mergeByHpid,
  pointResult,
  type SourceRecord,
  text,
} from "@/lib/medical-dataset-mappers";
import {
  listEmergencyHospitalFallbackPoints,
  recordApiLog,
} from "@/lib/points-db";
import { getPublicDataApiKey } from "@/lib/public-data";

export type { MedicalDatasetImportResult } from "@/lib/medical-dataset-mappers";

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
const HIRA_PHARMACY_URL =
  "https://apis.data.go.kr/B551182/pharmacyInfoService/getParmacyBasisList";
const MOIS_PHARMACY_URL = "https://apis.data.go.kr/1741000/pharmacies/info";

function normalizeApiItems<T>(items: T | T[] | null | undefined): T[] {
  if (Array.isArray(items)) {
    return items;
  }

  return items ? [items] : [];
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
  const items = normalizeApiItems(rawItems);

  return {
    items,
    totalCount: Number(payload.response?.body?.totalCount ?? items.length),
  };
}

async function fetchPublicDataPage(params: {
  operation: string;
  pageNo: number;
  searchParams?: Record<string, string>;
  serviceKeyParam?: "ServiceKey" | "serviceKey";
  source: DatasetSourceId;
  url: string;
}) {
  const serviceKey = await getPublicDataApiKey();

  if (!serviceKey) {
    throw new Error("The public data API key is not configured.");
  }

  const url = new URL(params.url);
  url.searchParams.set(params.serviceKeyParam ?? "serviceKey", serviceKey);
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
  serviceKeyParam?: "ServiceKey" | "serviceKey";
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

async function fetchMoisPharmacyPage(pageNo: number) {
  const serviceKey = await getPublicDataApiKey();

  if (!serviceKey) {
    throw new Error("The public data API key is not configured.");
  }

  const url = new URL(MOIS_PHARMACY_URL);
  url.searchParams.set("serviceKey", serviceKey);
  url.searchParams.set("pageNo", String(pageNo));
  url.searchParams.set("numOfRows", String(PUBLIC_DATA_ROWS_PER_PAGE));
  url.searchParams.set("type", "json");

  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      Accept: "application/json,*/*",
      "User-Agent": "platelets/0.1",
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  await recordApiLog({
    action: "dataset-download",
    category: "dataset",
    level: response.ok ? "info" : "error",
    message: response.ok
      ? `MOIS pharmacies page ${pageNo} downloaded.`
      : `MOIS pharmacies failed with HTTP ${response.status}.`,
    metadata: {
      operation: "moisPharmaciesInfo",
      pageNo,
      statusCode: response.status,
    },
    requestCount: 1,
    source: "pharmacies",
    status: response.ok ? "success" : "failure",
  });

  if (!response.ok) {
    throw new Error(`moisPharmaciesInfo request failed (${response.status})`);
  }

  const payload = (await response.json()) as {
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
      `moisPharmaciesInfo returned ${resultCode}: ${
        payload.response?.header?.resultMsg ?? "unknown error"
      }`,
    );
  }

  const rawItems = payload.response?.body?.items?.item;
  const items = normalizeApiItems(rawItems);

  return {
    items,
    totalCount: Number(payload.response?.body?.totalCount ?? items.length),
  };
}

async function fetchAllMoisPharmacies() {
  const firstPage = await fetchMoisPharmacyPage(1);
  const pageCount = Math.max(
    1,
    Math.ceil(firstPage.totalCount / PUBLIC_DATA_ROWS_PER_PAGE),
  );
  const pages = [firstPage.items];

  for (let pageNo = 2; pageNo <= pageCount; pageNo += 1) {
    pages.push((await fetchMoisPharmacyPage(pageNo)).items);
  }

  return pages.flat();
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
  let rows: SourceRecord[];
  let mapper = mapPharmacyRecord;

  try {
    rows = await fetchAllPublicData({
      operation: "getParmacyFullDown",
      source: "pharmacies",
      url: DATASET_SOURCES.pharmacies.url,
    });
  } catch (nmcError) {
    await report(
      "requesting",
      22,
      "국립중앙의료원 약국 API가 차단되어 HIRA 약국정보서비스를 시도합니다.",
    );

    try {
      rows = await fetchAllPublicData({
        operation: "getParmacyBasisList",
        serviceKeyParam: "ServiceKey",
        source: "pharmacies",
        url: HIRA_PHARMACY_URL,
      });
      mapper = mapHiraPharmacyRecord;
    } catch (hiraError) {
      await report(
        "requesting",
        32,
        "HIRA 약국정보서비스도 차단되어 행정안전부 건강_약국 조회서비스를 시도합니다.",
      );

      try {
        rows = await fetchAllMoisPharmacies();
        mapper = mapMoisPharmacyRecord;
      } catch (moisError) {
        throw new Error(
          `약국 데이터 조회가 실패했습니다. NMC(getParmacyFullDown): ${
            nmcError instanceof Error ? nmcError.message : String(nmcError)
          }; HIRA(getParmacyBasisList): ${
            hiraError instanceof Error ? hiraError.message : String(hiraError)
          }; MOIS(pharmacies/info): ${
            moisError instanceof Error ? moisError.message : String(moisError)
          }. 세 서비스의 공공데이터포털 활용신청/승인 상태를 확인하세요.`,
          { cause: moisError },
        );
      }
    }
  }

  await report("receiving", 50, "전국 약국 API 응답을 모두 받았습니다.");
  await report("processing", 68, "약국 위치와 운영정보를 정규화했습니다.");

  return pointResult(rows, mapper);
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
  let rows: SourceRecord[];

  try {
    rows = await fetchAllPublicData({
      operation: "getEgytListInfoInqire",
      source: "emergency-medical-institutions",
      url: DATASET_SOURCES["emergency-medical-institutions"].url,
    });
  } catch (error) {
    if (!(error instanceof Error && error.message.includes("(403)"))) {
      throw error;
    }

    const hospitals = await listEmergencyHospitalFallbackPoints();
    rows = hospitals.map((hospital) => ({
      ...hospital.raw,
      derivedFromHospitalDataset: "Y",
      dutyAddr: hospital.address,
      dutyEmclsName:
        hospital.raw.dutyEmclsName || hospital.category || "응급실운영기관",
      dutyName: hospital.name,
      dutyTel1: hospital.raw.dutyTel1 || hospital.phone || "",
      dutyTel3: hospital.raw.dutyTel3 || hospital.phone || "",
      hpid: hospital.sourceRecordId,
      wgs84Lat: hospital.latitude,
      wgs84Lon: hospital.longitude,
    }));
    await report(
      "receiving",
      24,
      `응급 전용 API가 승인되지 않아 병의원 FullData의 응급실 운영기관 ${rows.length.toLocaleString("ko-KR")}곳을 사용합니다.`,
    );
    await report(
      "processing",
      70,
      "기관 등급과 응급실 운영정보를 정규화했습니다. 실시간 병상은 전용 API 승인 후 병합됩니다.",
    );

    return pointResult(rows, mapEmergencyRecord);
  }
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
