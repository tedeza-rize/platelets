import fs from "node:fs";
import path from "node:path";
import * as XLSX from "@e965/xlsx";

type ProductConfig = {
  goodsManagementSerial: string;
  outputFileName: string;
  pointDataset: boolean;
  sourceUrl: string;
};

type CsvRecord = Record<string, string>;

type ProductManifest = {
  downloadedAt: string;
  fullCsvDownloadNote: string;
  products: Array<{
    fileCount: number;
    files: Array<{
      byteSize: string;
      filename: string;
      goodsSerial: number;
      issued: string;
    }>;
    goodsId: string;
    goodsManagementSerial: string;
    goodsName: string;
    outputFileName: string;
    rowCount: number;
    sampleUrl: string;
    sourceUrl: string;
  }>;
};

const DATA_DIR = path.join(process.cwd(), "data", "bigdata-119");
const MANIFEST_FILE_NAME = "manifest.json";
const FULL_CSV_DOWNLOAD_NOTE =
  "The platform exposes full CSV files through its login/free-purchase flow. This script downloads public sample_info XLSX files and converts them to local CSV files for MVP/demo use.";

const PRODUCTS: ProductConfig[] = [
  {
    goodsManagementSerial: "378",
    outputFileName: "seoul-fire-safety-targets.csv",
    pointDataset: true,
    sourceUrl: "https://bigdata-119.kr/goods/goodsInfo?goods_mng_sn=378",
  },
  {
    goodsManagementSerial: "380",
    outputFileName: "seoul-fire-water-sources.csv",
    pointDataset: true,
    sourceUrl: "https://bigdata-119.kr/goods/goodsInfo?goods_mng_sn=380",
  },
  {
    goodsManagementSerial: "404",
    outputFileName: "busan-fire-safety-targets.csv",
    pointDataset: true,
    sourceUrl: "https://bigdata-119.kr/goods/goodsInfo?goods_mng_sn=404",
  },
  {
    goodsManagementSerial: "403",
    outputFileName: "busan-fire-water-sources.csv",
    pointDataset: true,
    sourceUrl: "https://bigdata-119.kr/goods/goodsInfo?goods_mng_sn=403",
  },
  {
    goodsManagementSerial: "9",
    outputFileName: "national-fire-force.csv",
    pointDataset: false,
    sourceUrl: "https://bigdata-119.kr/goods/goodsInfo?goods_mng_sn=9",
  },
  {
    goodsManagementSerial: "377",
    outputFileName: "seoul-119-call-reception.csv",
    pointDataset: false,
    sourceUrl: "https://bigdata-119.kr/goods/goodsInfo?goods_mng_sn=377",
  },
  {
    goodsManagementSerial: "390",
    outputFileName: "busan-ems-dispatches.csv",
    pointDataset: false,
    sourceUrl: "https://bigdata-119.kr/goods/goodsInfo?goods_mng_sn=390",
  },
  {
    goodsManagementSerial: "381",
    outputFileName: "busan-rescue-dispatches.csv",
    pointDataset: false,
    sourceUrl: "https://bigdata-119.kr/goods/goodsInfo?goods_mng_sn=381",
  },
  {
    goodsManagementSerial: "296",
    outputFileName: "jeonbuk-119-call-reception.csv",
    pointDataset: false,
    sourceUrl: "https://bigdata-119.kr/goods/goodsInfo?goods_mng_sn=296",
  },
];

const APPROXIMATE_COORDINATES: [string, number, number][] = [
  ["서울특별시 광진구 자양동", 37.5346, 127.0824],
  ["서울특별시 종로구 세종로", 37.5759, 126.9769],
  ["서울특별시 종로구 훈정동", 37.5732, 126.9942],
  ["서울특별시 중구 남대문로4가", 37.5601, 126.9753],
  ["서울특별시 종로구 종로2가", 37.5703, 126.9863],
  ["서울특별시 종로구 혜화동", 37.5862, 127.0018],
  ["서울특별시 종로구 홍지동", 37.6009, 126.9569],
  ["서울특별시 종로구 명륜3가", 37.5886, 126.9956],
  ["서울특별시 성북구 삼선동1가", 37.5894, 127.0085],
  ["서울특별시 종로구 가회동", 37.5821, 126.9856],
  ["서울특별시 종로구 신영동", 37.6024, 126.9618],
  ["서울특별시 종로구 평창동", 37.6063, 126.9685],
  ["서울특별시 중구 정동", 37.5663, 126.9727],
  ["서울특별시 서대문구 냉천동", 37.5678, 126.9632],
  ["서울특별시 서대문구 북아현동", 37.5589, 126.9564],
  ["서울특별시 서대문구 충정로3가", 37.5602, 126.9634],
  ["서울특별시 종로구", 37.5735, 126.979],
  ["서울특별시 중구", 37.5636, 126.9976],
  ["서울특별시 서대문구", 37.5791, 126.9368],
  ["서울특별시 광진구", 37.5384, 127.0823],
  ["서울특별시 성북구", 37.5894, 127.0167],
  ["부산광역시 금정구 금사동", 35.2203, 129.1112],
  ["부산광역시 금정구 부곡동", 35.2292, 129.0927],
  ["부산광역시 금정구 장전동", 35.2382, 129.0856],
  ["부산광역시 금정구 남산동", 35.2646, 129.092],
  ["부산광역시 금정구 구서동", 35.2481, 129.0912],
  ["부산광역시 금정구 서동", 35.2181, 129.1034],
  ["부산광역시 중구 중앙대로 113", 35.1057, 129.0365],
  ["부산광역시 금정구", 35.2428, 129.0922],
  ["부산광역시 연제구", 35.1763, 129.0796],
  ["부산광역시 동래구", 35.205, 129.0837],
  ["부산광역시 남구", 35.1367, 129.084],
  ["부산광역시 중구", 35.1063, 129.0324],
];

const NUMBER_FORMATTER = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 6,
  minimumFractionDigits: 6,
  useGrouping: false,
});

function text(value: unknown) {
  return value === null || value === undefined ? "" : String(value).trim();
}

function parseFirstWorksheetRows(buffer: Buffer) {
  const workbook = XLSX.read(buffer, {
    cellDates: false,
    raw: false,
    type: "buffer",
  });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error("XLSX first worksheet was not found.");
  }

  const worksheet = workbook.Sheets[sheetName];
  if (!worksheet) {
    throw new Error("XLSX first worksheet was not found.");
  }

  return XLSX.utils
    .sheet_to_json<unknown[]>(worksheet, {
      defval: "",
      header: 1,
      raw: false,
    })
    .map((row) => row.map(text));
}

function csvEscape(value: string) {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  return value;
}

function toCsv(records: CsvRecord[]) {
  if (records.length === 0) {
    return "";
  }

  const headers = Array.from(
    records.reduce((set, record) => {
      for (const key of Object.keys(record)) {
        set.add(key);
      }

      return set;
    }, new Set<string>()),
  );
  const rows = records.map((record) =>
    headers.map((header) => csvEscape(record[header] ?? "")).join(","),
  );

  return `${headers.map(csvEscape).join(",")}\n${rows.join("\n")}\n`;
}

function recordsFromWorksheet(buffer: Buffer) {
  const rows = parseFirstWorksheetRows(buffer);
  const headerRow = rows[0] ?? [];
  const headerEntries = headerRow
    .map((header, index) => ({ header: text(header), index }))
    .filter(({ header }) => header.length > 0);

  return rows
    .slice(1)
    .map((row) => {
      const record: CsvRecord = {};

      for (const { header, index } of headerEntries) {
        record[header] = text(row[index]);
      }

      return record;
    })
    .filter((record) =>
      Object.values(record).some((value) => value.trim().length > 0),
    );
}

function field(record: CsvRecord, candidates: string[]) {
  for (const candidate of candidates) {
    const value = text(record[candidate]);

    if (value) {
      return value;
    }
  }

  return "";
}

function coordinateNumber(value: string) {
  const number = Number(value);

  return Number.isFinite(number) && number !== 0 ? number : null;
}

function existingCoordinates(record: CsvRecord) {
  const latitude = coordinateNumber(
    field(record, ["latitude", "위도", "damg_rgn_lat", "lat", "LAT"]),
  );
  const longitude = coordinateNumber(
    field(record, ["longitude", "경도", "damg_rgn_lot", "lng", "lon", "LON"]),
  );

  if (
    latitude !== null &&
    longitude !== null &&
    Math.abs(latitude) <= 90 &&
    Math.abs(longitude) <= 180
  ) {
    return { latitude, longitude, note: "source" };
  }

  return null;
}

function deterministicOffset(index: number) {
  const row = index + 1;
  const latitudeOffset = ((row % 5) - 2) * 0.00028;
  const longitudeOffset = ((Math.floor(row / 5) % 5) - 2) * 0.00028;

  return { latitudeOffset, longitudeOffset };
}

function approximateCoordinates(record: CsvRecord, index: number) {
  const fromSource = existingCoordinates(record);

  if (fromSource) {
    return fromSource;
  }

  const address = [
    field(record, ["conm_addr", "road_nm_addr", "주소", "도로명주소"]),
    field(record, ["grnds_ctpv_nm", "ctpv_nm", "시도명", "시도"]),
    field(record, ["grnds_sgg_nm", "sgg_nm", "시군구명", "시군구"]),
    field(record, ["emd_nm", "읍면동명"]),
  ]
    .filter(Boolean)
    .join(" ");
  const match = APPROXIMATE_COORDINATES.find(([keyword]) =>
    address.includes(keyword),
  );

  if (!match) {
    return null;
  }

  const [, latitude, longitude] = match;
  const { latitudeOffset, longitudeOffset } = deterministicOffset(index);

  return {
    latitude: latitude + latitudeOffset,
    longitude: longitude + longitudeOffset,
    note: `approximate:${match[0]}`,
  };
}

function enrichRecords(
  records: CsvRecord[],
  product: ProductConfig,
  fetchedAt: string,
) {
  return records.map((record, index) => {
    const enriched: CsvRecord = {
      ...record,
      _platelets_sample_downloaded_at: fetchedAt,
      _platelets_source: "소방안전 빅데이터 플랫폼 샘플 데이터",
      _platelets_source_url: product.sourceUrl,
    };

    if (!product.pointDataset) {
      return enriched;
    }

    const coordinates = approximateCoordinates(record, index);

    if (coordinates) {
      enriched.latitude = NUMBER_FORMATTER.format(coordinates.latitude);
      enriched.longitude = NUMBER_FORMATTER.format(coordinates.longitude);
      enriched._platelets_coordinate_note = coordinates.note;
    }

    return enriched;
  });
}

async function postCallService<T>(
  serviceUrl: string,
  data: Record<string, string>,
): Promise<T> {
  const response = await fetch("https://bigdata-119.kr/api/callService", {
    body: JSON.stringify({ data, serviceUrl }),
    headers: {
      Accept: "application/json, text/javascript, */*; q=0.01",
      "Content-Type": "application/json; charset=UTF-8",
      "User-Agent": "platelets-bigdata119-sample-downloader/0.1",
      "X-Requested-With": "XMLHttpRequest",
    },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(`callService failed with HTTP ${response.status}`);
  }

  const payload = (await response.json()) as T & {
    result_code?: string;
    result_msg?: string;
  };

  if (payload.result_code !== "200") {
    throw new Error(payload.result_msg ?? "callService failed");
  }

  return payload;
}

async function downloadSampleXlsx(goodsId: string, goodsName: string) {
  const url = new URL("https://bigdata-119.kr/api/infoFileDown");
  url.searchParams.set("info_file", "sample_info");
  url.searchParams.set("goods_id", goodsId);
  url.searchParams.set("goods_nm", goodsName);

  const response = await fetch(url, {
    headers: {
      "User-Agent": "platelets-bigdata119-sample-downloader/0.1",
    },
  });

  if (!response.ok) {
    throw new Error(`sample download failed with HTTP ${response.status}`);
  }

  return {
    buffer: Buffer.from(await response.arrayBuffer()),
    url: url.toString(),
  };
}

async function downloadProduct(
  product: ProductConfig,
  fetchedAt: string,
): Promise<ProductManifest["products"][number]> {
  const info = await postCallService<{
    filedataList?: Array<{
      byte_size?: string;
      filename?: string;
      goods_sn?: number;
      issued?: string;
    }>;
    goodsInfo?: {
      goods_id?: string;
      goods_nm?: string;
    };
  }>("/goods/getGoodsInfo.do", {
    goods_mng_sn: product.goodsManagementSerial,
  });
  const goodsId = text(info.goodsInfo?.goods_id);
  const goodsName = text(info.goodsInfo?.goods_nm);

  if (!(goodsId && goodsName)) {
    throw new Error(`Missing goods info for ${product.goodsManagementSerial}`);
  }

  const sample = await downloadSampleXlsx(goodsId, goodsName);
  const records = enrichRecords(
    recordsFromWorksheet(sample.buffer),
    product,
    fetchedAt,
  );
  const outputPath = path.join(DATA_DIR, product.outputFileName);

  fs.writeFileSync(outputPath, toCsv(records), "utf8");

  return {
    fileCount: info.filedataList?.length ?? 0,
    files: (info.filedataList ?? []).map((file) => ({
      byteSize: text(file.byte_size),
      filename: text(file.filename),
      goodsSerial: file.goods_sn ?? 0,
      issued: text(file.issued),
    })),
    goodsId,
    goodsManagementSerial: product.goodsManagementSerial,
    goodsName,
    outputFileName: product.outputFileName,
    rowCount: records.length,
    sampleUrl: sample.url,
    sourceUrl: product.sourceUrl,
  };
}

fs.mkdirSync(DATA_DIR, { recursive: true });

const downloadedAt = new Date().toISOString();
const products: ProductManifest["products"] = [];

for (const product of PRODUCTS) {
  const result = await downloadProduct(product, downloadedAt);
  products.push(result);
  console.log(
    `Downloaded ${result.goodsName}: ${result.rowCount} sample rows -> data/bigdata-119/${result.outputFileName}`,
  );
}

const manifest: ProductManifest = {
  downloadedAt,
  fullCsvDownloadNote: FULL_CSV_DOWNLOAD_NOTE,
  products,
};

fs.writeFileSync(
  path.join(DATA_DIR, MANIFEST_FILE_NAME),
  `${JSON.stringify(manifest, null, 2)}\n`,
  "utf8",
);
