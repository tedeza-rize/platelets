export type DataLicenseEntry = {
  id: string;
  license: string;
  notes: string;
  provider: string;
  sourceName: string;
  sourceUrl: string;
  sourceUrls?: readonly { label: string; url: string }[];
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
      "OSM 제공자 전환 시 벡터 타일과 글꼴을 불러온다. 자체 경로 계산은 Overpass 도로 그래프의 일방통행과 접근제한 태그를 적용하지만 실시간 교통은 반영하지 않는다. 지도 attribution을 유지한다.",
    provider: "OpenFreeMap / OpenMapTiles / OpenStreetMap contributors",
    sourceName: "OpenFreeMap 벡터 타일과 OpenStreetMap 기반 지도 데이터",
    sourceUrl: "https://openfreemap.org/",
    usage:
      "OSM 지도 배경과 지명/도로/건물 레이어, 자체 도로 경로 계산과 ITS 교통 보정 기반 ETA",
  },
  {
    id: "kakao-mobility-directions",
    license: "카카오모빌리티 API 이용약관 및 쿼터 정책 준수",
    notes:
      "KAKAO_MOBILITY_REST_API_KEY는 서버 환경변수로만 보관한다. 응답 경로와 ETA는 요청 시점 교통·도로 정보에 따라 달라질 수 있다.",
    provider: "카카오모빌리티",
    sourceName: "Kakao Mobility 길찾기 API",
    sourceUrl: "https://developers.kakaomobility.com/docs/navi-api/directions/",
    usage: "실제 도로 이동시간 기반 응급기관 추천과 이송 경로 표시",
  },
  {
    id: "its-national-traffic",
    license: "공공데이터포털 및 ITS 오픈데이터 이용조건 확인 필요",
    notes:
      "ITS_OPEN_API_KEY 또는 MOLIT_ITS_API_KEY는 서버 환경변수로만 보관한다. API 응답의 도로 구간 속도와 통행시간은 요청 시점과 영역에 따라 달라지며, 키가 없거나 표본이 없으면 기준 A* 경로 시간을 사용한다.",
    provider: "국토교통부 / 국가교통정보센터",
    sourceName: "국토교통부_교통소통정보, ITS 국가교통정보센터 교통소통정보",
    sourceUrl: "https://www.data.go.kr/data/15040463/openapi.do",
    sourceUrls: [
      {
        label: "국토교통부_교통소통정보",
        url: "https://www.data.go.kr/data/15040463/openapi.do",
      },
      {
        label: "ITS 국가교통정보센터 교통소통정보",
        url: "https://www.its.go.kr/opendata/opendataList?service=traffic",
      },
    ],
    usage: "자체 A* 출동 경로의 실시간 교통 속도 표본 기반 ETA 보정",
  },
  {
    id: "openai-responses",
    license: "OpenAI 서비스 약관·API 데이터 정책 또는 호환 제공자의 약관 준수",
    notes:
      "OPENAI_API_KEY는 서버 환경변수로만 보관한다. AI에는 원시 레코드 대신 시설 검색 결과, 데이터셋 집계, 최근 재난의 요약값만 전송하며 응답은 참고 정보다.",
    provider: "OpenAI 또는 관리자가 지정한 OpenAI 호환 제공자",
    sourceName: "OpenAI Responses API",
    sourceUrl: "https://developers.openai.com/api/docs/guides/text",
    usage: "시설·재난·갱신상태 요약 데이터를 근거로 한 AI 질의응답",
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
    id: "bigdata119-fire-safety-targets",
    license: "소방안전 빅데이터 플랫폼 데이터 상품 이용조건 확인 필요",
    notes:
      "무료 CSV 다운로드 상품이며 구매/다운로드 후 30일 이용기간이 표시된다. 승인받은 CSV는 data/bigdata-119 폴더에 배치해 가져오며, 대시보드의 특정소방대상물 지도 레이어와 데이터 출처 패널에 직접 반영한다. 파일이 없으면 발표용 샘플만 사용한다.",
    provider: "소방안전 빅데이터 플랫폼 / 서울특별시소방재난본부",
    sourceName: "서울소방재난본부_특정소방대상물 현황",
    sourceUrl: "https://bigdata-119.kr/goods/goodsInfo?goods_mng_sn=378",
    usage:
      "특정소방대상물 지도 포인트, 대시보드 데이터 근거 표시, 위험도/출동 의사결정 지원",
  },
  {
    id: "bigdata119-fire-water-sources",
    license: "소방안전 빅데이터 플랫폼 데이터 상품 이용조건 확인 필요",
    notes:
      "무료 CSV 다운로드 상품이며 구매/다운로드 후 30일 이용기간이 표시된다. 승인받은 CSV는 data/bigdata-119 폴더에 배치해 가져오며, 대시보드의 소방용수 지도 레이어와 데이터 출처 패널에 직접 반영한다. 파일이 없으면 발표용 샘플만 사용한다.",
    provider: "소방안전 빅데이터 플랫폼 / 서울특별시소방재난본부",
    sourceName: "서울소방재난본부_소방용수 현황",
    sourceUrl: "https://bigdata-119.kr/goods/goodsInfo?goods_mng_sn=380",
    usage:
      "소방용수 위치 지도 포인트, 현장 대응 자원 확인, 대시보드 데이터 근거 표시",
  },
  {
    id: "bigdata119-busan-fire-safety-targets",
    license: "소방안전 빅데이터 플랫폼 데이터 상품 이용조건 확인 필요",
    notes:
      "무료 CSV 다운로드 상품이며 구매/다운로드 후 30일 이용기간이 표시된다. 승인받은 CSV는 data/bigdata-119 폴더에 배치해 가져오며, 대시보드의 특정소방대상물 지도 레이어와 데이터 출처 패널에 직접 반영한다. 파일이 없으면 발표용 샘플만 사용한다.",
    provider: "소방안전 빅데이터 플랫폼 / 부산광역시소방재난본부",
    sourceName: "부산소방재난본부_특정소방대상물 현황",
    sourceUrl: "https://bigdata-119.kr/goods/goodsInfo?goods_mng_sn=404",
    usage:
      "부산 특정소방대상물 지도 포인트, 대시보드 데이터 근거 표시, 지역 위험도 산정",
  },
  {
    id: "bigdata119-busan-fire-water-sources",
    license: "소방안전 빅데이터 플랫폼 데이터 상품 이용조건 확인 필요",
    notes:
      "무료 CSV 다운로드 상품이며 구매/다운로드 후 30일 이용기간이 표시된다. 승인받은 CSV는 data/bigdata-119 폴더에 배치해 가져오며, 대시보드의 소방용수 지도 레이어와 데이터 출처 패널에 직접 반영한다. 파일이 없으면 발표용 샘플만 사용한다.",
    provider: "소방안전 빅데이터 플랫폼 / 부산광역시소방재난본부",
    sourceName: "부산소방재난본부_소방용수 현황",
    sourceUrl: "https://bigdata-119.kr/goods/goodsInfo?goods_mng_sn=403",
    usage:
      "부산 소방용수 위치 지도 포인트, 현장 대응 자원 확인, 대시보드 데이터 근거 표시",
  },
  {
    id: "bigdata119-national-fire-force",
    license: "소방안전 빅데이터 플랫폼 데이터 상품 이용조건 확인 필요",
    notes:
      "승인받은 CSV는 data/bigdata-119/national-fire-force.csv 또는 화재_소방력_2021_전국.csv로 배치한다. 위험도 패널, 위험요인 설명, 자원 배치 추천에 직접 반영하며, 파일이 없으면 발표용 샘플 통계를 사용한다.",
    provider: "소방안전 빅데이터 플랫폼 / 한국소방안전원",
    sourceName: "전국 시군구별 화재현황 및 소방력 정보",
    sourceUrl: "https://bigdata-119.kr/goods/goodsInfo?goods_mng_sn=9",
    usage: "지역별 위험도 산정과 소방 자원 배치 권고의 규칙 기반 통계 입력",
  },
  {
    id: "bigdata119-seoul-119-call-reception",
    license: "소방안전 빅데이터 플랫폼 데이터 상품 이용조건 확인 필요",
    notes:
      "공개 sample_info XLSX를 data/bigdata-119/seoul-119-call-reception.csv로 변환한다. 전체 CSV는 플랫폼 로그인/무료구매 절차로 별도 확보해야 한다.",
    provider: "소방안전 빅데이터 플랫폼 / 서울특별시소방재난본부",
    sourceName: "서울소방재난본부_119신고접수 현황",
    sourceUrl: "https://bigdata-119.kr/goods/goodsInfo?goods_mng_sn=377",
    usage:
      "서울권 신고 유형, 접수 시간대, 처리 결과 요약과 지역 위험도 운영 부하 가중치",
  },
  {
    id: "bigdata119-busan-ems-dispatches",
    license: "소방안전 빅데이터 플랫폼 데이터 상품 이용조건 확인 필요",
    notes:
      "공개 sample_info XLSX를 data/bigdata-119/busan-ems-dispatches.csv로 변환한다. 전체 CSV는 플랫폼 로그인/무료구매 절차로 별도 확보해야 한다.",
    provider: "소방안전 빅데이터 플랫폼 / 부산광역시소방재난본부",
    sourceName: "부산소방재난본부_구급출동 현황",
    sourceUrl: "https://bigdata-119.kr/goods/goodsInfo?goods_mng_sn=390",
    usage:
      "부산권 구급 출동 유형, 시간대, 출동거리 요약과 지역 위험도 운영 부하 가중치",
  },
  {
    id: "bigdata119-busan-rescue-dispatches",
    license: "소방안전 빅데이터 플랫폼 데이터 상품 이용조건 확인 필요",
    notes:
      "공개 sample_info XLSX를 data/bigdata-119/busan-rescue-dispatches.csv로 변환한다. 전체 CSV는 플랫폼 로그인/무료구매 절차로 별도 확보해야 한다.",
    provider: "소방안전 빅데이터 플랫폼 / 부산광역시소방재난본부",
    sourceName: "부산소방재난본부_구조출동 현황",
    sourceUrl: "https://bigdata-119.kr/goods/goodsInfo?goods_mng_sn=381",
    usage:
      "부산권 구조 출동 원인, 사고 장소, 도착 시간대 요약과 지역 위험도 운영 부하 가중치",
  },
  {
    id: "bigdata119-jeonbuk-119-call-reception",
    license: "소방안전 빅데이터 플랫폼 데이터 상품 이용조건 확인 필요",
    notes:
      "공개 sample_info XLSX를 data/bigdata-119/jeonbuk-119-call-reception.csv로 변환한다. 전체 CSV는 플랫폼 로그인/무료구매 절차로 별도 확보해야 한다.",
    provider: "소방안전 빅데이터 플랫폼 / 전북특별자치도소방본부",
    sourceName: "전북특별자치도소방본부_119신고접수 현황",
    sourceUrl: "https://bigdata-119.kr/goods/goodsInfo?goods_mng_sn=296",
    usage:
      "전북권 신고 유형, 접수 시간대, 처리 결과 요약과 전주권 위험도 운영 부하 가중치",
  },
  {
    id: "building-safety-profiles",
    license: "원 제공기관 이용조건 및 보안등급 확인 필요",
    notes:
      "현재 /api/building-safety는 data/building-safety/profiles.json의 발표용 샘플만 제공한다. 실제 운영 전 검증된 도면/비상구 데이터로 교체하고 dataStatus=verified로 표시해야 한다.",
    provider: "현재 로컬 샘플 / 향후 시설 관리자·공공기관",
    sourceName:
      "data/building-safety/profiles.json, 시설 관리 도면, 방재실 자료, 현장 점검 데이터",
    sourceUrl: "/api/building-safety",
    usage: "건물 단면도, 층별 위험 공간, 비상구, 피난 경로, 대피 장소 안내",
  },
  {
    id: "bigdata119-fire-mechanical-drawings",
    license: "소방안전 빅데이터 플랫폼 데이터 상품 이용조건 확인 필요",
    notes:
      "무료 비정형 다운로드 상품으로 확인했다. 현재 원본 파일은 포함하지 않고 data/building-safety/profiles.json의 발표용 샘플에 원천 후보 메타데이터만 연결한다.",
    provider: "소방안전 빅데이터 플랫폼 / 한방유비스㈜",
    sourceName: "소방 설계 기계도면 정보",
    sourceUrl: "https://bigdata-119.kr/goods/goodsInfo?goods_mng_sn=165",
    usage: "건물 층별 소방설비, 피난계단, 방재실, 기계실 정규화 후보",
  },
  {
    id: "bigdata119-electrical-drawings",
    license: "소방안전 빅데이터 플랫폼 데이터 상품 이용조건 확인 필요",
    notes:
      "유료 비정형 다운로드 상품으로 확인했다. 원본 구매/승인 없이 실제 도면을 포함하지 않는다.",
    provider: "소방안전 빅데이터 플랫폼 / 한방유비스㈜",
    sourceName: "전기도면 정보",
    sourceUrl: "https://bigdata-119.kr/goods/goodsInfo?goods_mng_sn=168",
    usage: "전기실, 분전반, 유도등, 비상전원 등 위험 공간 보강 후보",
  },
  {
    id: "bigdata119-walking-distance-images",
    license: "소방안전 빅데이터 플랫폼 데이터 상품 이용조건 확인 필요",
    notes:
      "무료 비정형 이미지 다운로드 상품으로 확인했다. 현재 피난 경로 값은 발표용 샘플이며 실제 이미지 판독 결과가 아니다.",
    provider: "소방안전 빅데이터 플랫폼 / 한방유비스㈜",
    sourceName: "보행거리 검토 이미지",
    sourceUrl: "https://bigdata-119.kr/goods/goodsInfo?goods_mng_sn=177",
    usage: "피난동선, 보행거리, 비상구 접근성 정규화 후보",
  },
  {
    id: "bigdata119-fire-evacuation-simulation",
    license: "소방안전 빅데이터 플랫폼 데이터 상품 이용조건 확인 필요",
    notes:
      "유료 비정형/혼합 다운로드 상품으로 확인했다. 운영 전 승인 파일을 별도 확보하고 민감 정보 공개 가능 범위를 확인해야 한다.",
    provider: "소방안전 빅데이터 플랫폼 / 한방유비스㈜",
    sourceName: "화재 및 피난 시뮬레이션",
    sourceUrl: "https://bigdata-119.kr/goods/goodsInfo?goods_mng_sn=181",
    usage: "피난 병목, 층별 위험도, 화재 확산 시나리오 보강 후보",
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
    license:
      "NMC: 이용허락범위 제한 없음, HIRA: 공공데이터포털 개별 이용조건 준수, MOIS: 이용허락범위 제한 없음",
    notes:
      "NMC FullData를 우선 사용한다. NMC가 403이면 HIRA 약국정보서비스를 시도하고, HIRA도 차단되면 행정안전부 건강_약국 조회서비스를 시도한다. 행정안전부 좌표는 EPSG:5174 중부원점TM을 WGS84 근사 좌표로 변환한다. 모든 서비스의 PUBLIC_DATA_API_KEY는 서버 환경변수로만 보관하며, 활용신청이 승인되지 않으면 403이 발생할 수 있다.",
    provider:
      "국립중앙의료원 / 건강보험심사평가원 / 행정안전부 / 공공데이터포털",
    sourceName:
      "전국 약국 정보 조회 서비스, 건강보험심사평가원_약국정보서비스, 행정안전부_건강_약국 조회서비스",
    sourceUrl: "https://www.data.go.kr/data/15000576/openapi.do",
    sourceUrls: [
      {
        label: "국립중앙의료원_전국 약국 정보 조회 서비스",
        url: "https://www.data.go.kr/data/15000576/openapi.do",
      },
      {
        label: "건강보험심사평가원_약국정보서비스",
        url: "https://www.data.go.kr/data/15001673/openapi.do",
      },
      {
        label: "행정안전부_건강_약국 조회서비스",
        url: "https://www.data.go.kr/data/15154822/openapi.do",
      },
    ],
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
      "기관 목록, 기관 기본정보, 실시간 가용병상, 중증질환 수용 가능 정보를 기관 ID로 병합한다. 전용 API가 403이면 병의원 FullData의 응급실 운영기관을 파생 후보로 사용하며 이 경우 실시간 병상은 제공하지 않는다.",
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
