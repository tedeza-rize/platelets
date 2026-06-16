import areas from "@/data/seoul-citydata-areas.json" with { type: "json" };

export type SeoulCitydataArea = {
  areaCode: string;
  areaName: string;
  category: string;
  englishName: string;
};

export const SEOUL_CITYDATA_AREAS = areas as readonly SeoulCitydataArea[];

export const SEOUL_CITYDATA_AREA_BY_CODE: ReadonlyMap<
  string,
  SeoulCitydataArea
> = new Map(SEOUL_CITYDATA_AREAS.map((area) => [area.areaCode, area]));

export const SEOUL_CITYDATA_AREA_BY_NAME: ReadonlyMap<
  string,
  SeoulCitydataArea
> = new Map(SEOUL_CITYDATA_AREAS.map((area) => [area.areaName, area]));
