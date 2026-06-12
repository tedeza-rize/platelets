import fs from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { BASE_RISK_AREAS } from "@/lib/disaster-response/mock-data";
import type {
  BigData119OperationalKind,
  BigData119OperationalSummary,
  RiskArea,
} from "@/lib/disaster-response/types";

type CsvRecord = Record<string, unknown>;

type BigData119OperationalProductConfig = {
  fileCandidates: string[];
  kind: BigData119OperationalKind;
  sourceId: string;
  sourceLabel: string;
  sourceUrl: string;
};

type ParsedProduct = {
  fileName: string;
  rows: CsvRecord[];
  summary: BigData119OperationalSummary;
};

export type BigData119OperationalLoad = {
  rowCount: number;
  sourceLabels: string[];
  sourceUrls: string[];
};

const BIGDATA119_DATA_DIR = path.join(
  /*turbopackIgnore: true*/ process.cwd(),
  "data",
  "bigdata-119",
);
const CSV_ENCODING = "euc-kr";
const MAX_HINTS = 4;

const PRODUCTS: BigData119OperationalProductConfig[] = [
  {
    fileCandidates: [
      "seoul-119-call-reception.csv",
      "서울소방재난본부_119신고접수 현황.csv",
      "신고접수_2024.csv",
      "신고접수_2023.csv",
    ],
    kind: "call-reception",
    sourceId: "bigdata119-seoul-119-call-reception",
    sourceLabel: "소방안전 빅데이터: 서울 119신고접수",
    sourceUrl: "https://bigdata-119.kr/goods/goodsInfo?goods_mng_sn=377",
  },
  {
    fileCandidates: [
      "busan-ems-dispatches.csv",
      "부산소방재난본부_구급출동 현황_2023_부산.csv",
      "부산소방재난본부_구급출동 현황.csv",
    ],
    kind: "ems-dispatch",
    sourceId: "bigdata119-busan-ems-dispatches",
    sourceLabel: "소방안전 빅데이터: 부산 구급출동",
    sourceUrl: "https://bigdata-119.kr/goods/goodsInfo?goods_mng_sn=390",
  },
  {
    fileCandidates: [
      "busan-rescue-dispatches.csv",
      "부산소방재난본부_구조출동 현황_2024_부산.csv",
      "부산소방재난본부_구조출동 현황.csv",
    ],
    kind: "rescue-dispatch",
    sourceId: "bigdata119-busan-rescue-dispatches",
    sourceLabel: "소방안전 빅데이터: 부산 구조출동",
    sourceUrl: "https://bigdata-119.kr/goods/goodsInfo?goods_mng_sn=381",
  },
  {
    fileCandidates: [
      "jeonbuk-119-call-reception.csv",
      "전북특별자치도소방본부_119신고접수 현황.csv",
      "신고접수현황_2023.csv",
      "신고접수현황_2022.csv",
    ],
    kind: "call-reception",
    sourceId: "bigdata119-jeonbuk-119-call-reception",
    sourceLabel: "소방안전 빅데이터: 전북 119신고접수",
    sourceUrl: "https://bigdata-119.kr/goods/goodsInfo?goods_mng_sn=296",
  },
];

const AREA_REGION_ALIASES: Record<string, string[]> = {
  "risk-busan-central": [
    "부산광역시 중구",
    "부산광역시 동구",
    "부산 중구",
    "부산 동구",
  ],
  "risk-busan-haeundae": [
    "부산광역시 해운대구",
    "부산광역시 수영구",
    "부산 해운대구",
    "부산 수영구",
  ],
  "risk-gangnam": ["서울특별시 강남구", "서울 강남구"],
  "risk-jeonju": [
    "전북특별자치도 전주시덕진구",
    "전북특별자치도 전주시완산구",
    "전라북도 전주시덕진구",
    "전라북도 전주시완산구",
    "전북 전주시덕진구",
    "전북 전주시완산구",
  ],
  "risk-jongno-jung": [
    "서울특별시 종로구",
    "서울특별시 중구",
    "서울 종로구",
    "서울 중구",
  ],
  "risk-mapo": ["서울특별시 마포구", "서울 마포구"],
  "risk-yongsan": ["서울특별시 용산구", "서울 용산구"],
};

let cachedSummaries: BigData119OperationalSummary[] | null = null;
let cachedSignature = "";

function text(record: CsvRecord, keys: string[]) {
  for (const key of keys) {
    const value = record[key];

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }

  return "";
}

function normalizeCityName(city: string) {
  switch (city) {
    case "서울":
      return "서울특별시";
    case "부산":
      return "부산광역시";
    case "전북":
    case "전라북도":
      return "전북특별자치도";
    default:
      return city;
  }
}

function normalizeRegion(value: string) {
  return normalizeCityName(value).replace(/\s+/g, "");
}

function number(record: CsvRecord, keys: string[]) {
  const raw = text(record, keys).replace(/,/g, "");
  const parsed = Number(raw);

  return Number.isFinite(parsed) ? parsed : null;
}

function decodeCsv(buffer: Buffer) {
  const utf8 = new TextDecoder("utf-8").decode(buffer);
  const utf8ReplacementCount = (utf8.match(/\uFFFD/g) ?? []).length;

  if (utf8ReplacementCount === 0) {
    return utf8;
  }

  const eucKr = new TextDecoder(CSV_ENCODING).decode(buffer);
  const eucKrReplacementCount = (eucKr.match(/\uFFFD/g) ?? []).length;

  return eucKrReplacementCount < utf8ReplacementCount ? eucKr : utf8;
}

function findLocalCsv(config: BigData119OperationalProductConfig) {
  if (!fs.existsSync(/* turbopackIgnore: true */ BIGDATA119_DATA_DIR)) {
    return null;
  }

  const files = fs.readdirSync(/* turbopackIgnore: true */ BIGDATA119_DATA_DIR);
  const match = config.fileCandidates.find((candidate) =>
    files.includes(candidate),
  );

  if (match) {
    return path.join(/* turbopackIgnore: true */ BIGDATA119_DATA_DIR, match);
  }

  return null;
}

function displayRegionLabel(record: CsvRecord) {
  const city = normalizeCityName(
    text(record, [
      "grnds_ctpv_nm",
      "clmty_ctpv_nm",
      "ptn_ctpv_nm",
      "ctpv_nm",
      "시도",
      "시도명",
    ]),
  );
  const district = text(record, [
    "grnds_sgg_nm",
    "clmty_sgg_nm",
    "sgg_nm",
    "시군구",
    "시군구명",
  ]);

  return [city, district].filter(Boolean).join(" ");
}

function rowRegionKeys(record: CsvRecord) {
  const candidates: string[] = [];
  const cityCandidates = [
    text(record, ["grnds_ctpv_nm"]),
    text(record, ["clmty_ctpv_nm"]),
    text(record, ["ptn_ctpv_nm"]),
    text(record, ["ctpv_nm", "시도", "시도명"]),
  ].filter(Boolean);
  const districtCandidates = [
    text(record, ["grnds_sgg_nm"]),
    text(record, ["clmty_sgg_nm"]),
    text(record, ["sgg_nm", "시군구", "시군구명"]),
  ].filter(Boolean);

  for (const city of cityCandidates) {
    const normalizedCity = normalizeCityName(city);
    candidates.push(normalizedCity);

    for (const district of districtCandidates) {
      candidates.push(`${normalizedCity} ${district}`);
    }
  }

  for (const district of districtCandidates) {
    candidates.push(district);
  }

  return [...new Set(candidates.map(normalizeRegion).filter(Boolean))];
}

function topValues(rows: CsvRecord[], keys: string[]) {
  const counts = new Map<string, number>();

  for (const row of rows) {
    const value = text(row, keys);

    if (!value || value === "0") {
      continue;
    }

    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort(
      (left, right) => right[1] - left[1] || left[0].localeCompare(right[0]),
    )
    .slice(0, MAX_HINTS)
    .map(([value, count]) => `${value} ${count.toLocaleString("ko-KR")}건`);
}

function topHours(rows: CsvRecord[]) {
  const counts = new Map<number, number>();

  for (const row of rows) {
    const hour = number(row, ["dclr_hr", "dspt_hr", "cbk_hr"]);

    if (hour === null || hour < 0 || hour > 23) {
      continue;
    }

    counts.set(hour, (counts.get(hour) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0] - right[0])
    .slice(0, MAX_HINTS)
    .map(
      ([hour, count]) =>
        `${String(hour).padStart(2, "0")}시 ${count.toLocaleString("ko-KR")}건`,
    );
}

function averageDispatchDistanceMeters(rows: CsvRecord[]) {
  const distances = rows
    .map((row) => number(row, ["grnds_dstnc", "grnds2_dstnc", "grnds3_dstnc"]))
    .filter((value): value is number => value !== null && value > 0);

  if (distances.length === 0) {
    return null;
  }

  const average =
    distances.reduce((sum, distance) => sum + distance, 0) / distances.length;

  return Math.round(average < 200 ? average * 1_000 : average);
}

function riskAreaLoads(rows: CsvRecord[]) {
  const areaMap = new Map(BASE_RISK_AREAS.map((area) => [area.id, area]));

  return Object.entries(AREA_REGION_ALIASES)
    .map(([areaId, aliases]) => {
      const normalizedAliases = aliases.map(normalizeRegion);
      const rowCount = rows.filter((row) => {
        const keys = rowRegionKeys(row);

        return keys.some((key) =>
          normalizedAliases.some(
            (alias) => key === alias || key.includes(alias),
          ),
        );
      }).length;
      const area = areaMap.get(areaId);

      return area && rowCount > 0
        ? { areaId, areaName: area.name, rowCount }
        : null;
    })
    .filter(
      (load): load is NonNullable<typeof load> =>
        load !== null && load.rowCount > 0,
    );
}

function parseProduct(
  config: BigData119OperationalProductConfig,
): ParsedProduct | null {
  const filePath = findLocalCsv(config);

  if (!filePath) {
    return null;
  }

  const csv = decodeCsv(fs.readFileSync(/* turbopackIgnore: true */ filePath));
  const rows = parse(csv, {
    bom: true,
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as CsvRecord[];
  const fileName = path.basename(filePath);
  const downloadedAt =
    text(rows[0] ?? {}, ["_platelets_sample_downloaded_at"]) || null;
  const isSample = rows.some((row) =>
    text(row, ["_platelets_source"]).includes("샘플"),
  );

  return {
    fileName,
    rows,
    summary: {
      areaLoads: riskAreaLoads(rows),
      averageDispatchDistanceMeters: averageDispatchDistanceMeters(rows),
      downloadedAt,
      fileName,
      incidentTypeHints: topValues(rows, [
        "emrg_rscu_clsf_nm",
        "emrg_rscu_assrt_nm",
        "ptn_ocrn_type_nm",
        "acdnt_cs_nm",
        "acdnt_injr_nm",
        "ptn_sym_se_nm",
      ]),
      isSample,
      kind: config.kind,
      regions: [
        ...new Set(
          rows
            .map(displayRegionLabel)
            .filter(Boolean)
            .sort((left, right) => left.localeCompare(right, "ko-KR")),
        ),
      ],
      resultHints: topValues(rows, [
        "prcs_rslt_se_nm",
        "trans_clsf_nm",
        "reg_cmptn_se_nm",
      ]),
      rowCount: rows.length,
      sourceId: config.sourceId,
      sourceLabel: config.sourceLabel,
      sourceUrl: config.sourceUrl,
      timeHints: topHours(rows),
    },
  };
}

function buildSignature() {
  if (!fs.existsSync(/* turbopackIgnore: true */ BIGDATA119_DATA_DIR)) {
    return "missing";
  }

  return PRODUCTS.map((config) => {
    const filePath = findLocalCsv(config);

    if (!filePath) {
      return `${config.sourceId}:missing`;
    }

    const stat = fs.statSync(/* turbopackIgnore: true */ filePath);

    return `${config.sourceId}:${path.basename(filePath)}:${stat.mtimeMs}:${stat.size}`;
  }).join("|");
}

export function listBigData119OperationalSummaries() {
  const signature = buildSignature();

  if (cachedSummaries && cachedSignature === signature) {
    return cachedSummaries;
  }

  const summaries = PRODUCTS.map(parseProduct)
    .filter((product): product is ParsedProduct => Boolean(product))
    .map((product) => product.summary);

  cachedSummaries = summaries;
  cachedSignature = signature;

  return summaries;
}

export function summarizeOperationalLoadForRiskArea(
  area: RiskArea,
  summaries: BigData119OperationalSummary[],
): BigData119OperationalLoad | null {
  const matchingSummaries = summaries
    .map((summary) => {
      const areaLoad = summary.areaLoads.find(
        (load) => load.areaId === area.id,
      );

      return areaLoad
        ? {
            rowCount: areaLoad.rowCount,
            sourceLabel: summary.sourceLabel,
            sourceUrl: summary.sourceUrl,
          }
        : null;
    })
    .filter((summary): summary is NonNullable<typeof summary> =>
      Boolean(summary),
    );

  if (matchingSummaries.length === 0) {
    return null;
  }

  return {
    rowCount: matchingSummaries.reduce(
      (sum, summary) => sum + summary.rowCount,
      0,
    ),
    sourceLabels: [
      ...new Set(matchingSummaries.map((summary) => summary.sourceLabel)),
    ],
    sourceUrls: [
      ...new Set(matchingSummaries.map((summary) => summary.sourceUrl)),
    ],
  };
}
