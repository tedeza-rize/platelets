# Data Sources And Licenses

Every new dataset, API, generated file, or external data derivative must be recorded here and in `src/lib/data-licenses.ts`, which powers the in-app `/licenses` page.

Do not commit real API keys. Keep secrets in deployment environment variables such as `.env.local`.

| ID | Source | Provider | Usage | License | Notes |
| --- | --- | --- | --- | --- | --- |
| `seoul-realtime-population` | [서울시 실시간 인구데이터](https://data.seoul.go.kr/dataList/OA-21778/A/1/datasetView.do), 서울시 주요 121장소 목록, 서울시 주요 121장소 영역 | 서울특별시 / 서울 열린데이터광장 | 서울 121개 핫스팟 영역 표시와 클릭 시 실시간 혼잡도/인구 범위 조회 | 공공누리 제1유형: 출처표시, 상업적 이용 및 변경 가능 | `SEOUL_OPEN_API_KEY` 환경변수 사용. API는 한 번에 1개 장소만 조회한다. |
| `vworld-map-tiles` | [브이월드 WMTS 배경지도, 교통, POI 벡터 타일](https://www.vworld.kr/) | 공간정보산업진흥원 / 브이월드 | 기본 지도 배경, 도로/POI 지도 레이어 | 브이월드 이용약관 및 오픈API 이용정책 준수 | `NEXT_PUBLIC_VWORLD_API_KEY` 환경변수 사용. 타일 저작권 표기는 지도 attribution에 유지한다. |
| `openfreemap-openstreetmap` | [OpenFreeMap 벡터 타일과 OpenStreetMap 기반 지도 데이터](https://openfreemap.org/) | OpenFreeMap / OpenMapTiles / OpenStreetMap contributors | OSM 지도 배경과 지명/도로/건물 레이어, Overpass 기반 자체 도로 경로 계산 | OpenStreetMap ODbL, OpenMapTiles 라이선스, OpenFreeMap 이용 조건 준수 | 지도 attribution을 유지한다. 자체 경로는 일방통행·접근제한 태그를 적용하며 실시간 교통을 반영하지 않는다. |
| `kakao-mobility-directions` | [Kakao Mobility 길찾기 API](https://developers.kakaomobility.com/docs/navi-api/directions/) | 카카오모빌리티 | 실제 도로 이동시간 기반 응급기관 추천과 이송 경로 표시 | 카카오모빌리티 API 이용약관 및 쿼터 정책 준수 | `KAKAO_MOBILITY_REST_API_KEY`를 서버 환경변수로만 보관한다. 응답 경로는 요청 시점 교통·도로 정보에 따라 달라질 수 있다. |
| `openai-responses` | [OpenAI Responses API](https://developers.openai.com/api/docs/guides/text) | OpenAI 또는 관리자가 지정한 OpenAI 호환 제공자 | 시설·재난·갱신상태 요약 데이터를 근거로 한 AI 질의응답 | OpenAI 서비스 약관·API 데이터 정책 또는 호환 제공자의 약관 준수 | `OPENAI_API_KEY`는 서버 환경변수로만 보관한다. 원시 레코드 대신 검색 결과와 집계값만 전송하며 응답은 참고 정보다. |
| `kakao-local-geocoding` | [Kakao Local 주소 검색 API](https://developers.kakao.com/docs/latest/ko/local/dev-guide) | 카카오 | 주소 기반 공공 데이터의 위도/경도 보강 | 카카오 Developers 이용약관 및 Local API 정책 준수 | `KAKAO_REST_API_KEY`는 서버 환경변수로만 보관한다. 원문 API 응답은 sudo/debug 용도 외 공개하지 않는다. |
| `naver-kakao-map-links` | [네이버 지도](https://map.naver.com/), [카카오맵](https://map.kakao.com/) 웹 검색 링크 | 네이버 / 카카오 | 시설 위치를 외부 지도에서 열기 | 각 지도 서비스 링크/이용약관 준수 | 포인트 상세 팝업에서 외부 지도 검색 링크만 제공하며, 별도 API 호출이나 키 저장은 하지 않는다. |
| `fire-stations` | 전국 소방서 좌표현황 | 소방청 / 공공데이터포털 | 소방서 및 119안전센터 지도 포인트 | 공공데이터포털 개별 데이터셋 이용허락조건 확인 필요 | 납품 전 데이터셋 상세 화면의 최신 라이선스와 제공기관 표기를 재확인한다. |
| `police-stations` | 전국 지구대 파출소 주소 현황 | 경찰청 / 공공데이터포털 | 경찰서/지구대/파출소 지도 포인트 | 공공데이터포털 개별 데이터셋 이용허락조건 확인 필요 | 납품 전 데이터셋 상세 화면의 최신 라이선스와 제공기관 표기를 재확인한다. |
| `aeds` | AED 위치정보 조회 서비스 | 국립중앙의료원 / 공공데이터포털 | 자동심장충격기 지도 포인트 | 공공데이터포털 개별 데이터셋 이용허락조건 확인 필요 | 납품 전 데이터셋 상세 화면의 최신 라이선스와 제공기관 표기를 재확인한다. |
| `childcare-centers` | [어린이집유치원좌표정보](https://data.seoul.go.kr/bsp/wgs/dataView/data300View/10054.do) | 서울특별시 / 서울 열린데이터광장 | 전국 어린이집 및 유치원 지도 포인트 | 공공누리 제1유형: 출처표시, 상업적 이용 및 변경 가능 | 데이터 ID `10054`와 공개 열 목록을 POST해 받은 MS949 CSV를 UTF-8로 변환한다. |
| `pharmacies` | [전국 약국 정보 조회 서비스](https://www.data.go.kr/data/15000576/openapi.do), [건강보험심사평가원_약국정보서비스](https://www.data.go.kr/data/15001673/openapi.do), [행정안전부_건강_약국 조회서비스](https://www.data.go.kr/data/15154822/openapi.do) | 국립중앙의료원 / 건강보험심사평가원 / 행정안전부 / 공공데이터포털 | 약국 위치, 연락처, 운영시간 지도 포인트 | NMC: 이용허락범위 제한 없음, HIRA: 공공데이터포털 개별 이용조건 준수, MOIS: 이용허락범위 제한 없음 | NMC FullData를 우선 사용한다. NMC가 403이면 HIRA 약국정보서비스를 시도하고, HIRA도 차단되면 행정안전부 건강_약국 조회서비스를 시도한다. 행정안전부 좌표는 EPSG:5174 중부원점TM을 WGS84 근사 좌표로 변환한다. 모든 서비스의 `PUBLIC_DATA_API_KEY`는 서버 환경변수로만 보관하며, 활용신청이 승인되지 않으면 403이 발생할 수 있다. |
| `hospitals` | [전국 병·의원 찾기 서비스](https://www.data.go.kr/data/15000736/openapi.do) | 국립중앙의료원 / 공공데이터포털 | 병의원 위치, 연락처, 진료시간, 달빛어린이병원 여부 | 이용허락범위 제한 없음 | FullData와 달빛어린이병원 목록을 기관 ID로 병합한다. |
| `emergency-medical-institutions` | [전국 응급의료기관 정보 조회 서비스](https://www.data.go.kr/data/15000563/openapi.do) | 국립중앙의료원 / 공공데이터포털 | 응급의료기관 위치, 실시간 병상·진료역량, 병원 추천과 이송 경로 계산 | 이용허락범위 제한 없음 | 기관 목록·기본정보·실시간 가용병상·중증질환 수용 가능 정보를 기관 ID로 병합한다. 전용 API가 403이면 병의원 FullData의 응급실 운영기관을 파생 후보로 사용하며 이 경우 실시간 병상은 제공하지 않는다. |
| `kma-earthquake` | 지진정보 조회서비스 | 기상청 / 공공데이터포털 | 최근 지진/지진해일 이벤트 표시 | 공공데이터포털 개별 데이터셋 이용허락조건 확인 필요 | 납품 전 데이터셋 상세 화면의 최신 라이선스와 제공기관 표기를 재확인한다. |
| `schools` | [전국초중등학교위치표준데이터](https://www.data.go.kr/data/15021148/standard.do) | 재단법인 한국지방교육행정연구재단 / 공공데이터포털 | 초등학교, 중학교, 고등학교 지도 포인트 | 공공데이터포털 표준데이터 이용조건 및 개별 제공기관 조건 확인 필요 | 전국 단위 병합 표준데이터이며 시점에 따라 일부 데이터 시차가 있을 수 있다. 납품 전 최신 제공기관/라이선스를 재확인한다. |
| `universities` | [교육부_대학교 주소기반 좌표정보_20251126](https://www.data.go.kr/data/15138981/fileData.do) | 교육부 / 공공데이터포털 | 대학교 캠퍼스 지도 포인트 | 이용허락범위 제한 없음 | 원문 XLSX를 다운로드해 첫 워크시트의 도로명주소, 지번주소, 위도, 경도, 대표번호를 사용한다. |
