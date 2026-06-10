export type DatasetSourceId =
  | "fire-stations"
  | "police-stations"
  | "aeds"
  | "childcare-centers"
  | "pharmacies"
  | "hospitals"
  | "emergency-medical-institutions"
  | "schools"
  | "universities";

export type DatasetSource = {
  id: DatasetSourceId;
  label: string;
  type:
    | "aed"
    | "childcare"
    | "emergency-medical"
    | "fire"
    | "hospital"
    | "pharmacy"
    | "police"
    | "school"
    | "university";
  url: string;
};

export const DATASET_SOURCES = {
  "fire-stations": {
    id: "fire-stations",
    label: "소방서/119안전센터",
    type: "fire",
    url: "https://www.data.go.kr/cmm/cmm/fileDownload.do?atchFileId=FILE_000000003035931&fileDetailSn=1&dataNm=%EC%86%8C%EB%B0%A9%EC%B2%AD_%EC%A0%84%EA%B5%AD%EC%86%8C%EB%B0%A9%EC%84%9C%20%EC%A2%8C%ED%91%9C%ED%98%84%ED%99%A9(XY%EC%A2%8C%ED%91%9C)_20240901",
  },
  "police-stations": {
    id: "police-stations",
    label: "경찰서/지구대/파출소",
    type: "police",
    url: "https://www.data.go.kr/cmm/cmm/fileDownload.do?atchFileId=FILE_000000003600631&fileDetailSn=1&dataNm=%EA%B2%BD%EC%B0%B0%EC%B2%AD_%EC%A0%84%EA%B5%AD%20%EC%A7%80%EA%B5%AC%EB%8C%80%20%ED%8C%8C%EC%B6%9C%EC%86%8C%20%EC%A3%BC%EC%86%8C%20%ED%98%84%ED%99%A9_20251231",
  },
  aeds: {
    id: "aeds",
    label: "AED",
    type: "aed",
    url: "https://apis.data.go.kr/B552657/AEDInfoInqireService/getAedFullDown",
  },
  "childcare-centers": {
    id: "childcare-centers",
    label: "어린이집/유치원",
    type: "childcare",
    url: "https://data.seoul.go.kr/bsp/wgs/dataView/data300View/10054.do",
  },
  pharmacies: {
    id: "pharmacies",
    label: "약국",
    type: "pharmacy",
    url: "https://apis.data.go.kr/B552657/ErmctInsttInfoInqireService/getParmacyFullDown",
  },
  hospitals: {
    id: "hospitals",
    label: "병의원",
    type: "hospital",
    url: "https://apis.data.go.kr/B552657/HsptlAsembySearchService/getHsptlMdcncFullDown",
  },
  "emergency-medical-institutions": {
    id: "emergency-medical-institutions",
    label: "응급의료기관",
    type: "emergency-medical",
    url: "https://apis.data.go.kr/B552657/ErmctInfoInqireService/getEgytListInfoInqire",
  },
  schools: {
    id: "schools",
    label: "초중고등학교",
    type: "school",
    url: "https://www.data.go.kr/download/standard.json?publicDataPk=15021148&svcTableNm=tn_pubr_public_elesch_mskul_lc_svc",
  },
  universities: {
    id: "universities",
    label: "대학교",
    type: "university",
    url: "https://www.data.go.kr/cmm/cmm/fileDownload.do?atchFileId=FILE_000000003547770&fileDetailSn=1&dataNm=%EA%B5%90%EC%9C%A1%EB%B6%80_%EB%8C%80%ED%95%99%EA%B5%90%20%EC%A3%BC%EC%86%8C%EA%B8%B0%EB%B0%98%20%EC%A2%8C%ED%91%9C%EC%A0%95%EB%B3%B4_20251126",
  },
} satisfies Record<DatasetSourceId, DatasetSource>;

export const DATASET_SOURCE_IDS = Object.keys(
  DATASET_SOURCES,
) as DatasetSourceId[];

export function isDatasetSourceId(value: string): value is DatasetSourceId {
  return value in DATASET_SOURCES;
}
