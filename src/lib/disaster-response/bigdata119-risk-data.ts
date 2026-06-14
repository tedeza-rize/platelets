import fs from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";
import type { RiskArea } from "@/lib/disaster-response/types";

type CsvRecord = Record<string, unknown>;

export type FireSafetyRegionalStat = {
  ambulanceCount: number;
  casualtyCount: number;
  city: string;
  dataYear: string;
  fireCount: number;
  fireEngineCount: number;
  rescueCount: number;
  sourceLabel: string;
  sourceUrl: string;
  stationCount: number;
  town: string;
};

const BIGDATA119_DATA_DIR = path.join(
  /*turbopackIgnore: true*/ process.cwd(),
  "data",
  "bigdata-119",
);
const CSV_ENCODING = "euc-kr";

const NATIONAL_FIRE_FORCE_FILE_CANDIDATES = [
  "national-fire-force.csv",
  "화재_소방력_2021_전국.csv",
  "전국_시군구별_화재현황_소방력.csv",
  "시군구별 화재현황 및 소방력 정보.csv",
];

const NATIONAL_FIRE_FORCE_SOURCE = {
  label: "소방안전 빅데이터: 전국 시군구별 화재현황 및 소방력 정보",
  url: "https://bigdata-119.kr/goods/goodsInfo?goods_mng_sn=9",
};

const FALLBACK_REGIONAL_STATS: FireSafetyRegionalStat[] = [
  {
    ambulanceCount: 28,
    casualtyCount: 38,
    city: "서울특별시",
    dataYear: "2021",
    fireCount: 284,
    fireEngineCount: 36,
    rescueCount: 520,
    sourceLabel: `${NATIONAL_FIRE_FORCE_SOURCE.label} 샘플`,
    sourceUrl: NATIONAL_FIRE_FORCE_SOURCE.url,
    stationCount: 4,
    town: "중구",
  },
  {
    ambulanceCount: 22,
    casualtyCount: 31,
    city: "서울특별시",
    dataYear: "2021",
    fireCount: 236,
    fireEngineCount: 31,
    rescueCount: 470,
    sourceLabel: `${NATIONAL_FIRE_FORCE_SOURCE.label} 샘플`,
    sourceUrl: NATIONAL_FIRE_FORCE_SOURCE.url,
    stationCount: 3,
    town: "종로구",
  },
  {
    ambulanceCount: 24,
    casualtyCount: 44,
    city: "서울특별시",
    dataYear: "2021",
    fireCount: 258,
    fireEngineCount: 30,
    rescueCount: 610,
    sourceLabel: `${NATIONAL_FIRE_FORCE_SOURCE.label} 샘플`,
    sourceUrl: NATIONAL_FIRE_FORCE_SOURCE.url,
    stationCount: 3,
    town: "용산구",
  },
  {
    ambulanceCount: 34,
    casualtyCount: 53,
    city: "서울특별시",
    dataYear: "2021",
    fireCount: 365,
    fireEngineCount: 42,
    rescueCount: 720,
    sourceLabel: `${NATIONAL_FIRE_FORCE_SOURCE.label} 샘플`,
    sourceUrl: NATIONAL_FIRE_FORCE_SOURCE.url,
    stationCount: 5,
    town: "강남구",
  },
  {
    ambulanceCount: 21,
    casualtyCount: 26,
    city: "서울특별시",
    dataYear: "2021",
    fireCount: 198,
    fireEngineCount: 29,
    rescueCount: 410,
    sourceLabel: `${NATIONAL_FIRE_FORCE_SOURCE.label} 샘플`,
    sourceUrl: NATIONAL_FIRE_FORCE_SOURCE.url,
    stationCount: 3,
    town: "마포구",
  },
  {
    ambulanceCount: 18,
    casualtyCount: 35,
    city: "부산광역시",
    dataYear: "2021",
    fireCount: 226,
    fireEngineCount: 26,
    rescueCount: 390,
    sourceLabel: `${NATIONAL_FIRE_FORCE_SOURCE.label} 샘플`,
    sourceUrl: NATIONAL_FIRE_FORCE_SOURCE.url,
    stationCount: 3,
    town: "중구",
  },
  {
    ambulanceCount: 26,
    casualtyCount: 48,
    city: "부산광역시",
    dataYear: "2021",
    fireCount: 318,
    fireEngineCount: 34,
    rescueCount: 650,
    sourceLabel: `${NATIONAL_FIRE_FORCE_SOURCE.label} 샘플`,
    sourceUrl: NATIONAL_FIRE_FORCE_SOURCE.url,
    stationCount: 4,
    town: "해운대구",
  },
  {
    ambulanceCount: 20,
    casualtyCount: 33,
    city: "전북특별자치도",
    dataYear: "2021",
    fireCount: 214,
    fireEngineCount: 27,
    rescueCount: 430,
    sourceLabel: `${NATIONAL_FIRE_FORCE_SOURCE.label} 샘플`,
    sourceUrl: NATIONAL_FIRE_FORCE_SOURCE.url,
    stationCount: 3,
    town: "전주시덕진구",
  },
  {
    ambulanceCount: 18,
    casualtyCount: 29,
    city: "전북특별자치도",
    dataYear: "2021",
    fireCount: 188,
    fireEngineCount: 24,
    rescueCount: 390,
    sourceLabel: `${NATIONAL_FIRE_FORCE_SOURCE.label} 샘플`,
    sourceUrl: NATIONAL_FIRE_FORCE_SOURCE.url,
    stationCount: 3,
    town: "전주시완산구",
  },
];

const REGIONAL_STAT_ALIASES: Record<string, [string, string][]> = {
  "risk-busan-central": [["부산광역시", "중구"]],
  "risk-busan-haeundae": [["부산광역시", "해운대구"]],
  "risk-gangnam": [["서울특별시", "강남구"]],
  "risk-jeonju": [
    ["전북특별자치도", "전주시덕진구"],
    ["전북특별자치도", "전주시완산구"],
  ],
  "risk-jongno-jung": [
    ["서울특별시", "중구"],
    ["서울특별시", "종로구"],
  ],
  "risk-mapo": [["서울특별시", "마포구"]],
  "risk-yongsan": [["서울특별시", "용산구"]],
};

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
    case "대구":
      return "대구광역시";
    case "인천":
      return "인천광역시";
    case "광주":
      return "광주광역시";
    case "대전":
      return "대전광역시";
    case "울산":
      return "울산광역시";
    case "세종":
      return "세종특별자치시";
    case "경기":
      return "경기도";
    case "강원":
      return "강원특별자치도";
    case "충북":
      return "충청북도";
    case "충남":
      return "충청남도";
    case "전북":
      return "전북특별자치도";
    case "전남":
      return "전라남도";
    case "경북":
      return "경상북도";
    case "경남":
      return "경상남도";
    case "제주":
      return "제주특별자치도";
    default:
      return city;
  }
}

function number(record: CsvRecord, keys: string[]) {
  const raw = text(record, keys).replace(/,/g, "");
  const parsed = Number(raw);

  return Number.isFinite(parsed) ? parsed : 0;
}

function findLocalCsv() {
  if (!fs.existsSync(/* turbopackIgnore: true */ BIGDATA119_DATA_DIR)) {
    return null;
  }

  const files = fs.readdirSync(/* turbopackIgnore: true */ BIGDATA119_DATA_DIR);
  const match = NATIONAL_FIRE_FORCE_FILE_CANDIDATES.find((candidate) =>
    files.includes(candidate),
  );

  if (match) {
    return path.join(/* turbopackIgnore: true */ BIGDATA119_DATA_DIR, match);
  }

  const keywords = NATIONAL_FIRE_FORCE_FILE_CANDIDATES.map((candidate) =>
    candidate.replace(/\.csv$/i, ""),
  );
  const matchedFileName = files
    .filter((fileName) => fileName.toLowerCase().endsWith(".csv"))
    .find((fileName) => keywords.some((keyword) => fileName.includes(keyword)));

  return matchedFileName
    ? path.join(
        /* turbopackIgnore: true */ BIGDATA119_DATA_DIR,
        matchedFileName,
      )
    : null;
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

function parseLocalStats(filePath: string): FireSafetyRegionalStat[] {
  const csv = decodeCsv(fs.readFileSync(/* turbopackIgnore: true */ filePath));
  const rows = parse(csv, {
    bom: true,
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as CsvRecord[];

  return rows
    .map((record) => {
      const city = normalizeCityName(
        text(record, ["시도", "시도명", "ctpv_nm", "grnds_ctpv_nm", "CTPV_NM"]),
      );
      const town = text(record, [
        "시군구",
        "시군구명",
        "sgg_nm",
        "grnds_sgg_nm",
        "SGG_NM",
      ]);

      if (!(city && town)) {
        return null;
      }

      return {
        ambulanceCount: number(record, [
          "구급차수",
          "구급차",
          "ambulance_count",
          "AMBLNC_CNT",
        ]),
        casualtyCount: number(record, [
          "인명피해",
          "사상자수",
          "casualty_count",
          "CASLT_CNT",
          "hnl_dam_cnt",
          "hnl_dam_injpsn_cnt",
        ]),
        city,
        dataYear:
          text(record, ["연도", "기준년도", "year", "YR", "acdnt_yr"]) ||
          path.basename(filePath),
        fireCount: number(record, [
          "화재건수",
          "화재발생건수",
          "fire_count",
          "FIRE_OCRN_CNT",
          "fire_ocrn_nocs",
        ]),
        fireEngineCount: number(record, [
          "소방차수",
          "펌프차수",
          "소방펌프차",
          "fire_engine_count",
          "FIRE_ENGINE_CNT",
          "avg_dspt_eqpmnt_cnt",
        ]),
        rescueCount: number(record, [
          "구조건수",
          "구조건수",
          "rescue_count",
          "RSC_CNT",
          "saf_cs_nocs",
        ]),
        sourceLabel: NATIONAL_FIRE_FORCE_SOURCE.label,
        sourceUrl: NATIONAL_FIRE_FORCE_SOURCE.url,
        stationCount: number(record, [
          "소방서수",
          "안전센터수",
          "station_count",
          "FRSTN_CNT",
        ]),
        town,
      } satisfies FireSafetyRegionalStat;
    })
    .filter((stat): stat is FireSafetyRegionalStat => Boolean(stat));
}

function mergeFallbackRegionalStats(stats: FireSafetyRegionalStat[]) {
  const keys = new Set(stats.map((stat) => `${stat.city}\t${stat.town}`));
  const missingFallbackStats = FALLBACK_REGIONAL_STATS.filter(
    (stat) => !keys.has(`${stat.city}\t${stat.town}`),
  );

  return [...stats, ...missingFallbackStats];
}

export function listFireSafetyRegionalStats() {
  const filePath = findLocalCsv();

  if (!filePath) {
    return FALLBACK_REGIONAL_STATS;
  }

  try {
    const stats = parseLocalStats(filePath);

    return stats.length > 0
      ? mergeFallbackRegionalStats(stats)
      : FALLBACK_REGIONAL_STATS;
  } catch {
    return FALLBACK_REGIONAL_STATS;
  }
}

export function summarizeStatsForRiskArea(
  area: RiskArea,
  stats: FireSafetyRegionalStat[],
) {
  const aliases = REGIONAL_STAT_ALIASES[area.id] ?? [];
  const matched = stats.filter((stat) =>
    aliases.some(([city, town]) => stat.city === city && stat.town === town),
  );

  if (matched.length === 0) {
    return null;
  }

  return {
    ambulanceCount: matched.reduce((sum, stat) => sum + stat.ambulanceCount, 0),
    casualtyCount: matched.reduce((sum, stat) => sum + stat.casualtyCount, 0),
    dataYear: matched[0]?.dataYear ?? "",
    fireCount: matched.reduce((sum, stat) => sum + stat.fireCount, 0),
    fireEngineCount: matched.reduce(
      (sum, stat) => sum + stat.fireEngineCount,
      0,
    ),
    rescueCount: matched.reduce((sum, stat) => sum + stat.rescueCount, 0),
    sourceLabel: matched[0]?.sourceLabel ?? NATIONAL_FIRE_FORCE_SOURCE.label,
    sourceUrl: matched[0]?.sourceUrl ?? NATIONAL_FIRE_FORCE_SOURCE.url,
    stationCount: matched.reduce((sum, stat) => sum + stat.stationCount, 0),
  };
}
