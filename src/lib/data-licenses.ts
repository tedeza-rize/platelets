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
    id: "vworld-map-tiles",
    license: "브이월드 이용약관 및 오픈API 이용정책 준수",
    notes:
      "브이월드 API 키는 NEXT_PUBLIC_VWORLD_API_KEY 환경변수로만 주입한다. 타일 저작권 표기는 지도 attribution에 유지한다.",
    provider: "공간정보산업진흥원 / 브이월드",
    sourceName: "브이월드 WMTS 배경지도, 교통, POI 벡터 타일",
    sourceUrl: "https://www.vworld.kr/",
    usage: "기본 지도 배경, 도로/POI 지도 레이어",
  },
  {
    id: "openfreemap-openstreetmap",
    license:
      "OpenStreetMap ODbL, OpenMapTiles 라이선스, OpenFreeMap 이용 조건 준수",
    notes:
      "OSM 제공자 전환 시 벡터 타일과 글꼴을 불러온다. 지도 attribution에 OpenFreeMap, OpenMapTiles, OpenStreetMap 표기를 유지한다.",
    provider: "OpenFreeMap / OpenMapTiles / OpenStreetMap contributors",
    sourceName: "OpenFreeMap 벡터 타일과 OpenStreetMap 기반 지도 데이터",
    sourceUrl: "https://openfreemap.org/",
    usage: "OSM 지도 배경과 지명/도로/건물 레이어",
  },
  {
    id: "kakao-local-geocoding",
    license: "카카오 Developers 이용약관 및 Local API 정책 준수",
    notes:
      "주소 좌표 변환에만 사용하며 KAKAO_REST_API_KEY는 서버 환경변수로만 보관한다. 원문 API 응답은 sudo/debug 용도 외 공개하지 않는다.",
    provider: "카카오",
    sourceName: "Kakao Local 주소 검색 API",
    sourceUrl: "https://developers.kakao.com/docs/latest/ko/local/dev-guide",
    usage: "주소 기반 공공 데이터의 위도/경도 보강",
  },
  {
    id: "naver-kakao-map-links",
    license: "각 지도 서비스 링크/이용약관 준수",
    notes:
      "포인트 상세 팝업에서 외부 지도 검색 링크만 제공하며, 별도 API 호출이나 키 저장은 하지 않는다.",
    provider: "네이버 / 카카오",
    sourceName: "네이버 지도, 카카오맵 웹 검색 링크",
    sourceUrl: "https://map.naver.com/",
    usage: "시설 위치를 외부 지도에서 열기",
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
    id: "childcare-centers",
    license: "공공누리 제1유형: 출처표시, 상업적 이용 및 변경 가능",
    notes:
      "CSV 다운로드 엔드포인트에 데이터 ID 10054와 공개 열 목록을 POST한다. MS949 CSV를 UTF-8로 변환해 시설 좌표와 유형을 저장한다.",
    provider: "서울특별시 / 서울 열린데이터광장",
    sourceName: "어린이집유치원좌표정보",
    sourceUrl: "https://data.seoul.go.kr/bsp/wgs/dataView/data300View/10054.do",
    usage: "전국 어린이집 및 유치원 지도 포인트",
  },
  {
    id: "pharmacies",
    license: "이용허락범위 제한 없음",
    notes:
      "전국 약국 FullData API를 최대 페이지 크기로 순회한다. PUBLIC_DATA_API_KEY는 서버 환경변수로만 보관한다.",
    provider: "국립중앙의료원 / 공공데이터포털",
    sourceName: "전국 약국 정보 조회 서비스",
    sourceUrl: "https://www.data.go.kr/data/15000576/openapi.do",
    usage: "약국 위치, 연락처, 운영시간 지도 포인트",
  },
  {
    id: "hospitals",
    license: "이용허락범위 제한 없음",
    notes:
      "병의원 FullData와 달빛어린이병원 목록을 기관 ID로 병합한다. PUBLIC_DATA_API_KEY는 서버 환경변수로만 보관한다.",
    provider: "국립중앙의료원 / 공공데이터포털",
    sourceName: "전국 병·의원 찾기 서비스",
    sourceUrl: "https://www.data.go.kr/data/15000736/openapi.do",
    usage: "병의원 위치, 연락처, 진료시간, 달빛어린이병원 여부",
  },
  {
    id: "emergency-medical-institutions",
    license: "이용허락범위 제한 없음",
    notes:
      "기관 목록, 기관 기본정보, 실시간 가용병상, 중증질환 수용 가능 정보를 기관 ID로 병합한다. 실시간 값은 조회 시점 이후 변할 수 있다.",
    provider: "국립중앙의료원 / 공공데이터포털",
    sourceName: "전국 응급의료기관 정보 조회 서비스",
    sourceUrl: "https://www.data.go.kr/data/15000563/openapi.do",
    usage:
      "응급의료기관 지도 포인트, 병상·진료역량 기반 병원 추천과 이송 경로 계산",
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
  {
    id: "schools",
    license:
      "공공데이터포털 표준데이터 이용조건 및 개별 제공기관 조건 확인 필요",
    notes:
      "전국 단위 병합 표준데이터이며 시점에 따라 일부 데이터 시차가 있을 수 있다. 납품 전 최신 제공기관/라이선스를 재확인한다.",
    provider: "재단법인 한국지방교육행정연구재단 / 공공데이터포털",
    sourceName: "전국초중등학교위치표준데이터",
    sourceUrl: "https://www.data.go.kr/data/15021148/standard.do",
    usage: "초등학교, 중학교, 고등학교 지도 포인트",
  },
  {
    id: "universities",
    license: "이용허락범위 제한 없음",
    notes:
      "원문 XLSX를 다운로드해 첫 워크시트의 도로명주소, 지번주소, 위도, 경도, 대표번호를 사용한다.",
    provider: "교육부 / 공공데이터포털",
    sourceName: "교육부_대학교 주소기반 좌표정보_20251126",
    sourceUrl: "https://www.data.go.kr/data/15138981/fileData.do",
    usage: "대학교 캠퍼스 지도 포인트",
  },
] as const satisfies readonly DataLicenseEntry[];
