import type { EmergencyPointInput } from "@/lib/points-db";

export type SourceRecord = Record<string, unknown>;

export type MedicalDatasetImportResult = {
  failedCount: number;
  fetchedAt: string;
  geocodedCount: number;
  points: EmergencyPointInput[];
  skippedCount: number;
};

const EPSG_5174 = {
  axis: 6377397.155,
  falseEasting: 200000,
  falseNorthing: 500000,
  inverseFlattening: 299.1528128,
  latitudeOrigin: 38,
  longitudeOrigin: 127.002890277778,
  scale: 1,
};

export function text(value: unknown) {
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

function radians(value: number) {
  return (value * Math.PI) / 180;
}

function degrees(value: number) {
  return (value * 180) / Math.PI;
}

function meridionalArc(latitude: number, eccentricitySquared: number) {
  const e4 = eccentricitySquared ** 2;
  const e6 = eccentricitySquared ** 3;

  return (
    EPSG_5174.axis *
    ((1 - eccentricitySquared / 4 - (3 * e4) / 64 - (5 * e6) / 256) * latitude -
      ((3 * eccentricitySquared) / 8 + (3 * e4) / 32 + (45 * e6) / 1024) *
        Math.sin(2 * latitude) +
      ((15 * e4) / 256 + (45 * e6) / 1024) * Math.sin(4 * latitude) -
      ((35 * e6) / 3072) * Math.sin(6 * latitude))
  );
}

function epsg5174ToWgs84Like(xValue: unknown, yValue: unknown) {
  const easting = toNumber(xValue);
  const northing = toNumber(yValue);

  if (easting === null || northing === null) {
    return null;
  }

  // LocalData labels the coordinates as X/Y even though EPSG:5174 formally
  // names the axes northing/easting. In the source files, X is the easting.
  if (easting < -50_000 || easting > 650_000 || northing < -100_000) {
    return null;
  }

  const flattening = 1 / EPSG_5174.inverseFlattening;
  const eccentricitySquared = 2 * flattening - flattening ** 2;
  const secondEccentricitySquared =
    eccentricitySquared / (1 - eccentricitySquared);
  const originLatitude = radians(EPSG_5174.latitudeOrigin);
  const originLongitude = radians(EPSG_5174.longitudeOrigin);
  const meridianOrigin = meridionalArc(originLatitude, eccentricitySquared);
  const meridian =
    meridianOrigin + (northing - EPSG_5174.falseNorthing) / EPSG_5174.scale;
  const mu =
    meridian /
    (EPSG_5174.axis *
      (1 -
        eccentricitySquared / 4 -
        (3 * eccentricitySquared ** 2) / 64 -
        (5 * eccentricitySquared ** 3) / 256));
  const e1 =
    (1 - Math.sqrt(1 - eccentricitySquared)) /
    (1 + Math.sqrt(1 - eccentricitySquared));
  const footprintLatitude =
    mu +
    ((3 * e1) / 2 - (27 * e1 ** 3) / 32) * Math.sin(2 * mu) +
    ((21 * e1 ** 2) / 16 - (55 * e1 ** 4) / 32) * Math.sin(4 * mu) +
    ((151 * e1 ** 3) / 96) * Math.sin(6 * mu) +
    ((1097 * e1 ** 4) / 512) * Math.sin(8 * mu);
  const sinFootprint = Math.sin(footprintLatitude);
  const cosFootprint = Math.cos(footprintLatitude);
  const tanFootprint = Math.tan(footprintLatitude);
  const n1 =
    EPSG_5174.axis / Math.sqrt(1 - eccentricitySquared * sinFootprint ** 2);
  const r1 =
    (EPSG_5174.axis * (1 - eccentricitySquared)) /
    (1 - eccentricitySquared * sinFootprint ** 2) ** 1.5;
  const t1 = tanFootprint ** 2;
  const c1 = secondEccentricitySquared * cosFootprint ** 2;
  const d = (easting - EPSG_5174.falseEasting) / (n1 * EPSG_5174.scale);
  const latitude =
    footprintLatitude -
    ((n1 * tanFootprint) / r1) *
      (d ** 2 / 2 -
        ((5 + 3 * t1 + 10 * c1 - 4 * c1 ** 2 - 9 * secondEccentricitySquared) *
          d ** 4) /
          24 +
        ((61 +
          90 * t1 +
          298 * c1 +
          45 * t1 ** 2 -
          252 * secondEccentricitySquared -
          3 * c1 ** 2) *
          d ** 6) /
          720);
  const longitude =
    originLongitude +
    (d -
      ((1 + 2 * t1 + c1) * d ** 3) / 6 +
      ((5 -
        2 * c1 +
        28 * t1 -
        3 * c1 ** 2 +
        8 * secondEccentricitySquared +
        24 * t1 ** 2) *
        d ** 5) /
        120) /
      cosFootprint;
  const result = {
    latitude: degrees(latitude),
    longitude: degrees(longitude),
  };

  if (
    result.latitude < 32 ||
    result.latitude > 39 ||
    result.longitude < 124 ||
    result.longitude > 132
  ) {
    return null;
  }

  return result;
}

function compactRecord(record: SourceRecord) {
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [key, text(value)]),
  );
}

export function pointResult(
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

export function mapChildcareRecord(
  record: SourceRecord,
): EmergencyPointInput | null {
  const sourceRecordId = text(record.시설코드);
  const name = text(record.시설명);

  if (!(sourceRecordId && name)) {
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

export function mapPharmacyRecord(
  record: SourceRecord,
): EmergencyPointInput | null {
  const sourceRecordId = text(record.hpid);
  const name = text(record.dutyName);

  if (!(sourceRecordId && name)) {
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

export function mapHiraPharmacyRecord(
  record: SourceRecord,
): EmergencyPointInput | null {
  const name = text(record.yadmNm);
  const address = text(record.addr);
  const sourceRecordId = text(record.ykiho) || `${name}|${address}`;

  if (!(sourceRecordId && name)) {
    return null;
  }

  return {
    address,
    category: "약국",
    latitude: toNumber(record.YPos) ?? toNumber(record.yPos),
    longitude: toNumber(record.XPos) ?? toNumber(record.xPos),
    name,
    parentName: "건강보험심사평가원 약국정보서비스",
    phone: nullableText(record.telno),
    raw: compactRecord(record),
    source: "pharmacies",
    sourceRecordId,
    sourceUpdatedAt: null,
  };
}

export function mapMoisPharmacyRecord(
  record: SourceRecord,
): EmergencyPointInput | null {
  const name = text(record.BPLC_NM);
  const address = text(record.ROAD_NM_ADDR) || text(record.LOTNO_ADDR);
  const sourceRecordId = text(record.MNG_NO) || `${name}|${address}`;
  const status = `${text(record.SALS_STTS_NM)} ${text(
    record.DTL_SALS_STTS_NM,
  )}`;

  if (
    !(sourceRecordId && name && address) ||
    /폐업|취소|말소|휴업/.test(status)
  ) {
    return null;
  }

  const coordinate = epsg5174ToWgs84Like(record.CRD_INFO_X, record.CRD_INFO_Y);

  return {
    address,
    category: "약국",
    latitude: coordinate?.latitude ?? null,
    longitude: coordinate?.longitude ?? null,
    name,
    parentName: "행정안전부 건강_약국 조회서비스",
    phone: nullableText(record.TELNO),
    raw: compactRecord(record),
    source: "pharmacies",
    sourceRecordId,
    sourceUpdatedAt:
      nullableText(record.DAT_UPDT_PNT) ?? nullableText(record.LAST_MDFCN_PNT),
  };
}

export function mapHospitalRecord(
  record: SourceRecord,
): EmergencyPointInput | null {
  const sourceRecordId = text(record.hpid);
  const name = text(record.dutyName);

  if (!(sourceRecordId && name)) {
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

export function mapEmergencyRecord(
  record: SourceRecord,
): EmergencyPointInput | null {
  const sourceRecordId = text(record.hpid);
  const name = text(record.dutyName);

  if (!(sourceRecordId && name)) {
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

export function mergeByHpid(
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

    if (!(hpid && current)) {
      continue;
    }

    for (const [key, value] of Object.entries(addition)) {
      current[`${namespace}.${key}`] = value;
    }
  }
}

export function addressArea(record: SourceRecord) {
  const [stage1 = "", stage2 = ""] = text(record.dutyAddr).split(/\s+/);
  return stage1 && stage2 ? { stage1, stage2 } : null;
}

export async function mapWithConcurrency<T, R>(
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
