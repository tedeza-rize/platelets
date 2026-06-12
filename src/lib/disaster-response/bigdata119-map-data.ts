import fs from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";
import type {
  BigData119MapPoint,
  BigData119PointKind,
  BigData119SourceSummary,
} from "@/lib/disaster-response/types";

type CsvRecord = Record<string, unknown>;

type BigData119ProductConfig = {
  fileCandidates: string[];
  kind: BigData119PointKind;
  sourceId: string;
  sourceLabel: string;
  sourceUrl: string;
};

type ParsedProduct = {
  fileName: string;
  points: BigData119MapPoint[];
  rows: CsvRecord[];
  summary: BigData119SourceSummary;
};

export type BigData119DashboardData = {
  points: BigData119MapPoint[];
  summaries: BigData119SourceSummary[];
};

const BIGDATA119_DATA_DIR = path.join(
  /*turbopackIgnore: true*/ process.cwd(),
  "data",
  "bigdata-119",
);
const CSV_ENCODING = "euc-kr";
const MAX_DASHBOARD_POINTS_PER_SOURCE = 1_000;

const PRODUCTS: BigData119ProductConfig[] = [
  {
    fileCandidates: [
      "seoul-fire-safety-targets.csv",
      "서울소방재난본부_특정소방대상물 현황.csv",
      "특정소방대상물_2024.csv",
      "특정소방대상물 현황.csv",
    ],
    kind: "fire-safety-target",
    sourceId: "bigdata119-fire-safety-targets",
    sourceLabel: "소방안전 빅데이터: 서울 특정소방대상물",
    sourceUrl: "https://bigdata-119.kr/goods/goodsInfo?goods_mng_sn=378",
  },
  {
    fileCandidates: [
      "seoul-fire-water-sources.csv",
      "서울소방재난본부_소방용수 현황.csv",
      "소방용수_2024.csv",
      "소방용수 현황.csv",
    ],
    kind: "fire-water-source",
    sourceId: "bigdata119-fire-water-sources",
    sourceLabel: "소방안전 빅데이터: 서울 소방용수",
    sourceUrl: "https://bigdata-119.kr/goods/goodsInfo?goods_mng_sn=380",
  },
  {
    fileCandidates: [
      "busan-fire-safety-targets.csv",
      "부산소방재난본부_특정소방대상물 현황_2025_부산.csv",
      "부산소방재난본부_특정소방대상물 현황.csv",
      "부산_특정소방대상물_2025.csv",
      "특정소방대상물_2023.csv",
    ],
    kind: "fire-safety-target",
    sourceId: "bigdata119-busan-fire-safety-targets",
    sourceLabel: "소방안전 빅데이터: 부산 특정소방대상물",
    sourceUrl: "https://bigdata-119.kr/goods/goodsInfo?goods_mng_sn=404",
  },
  {
    fileCandidates: [
      "busan-fire-water-sources.csv",
      "부산소방재난본부_소방용수 현황_2025_부산.csv",
      "부산소방재난본부_소방용수 현황.csv",
      "부산_소방용수_2025.csv",
      "소방용수_2023.csv",
    ],
    kind: "fire-water-source",
    sourceId: "bigdata119-busan-fire-water-sources",
    sourceLabel: "소방안전 빅데이터: 부산 소방용수",
    sourceUrl: "https://bigdata-119.kr/goods/goodsInfo?goods_mng_sn=403",
  },
];

let cachedData: BigData119DashboardData | null = null;
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

function findLocalCsv(config: BigData119ProductConfig) {
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

function regionLabel(record: CsvRecord) {
  return [
    text(record, ["grnds_ctpv_nm", "ctpv_nm", "시도", "시도명"]),
    text(record, ["grnds_sgg_nm", "sgg_nm", "시군구", "시군구명"]),
  ]
    .filter(Boolean)
    .join(" ");
}

function pointName(record: CsvRecord, kind: BigData119PointKind) {
  if (kind === "fire-water-source") {
    return (
      text(record, ["nghb_bldg_nm", "road_nm_addr", "hnum_nm", "sn"]) ||
      "소방용수"
    );
  }

  return (
    text(record, ["bldg_nm", "trgtobj_nm", "conm_addr", "bdst_sn"]) ||
    "특정소방대상물"
  );
}

function pointCategory(record: CsvRecord, kind: BigData119PointKind) {
  return kind === "fire-water-source"
    ? text(record, ["fruswtr_se_nm", "assrt_se_nm", "nwod_se_nm"]) || "소방용수"
    : text(record, ["bdst_usg_nm", "trgtobj_clsf_nm", "trgtobj_se_nm"]) ||
        "특정소방대상물";
}

function pointAddress(record: CsvRecord) {
  return text(record, [
    "conm_addr",
    "road_nm_addr",
    "addr",
    "주소",
    "소재지도로명주소",
    "소재지지번주소",
  ]);
}

function parseProduct(config: BigData119ProductConfig): ParsedProduct | null {
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
  const points = rows
    .map((record, index) => {
      const latitude = number(record, ["latitude", "위도", "WGS84위도", "y"]);
      const longitude = number(record, ["longitude", "경도", "WGS84경도", "x"]);

      if (latitude === null || longitude === null) {
        return null;
      }

      const sourceUpdatedAt = text(record, [
        "_platelets_sample_downloaded_at",
        "데이터기준일자",
        "dataReferenceDate",
      ]);
      const sourceUrl =
        text(record, ["_platelets_source_url"]) || config.sourceUrl;
      const isSample =
        text(record, ["_platelets_source"]).includes("샘플") ||
        sourceUpdatedAt.includes("T");

      return {
        address: pointAddress(record),
        category: pointCategory(record, config.kind),
        centerName: text(record, ["cntr_nm", "센터명"]) || null,
        city: text(record, ["grnds_ctpv_nm", "ctpv_nm", "시도", "시도명"]),
        district: text(record, [
          "grnds_sgg_nm",
          "sgg_nm",
          "시군구",
          "시군구명",
        ]),
        id: `${config.sourceId}-${text(record, ["bdst_sn", "sn", "source_record_id"]) || index}`,
        isSample,
        kind: config.kind,
        latitude,
        longitude,
        name: pointName(record, config.kind),
        sourceId: config.sourceId,
        sourceLabel: config.sourceLabel,
        sourceUpdatedAt: sourceUpdatedAt || null,
        sourceUrl,
        stationName: text(record, ["frstn_nm", "소방서명"]) || null,
        status:
          text(record, ["stts_se_nm", "use_yn", "isf_chck_trgt_type_nm"]) ||
          null,
      } satisfies BigData119MapPoint;
    })
    .filter((point): point is BigData119MapPoint => Boolean(point));
  const returnedPoints = points.slice(0, MAX_DASHBOARD_POINTS_PER_SOURCE);
  const regions = [
    ...new Set(
      rows
        .map(regionLabel)
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, "ko-KR")),
    ),
  ];
  const fileName = path.basename(filePath);
  const downloadedAt =
    returnedPoints.find((point) => point.sourceUpdatedAt)?.sourceUpdatedAt ??
    null;

  return {
    fileName,
    points: returnedPoints,
    rows,
    summary: {
      downloadedAt,
      fileName,
      isSample: returnedPoints.some((point) => point.isSample),
      kind: config.kind,
      mappedCount: points.length,
      pointCount: rows.length,
      regions,
      returnedCount: returnedPoints.length,
      sourceId: config.sourceId,
      sourceLabel: config.sourceLabel,
      sourceUrl: config.sourceUrl,
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

export function listBigData119DashboardData(): BigData119DashboardData {
  const signature = buildSignature();

  if (cachedData && cachedSignature === signature) {
    return cachedData;
  }

  const parsedProducts = PRODUCTS.map(parseProduct).filter(
    (product): product is ParsedProduct => Boolean(product),
  );
  const data = {
    points: parsedProducts.flatMap((product) => product.points),
    summaries: parsedProducts.map((product) => product.summary),
  };

  cachedData = data;
  cachedSignature = signature;

  return data;
}
