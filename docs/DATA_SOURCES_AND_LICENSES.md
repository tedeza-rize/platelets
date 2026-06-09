# Data Sources And Licenses

Every new dataset, API, generated file, or external data derivative must be recorded here and in `src/lib/data-licenses.ts`, which powers the in-app `/licenses` page.

Do not commit real API keys. Keep secrets in deployment environment variables such as `.env.local`.

| ID | Source | Provider | Usage | License | Notes |
| --- | --- | --- | --- | --- | --- |
| `seoul-realtime-population` | [서울시 실시간 인구데이터](https://data.seoul.go.kr/dataList/OA-21778/A/1/datasetView.do), 서울시 주요 121장소 목록, 서울시 주요 121장소 영역 | 서울특별시 / 서울 열린데이터광장 | 서울 121개 핫스팟 영역 표시와 클릭 시 실시간 혼잡도/인구 범위 조회 | 공공누리 제1유형: 출처표시, 상업적 이용 및 변경 가능 | `SEOUL_OPEN_API_KEY` 환경변수 사용. API는 한 번에 1개 장소만 조회한다. |
| `fire-stations` | 전국 소방서 좌표현황 | 소방청 / 공공데이터포털 | 소방서 및 119안전센터 지도 포인트 | 공공데이터포털 개별 데이터셋 이용허락조건 확인 필요 | 납품 전 데이터셋 상세 화면의 최신 라이선스와 제공기관 표기를 재확인한다. |
| `police-stations` | 전국 지구대 파출소 주소 현황 | 경찰청 / 공공데이터포털 | 경찰서/지구대/파출소 지도 포인트 | 공공데이터포털 개별 데이터셋 이용허락조건 확인 필요 | 납품 전 데이터셋 상세 화면의 최신 라이선스와 제공기관 표기를 재확인한다. |
| `aeds` | AED 위치정보 조회 서비스 | 국립중앙의료원 / 공공데이터포털 | 자동심장충격기 지도 포인트 | 공공데이터포털 개별 데이터셋 이용허락조건 확인 필요 | 납품 전 데이터셋 상세 화면의 최신 라이선스와 제공기관 표기를 재확인한다. |
| `kma-earthquake` | 지진정보 조회서비스 | 기상청 / 공공데이터포털 | 최근 지진/지진해일 이벤트 표시 | 공공데이터포털 개별 데이터셋 이용허락조건 확인 필요 | 납품 전 데이터셋 상세 화면의 최신 라이선스와 제공기관 표기를 재확인한다. |
| `schools` | [전국초중등학교위치표준데이터](https://www.data.go.kr/data/15021148/standard.do) | 재단법인 한국지방교육행정연구재단 / 공공데이터포털 | 초등학교, 중학교, 고등학교 지도 포인트 | 공공데이터포털 표준데이터 이용조건 및 개별 제공기관 조건 확인 필요 | 전국 단위 병합 표준데이터이며 시점에 따라 일부 데이터 시차가 있을 수 있다. 납품 전 최신 제공기관/라이선스를 재확인한다. |
| `universities` | [교육부_대학교 주소기반 좌표정보_20251126](https://www.data.go.kr/data/15138981/fileData.do) | 교육부 / 공공데이터포털 | 대학교 캠퍼스 지도 포인트 | 이용허락범위 제한 없음 | 원문 XLSX를 다운로드해 첫 워크시트의 도로명주소, 지번주소, 위도, 경도, 대표번호를 사용한다. |
