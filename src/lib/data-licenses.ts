export type DataLicenseEntry = {
  id: string;
  license: string;
  notes: string;
  provider: string;
  sourceName: string;
  sourceUrl: string;
  usage: string;
};

export const DATA_LICENSE_ENTRIES = [
  {
    id: "seoul-realtime-population",
    license: "공공누리 제1유형: 출처표시, 상업적 이용 및 변경 가능",
    notes:
      "서울 실시간 인구데이터 API는 한 번에 1개 장소만 조회한다. API 키는 SEOUL_OPEN_API_KEY 환경변수에만 보관한다.",
    provider: "서울특별시 / 서울 열린데이터광장",
    sourceName:
      "서울시 실시간 인구데이터, 서울시 주요 121장소 목록, 서울시 주요 121장소 영역",
    sourceUrl: "https://data.seoul.go.kr/dataList/OA-21778/A/1/datasetView.do",
    usage: "서울 121개 핫스팟 영역 표시와 클릭 시 실시간 혼잡도/인구 범위 조회",
  },
  {
    id: "fire-stations",
    license: "공공데이터포털 개별 데이터셋 이용허락조건 확인 필요",
    notes:
      "납품 전 데이터셋 상세 화면의 최신 라이선스와 제공기관 표기를 재확인한다.",
    provider: "소방청 / 공공데이터포털",
    sourceName: "전국 소방서 좌표현황",
    sourceUrl: "https://www.data.go.kr/",
    usage: "소방서 및 119안전센터 지도 포인트",
  },
  {
    id: "police-stations",
    license: "공공데이터포털 개별 데이터셋 이용허락조건 확인 필요",
    notes:
      "납품 전 데이터셋 상세 화면의 최신 라이선스와 제공기관 표기를 재확인한다.",
    provider: "경찰청 / 공공데이터포털",
    sourceName: "전국 지구대 파출소 주소 현황",
    sourceUrl: "https://www.data.go.kr/",
    usage: "경찰서/지구대/파출소 지도 포인트",
  },
  {
    id: "aeds",
    license: "공공데이터포털 개별 데이터셋 이용허락조건 확인 필요",
    notes:
      "납품 전 데이터셋 상세 화면의 최신 라이선스와 제공기관 표기를 재확인한다.",
    provider: "국립중앙의료원 / 공공데이터포털",
    sourceName: "AED 위치정보 조회 서비스",
    sourceUrl: "https://www.data.go.kr/",
    usage: "자동심장충격기 지도 포인트",
  },
  {
    id: "kma-earthquake",
    license: "공공데이터포털 개별 데이터셋 이용허락조건 확인 필요",
    notes:
      "납품 전 데이터셋 상세 화면의 최신 라이선스와 제공기관 표기를 재확인한다.",
    provider: "기상청 / 공공데이터포털",
    sourceName: "지진정보 조회서비스",
    sourceUrl: "https://www.data.go.kr/",
    usage: "최근 지진/지진해일 이벤트 표시",
  },
] as const satisfies readonly DataLicenseEntry[];
