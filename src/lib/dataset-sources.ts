export type DatasetSourceId = "fire-stations" | "police-stations" | "aeds";

export type DatasetSource = {
  id: DatasetSourceId;
  label: string;
  type: "aed" | "fire" | "police";
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
} satisfies Record<DatasetSourceId, DatasetSource>;

export const DATASET_SOURCE_IDS = Object.keys(
  DATASET_SOURCES,
) as DatasetSourceId[];

export function isDatasetSourceId(value: string): value is DatasetSourceId {
  return value in DATASET_SOURCES;
}
