export const DATASET_SOURCE_IDS = [
  "fire-stations",
  "fire-safety-targets",
  "fire-water-sources",
  "busan-fire-safety-targets",
  "busan-fire-water-sources",
  "police-stations",
  "aeds",
  "childcare-centers",
  "pharmacies",
  "hospitals",
  "emergency-medical-institutions",
  "schools",
  "universities",
] as const;
export type DatasetSourceId = (typeof DATASET_SOURCE_IDS)[number];

export const ASSEMBLY_SOURCE_IDS = [
  "seoul",
  "busan",
  "daegu",
  "incheon",
  "gwangju",
  "daejeon",
  "ulsan",
  "sejong",
  "gyeonggi-south",
  "gyeonggi-north",
  "gangwon",
  "chungbuk",
  "chungnam",
  "jeonbuk",
  "jeonnam",
  "gyeongbuk",
  "gyeongnam",
  "jeju",
] as const;
export type AssemblyPoliceAgency = (typeof ASSEMBLY_SOURCE_IDS)[number];

export type DatasetSourceType =
  | "aed"
  | "childcare"
  | "emergency-medical"
  | "fire"
  | "fire-safety-target"
  | "fire-water"
  | "hospital"
  | "pharmacy"
  | "police"
  | "school"
  | "university";

export const DATASET_SOURCES = {
  aeds: {
    label: "AED",
    type: "aed",
  },
  "fire-stations": {
    label: "소방서/119안전센터",
    type: "fire",
  },
  "fire-safety-targets": {
    label: "소방안전 빅데이터: 특정소방대상물",
    type: "fire-safety-target",
  },
  "fire-water-sources": {
    label: "소방안전 빅데이터: 소방용수",
    type: "fire-water",
  },
  "busan-fire-safety-targets": {
    label: "소방안전 빅데이터: 부산 특정소방대상물",
    type: "fire-safety-target",
  },
  "busan-fire-water-sources": {
    label: "소방안전 빅데이터: 부산 소방용수",
    type: "fire-water",
  },
  "police-stations": {
    label: "경찰서/지구대/파출소",
    type: "police",
  },
  "childcare-centers": {
    label: "어린이집/유치원",
    type: "childcare",
  },
  pharmacies: {
    label: "약국",
    type: "pharmacy",
  },
  hospitals: {
    label: "병의원",
    type: "hospital",
  },
  "emergency-medical-institutions": {
    label: "응급의료기관",
    type: "emergency-medical",
  },
  schools: {
    label: "초중고등학교",
    type: "school",
  },
  universities: {
    label: "대학교",
    type: "university",
  },
} satisfies Record<
  DatasetSourceId,
  {
    label: string;
    type: DatasetSourceType;
  }
>;
export const POINT_COLUMNS = `
  p.id,
  p.source,
  p.source_record_id,
  p.name,
  p.category,
  p.address,
  p.phone,
  p.parent_name,
  p.latitude,
  p.longitude,
  p.source_updated_at,
  u.fetched_at
`;
