이번 응답은 분석 전용이며, 코드 수정은 수행하지 않았습니다.

# 보안 검토 및 아키텍처 분석 리포트

---

## 첫 번째 섹션: 프로젝트 전체 요약

*   **프로젝트의 전체 목적 추정**
    소방청, 경찰청, 행안부 등 정부 기관 및 현장 대응 인력이 실시간으로 재난 및 사고 대응을 관리하고 모니터링하기 위한 "통합 재난 대응 플랫폼(Disaster Response MVP)"입니다. 전국 공공 빅데이터(소방용수, 대상물, 구급/구조 출동, 집회/시위 일정 등)를 수집하여 지도에 시각화하고, 현장 요원(field_worker)과 관제 요원(dispatcher), 관리자(admin/sudo) 간의 효율적인 사고 관리 및 권한 분리를 수행하는 폐쇄형(인가자 전용) 웹 애플리케이션으로 추정됩니다.
*   **주요 기술 스택**
    *   **Frontend & Backend:** Next.js (16.2.7), React (19), TypeScript
    *   **Database:** SQLite (로컬/단일 프로세스 기본), PostgreSQL, MySQL/MariaDB 지원 (`better-sqlite3`, `pg`, `mysql2` 사용)
    *   **Map & GIS:** MapLibre GL, VWorld, Kakao Local API, Kakao Mobility, OpenStreetMap (Overpass API)
    *   **Auth & Security:** PBKDF2 (비밀번호 해싱), AES-256-GCM (시크릿 암호화), 자체 세션 쿠키 발급
    *   **Integration:** OpenAI API, MCP (Model Context Protocol), 공공데이터포털 API, PWA (Service Worker)
*   **주요 실행 흐름**
    1.  사용자(현장 요원, 관제 요원 등)가 `/login`을 통해 인증 후 각 권한에 맞는 대시보드(`/field`, `/dashboard`, `/admin/users`)로 라우팅.
    2.  재난 사고 발생 시 `/incidents` API를 통해 사고 접수. 현장 요원이 위치(좌표)와 위험도를 입력.
    3.  사고 이벤트는 SSE(Server-Sent Events)를 통해 대시보드에 실시간 전파 및 Web Push Notification 트리거.
    4.  백엔드는 외부 API(Kakao, VWorld, 기상청 등) 및 내부 DB 데이터를 결합하여 지도 시각화, 최적 경로 계산(A* 또는 ITS API) 및 대응 리소스를 추천.
*   **앱 또는 모듈 구성 요약**
    *   `src/app/api/auth`: 로그인, 로그아웃, 세션 관리 모듈
    *   `src/app/api/admin`: 사용자 관리, DB 마이그레이션, 설정 관리 등 시스템 관제 모듈
    *   `src/app/api/disaster`: 재난 사고(Incident) CRUD, 상태 변경, SSE 알림 전송 및 리포트(Excel) 출력 모듈
    *   `src/app/api/geocoding` & `routing`: 주소 검색, 좌표 변환, 출동 경로 탐색 모듈
    *   `src/app/api/points` & `datasets`: 화재, 구급, 공공 데이터 스케줄링 및 마커 데이터 서빙 모듈
    *   `src/lib/database`: Multi-DB 지원을 위한 Query 어댑터 및 스키마 관리 모듈
*   **핵심 데이터 흐름**
    *   **사고 데이터:** 사용자 요청 -> `src/app/api/disaster/incidents` -> `IncidentService` -> DB(`disaster_incidents`, `disaster_incident_events`) -> Event Emitter (SSE) -> Dashboard UI.
    *   **공공 데이터 크롤링/수집:** Cron 또는 관리자 수동 트리거 -> `src/lib/dataset-import.ts` -> 공공데이터 API 호출 -> 파싱 및 지오코딩 -> DB(`points` 또는 `assembly_protests`).
*   **외부 시스템과 연결되는 지점**
    *   **지도 및 지오코딩:** 카카오 로컬 API, 브이월드 API, 카카오모빌리티 API, OSM(Overpass).
    *   **데이터 소스:** 공공데이터포털 API (건강보험심사평가원, 중앙응급의료센터 등), 기상청 지진 API, 경찰청 집회/시위 게시판 웹 크롤링.
    *   **AI 연동:** OpenAI Responses API 연동 (사용자 질문 분석 등).
*   **민감 기능이 존재하는 지점**
    *   최초 시스템 셋업 및 DB, 시크릿 키 주입 (`src/app/api/setup/complete/route.ts`).
    *   사용자 생성, 권한(role) 변경 및 삭제 (`src/features/users/user-account-service.ts`).
    *   세션 생성 및 쿠키 발급 (`src/lib/auth-sessions.ts`).
*   **현재 구조에서 가장 중요해 보이는 영역**
    *   데이터베이스 접근 제어 어댑터 영역 (`src/lib/database/*`)
    *   사용자 인증 및 세션 검증 영역 (`src/lib/access-control.ts`, `src/lib/server-session.ts`)
    *   외부 API 키 암호화 및 복호화 처리 영역 (`src/lib/secret-box.ts`, `src/lib/setup-state.ts`)

---

## 두 번째 섹션: 앱 또는 모듈별 역할 분석

#### 1. Auth & Access Control 모듈
*   **주요 역할:** 사용자 인증(로그인/로그아웃), 세션 생성 및 검증, 역할(Role) 기반 라우팅 및 접근 제어.
*   **주요 파일:** `src/app/api/auth/login/route.ts`, `src/lib/auth-sessions.ts`, `src/lib/access-control.ts`, `src/lib/server-session.ts`
*   **주요 클래스 또는 함수:** `createAccessSession`, `requireAccessSession`, `requireAccessRole`, `canAccessRole`
*   **이 앱이 의존하는 다른 앱 또는 모듈:** Users (사용자 DB), Secret Box, Rate Limit
*   **이 앱에 의존하는 다른 앱 또는 모듈:** 모든 API 라우트 및 페이지 렌더러 (보안의 핵심 진입점)
*   **데이터베이스 접근 여부:** 예 (사용자 검증 및 세션 정보 저장: 현재 세션을 DB의 `app_settings`에 JSON으로 직렬화하여 저장함)
*   **외부 API 접근 여부:** 아니오
*   **인증 또는 인가 관련 여부:** 예 (핵심)
*   **사용자 입력 처리 여부:** 예 (username, password)
*   **민감 정보 처리 여부:** 예 (비밀번호 원문 해싱, 해시 토큰 생성)
*   **트래픽이 몰릴 가능성:** 중간 (로그인 시도)
*   **보안상 중요도:** 매우 높음
*   **성능상 중요도:** 중간 (PBKDF2 연산 비용 존재)
*   **유지보수상 중요도:** 매우 높음

#### 2. User Administration 모듈
*   **주요 역할:** 시스템 관리자(`sudo`, `admin`)가 내부 작업자(현장 요원, 관제 요원)의 계정을 생성, 수정(권한 변경), 삭제.
*   **주요 파일:** `src/app/api/admin/users/route.ts`, `src/features/users/user-account-service.ts`, `src/lib/users.ts`
*   **주요 클래스 또는 함수:** `createManagedUser`, `updateManagedUser`, `deleteManagedUser`, `hashPassword`
*   **이 앱이 의존하는 다른 앱 또는 모듈:** Auth & Access Control, Database
*   **이 앱에 의존하는 다른 앱 또는 모듈:** 프론트엔드 Admin UI
*   **데이터베이스 접근 여부:** 예 (`users` 테이블)
*   **외부 API 접근 여부:** 아니오
*   **인증 또는 인가 관련 여부:** 예 (관리자 권한 필수)
*   **사용자 입력 처리 여부:** 예 (새로운 사용자 정보)
*   **민감 정보 처리 여부:** 예 (비밀번호 변경 및 저장)
*   **트래픽이 몰릴 가능성:** 낮음
*   **보안상 중요도:** 매우 높음 (권한 상승 및 탈취 방지 필수)
*   **성능상 중요도:** 낮음
*   **유지보수상 중요도:** 높음

#### 3. Disaster Incidents 모듈
*   **주요 역할:** 재난 및 사고의 신고 접수, 상태 업데이트(보고됨, 출동함, 종료됨), 삭제를 담당하고 변경 이벤트를 발행.
*   **주요 파일:** `src/app/api/disaster/incidents/route.ts`, `src/lib/disaster-response/incident-service.ts`, `src/lib/disaster-response/incident-repository.ts`
*   **주요 클래스 또는 함수:** `IncidentService.createIncident`, `updateIncidentStatus`
*   **이 앱이 의존하는 다른 앱 또는 모듈:** Access Control, DB Repository, Event Emitter (SSE)
*   **이 앱에 의존하는 다른 앱 또는 모듈:** Dashboard UI, Notification 모듈
*   **데이터베이스 접근 여부:** 예 (`disaster_incidents`, `disaster_incident_events` 테이블)
*   **외부 API 접근 여부:** 아니오
*   **인증 또는 인가 관련 여부:** 예 (`field_worker` 이상 권한 필요)
*   **사용자 입력 처리 여부:** 예 (사고 내용, 위경도 좌표, 주소 텍스트)
*   **민감 정보 처리 여부:** 예 (현장 상황 및 위치 데이터)
*   **트래픽이 몰릴 가능성:** 높음 (대규모 재난 시 동시다발적 접수 가능)
*   **보안상 중요도:** 높음 (입력값 조작 및 비인가 데이터 열람 방지)
*   **성능상 중요도:** 높음 (원활하고 빠른 쓰기 및 읽기)
*   **유지보수상 중요도:** 높음

#### 4. Database Core & Migration 모듈
*   **주요 역할:** 애플리케이션 전반의 DB 연결, 쿼리 수행, 트랜잭션 관리, 스키마 마이그레이션 관리. 다중 환경(SQLite/PostgreSQL/MySQL) 호환 추상화 제공.
*   **주요 파일:** `src/lib/database/config.ts`, `src/lib/database/postgresql-adapter.ts`, `src/lib/database/mysql-adapter.ts`, `src/lib/database/migration.ts`, `src/lib/points-db.ts`
*   **주요 클래스 또는 함수:** `openDatabaseClient`, `migrateDatabase`, `withDatabaseWriteTransaction`
*   **이 앱이 의존하는 다른 앱 또는 모듈:** Secret Box
*   **이 앱에 의존하는 다른 앱 또는 모듈:** 시스템 내 모든 데이터 관련 모듈
*   **데이터베이스 접근 여부:** 예
*   **외부 API 접근 여부:** 아니오
*   **인증 또는 인가 관련 여부:** 부분적 (설정 변경 시 `sudo` 필요)
*   **사용자 입력 처리 여부:** 아니오 (내부 쿼리)
*   **민감 정보 처리 여부:** 예 (DB 연결 문자열 및 인증 정보 암호화 보관)
*   **트래픽이 몰릴 가능성:** 매우 높음 (모든 요청의 병목 가능성 지점)
*   **보안상 중요도:** 매우 높음 (SQL Injection 방지 및 연결 정보 유출 차단)
*   **성능상 중요도:** 매우 높음 (Connection Pool 관리, 트랜잭션 락)
*   **유지보수상 중요도:** 매우 높음

#### 5. External Data Crawling & Dataset Import 모듈
*   **주요 역할:** 집회/시위 게시판, 공공데이터, 기상청 지진 정보 등을 크롤링/가져오기 하여 데이터베이스에 적재.
*   **주요 파일:** `src/app/api/assembly-protests/crawl/route.ts`, `src/lib/dataset-import.ts`, `src/lib/assembly-protests.ts`, `src/lib/medical-dataset-import.ts`
*   **주요 클래스 또는 함수:** `crawlDailyAssemblyBoards`, `importDataset`, `geocodeAssemblyRecord`
*   **이 앱이 의존하는 다른 앱 또는 모듈:** 외부 공공 API, DB Core, Geocoding 모듈
*   **이 앱에 의존하는 다른 앱 또는 모듈:** Points API
*   **데이터베이스 접근 여부:** 예 (`dataset_updates`, `points`, `assembly_protests`)
*   **외부 API 접근 여부:** 예 (매우 빈번함)
*   **인증 또는 인가 관련 여부:** 예 (배치 및 관리자 전용)
*   **사용자 입력 처리 여부:** 아니오
*   **민감 정보 처리 여부:** 중간 (외부 데이터이긴 하나, 시스템의 주요 정보원)
*   **트래픽이 몰릴 가능성:** 낮음 (주로 백그라운드나 스케줄러를 통해 동작)
*   **보안상 중요도:** 중간 (SSRF 가능성 및 크롤링 대상 위변조 대응)
*   **성능상 중요도:** 중간 (외부 API 타임아웃, 대량 데이터 파싱 시 메모리 부하)
*   **유지보수상 중요도:** 중간

#### 6. Secret Box & Setup 모듈
*   **주요 역할:** 최초 설치 시 슈퍼 관리자 생성 및 중요 API Key, DB Connection String을 AES-256-GCM 알고리즘으로 암호화하여 저장/복호화.
*   **주요 파일:** `src/lib/secret-box.ts`, `src/lib/setup-state.ts`, `src/app/api/setup/complete/route.ts`
*   **주요 클래스 또는 함수:** `protectSecret`, `revealSecret`, `completeSetup`
*   **이 앱이 의존하는 다른 앱 또는 모듈:** Crypto, FS
*   **이 앱에 의존하는 다른 앱 또는 모듈:** Database Core, 외부 API 연동 모듈
*   **데이터베이스 접근 여부:** 예 (`app_settings`) 및 로컬 파일(`data/.platelets-secret-key`)
*   **외부 API 접근 여부:** 아니오
*   **인증 또는 인가 관련 여부:** 불필요 (단, 셋업 전만 오픈)
*   **사용자 입력 처리 여부:** 예 (각종 Key 및 관리자 패스워드)
*   **민감 정보 처리 여부:** 매우 높음 (모든 시크릿 키 관리)
*   **트래픽이 몰릴 가능성:** 낮음
*   **보안상 중요도:** 매우 높음 (시스템 전체 보안의 근간)
*   **성능상 중요도:** 낮음
*   **유지보수상 중요도:** 높음

---

## 세 번째 섹션: 앱 또는 모듈 수정 우선순위 제안

정부 기관(소방청, 경찰청, 행안부)의 보안 수준에 맞춰, 시스템 근간의 보안 취약점과 데이터 무결성 병목을 가장 먼저 해소해야 합니다.

1. **Auth & Session / Secret Box 모듈**
*   **먼저 봐야 하는 이유:** 정부망에 배포되는 시스템의 세션/인증 우회, 그리고 시크릿 정보 탈취는 치명적입니다. 쿠키 속성 불량, 세션의 DB 평문/약한 구조 직렬화, 암호화 키 관리 취약점 등은 제로 데이 공격 대상이 됩니다.
*   **보안 위험도:** 높음
*   **성능 병목 가능성:** 중간
*   **유지보수 위험도:** 중간
*   **비즈니스 중요도:** 높음
*   **수정 난이도:** 높음
*   **전체 판단 근거:** 현재 세션을 DB (`app_settings`) 에 JSON 배열 형식으로 밀어 넣는 로직이 있습니다(`readSessions() / writeSessions()`). 이는 동시성 이슈(Race condition)뿐만 아니라, 세션 탈취 및 스푸핑 가능성을 내포하고 있습니다. 쿠키 속성 부여에도 취약점(예: Secure 플래그 누락)이 보입니다.
*   **먼저 확인해야 할 파일:** `src/lib/auth-sessions.ts`, `src/app/api/auth/login/route.ts`, `src/lib/secret-box.ts`
*   **다음 단계에서 상세 분석해야 할 항목:** 세션 저장 방식의 동시성 결함, HTTPOnly/Secure 쿠키 적용 여부, AES-256-GCM 시크릿 키가 로컬 파일에 평문 저장되는 구조적 취약점.

2. **User Administration 모듈**
*   **먼저 봐야 하는 이유:** 인가 우회(IDOR)나 관리자 권한 탈취를 통한 악의적 계정 조작은 관제 시스템의 통제력을 완전히 잃게 만듭니다.
*   **보안 위험도:** 높음
*   **성능 병목 가능성:** 낮음
*   **유지보수 위험도:** 중간
*   **비즈니스 중요도:** 높음
*   **수정 난이도:** 중간
*   **전체 판단 근거:** 사용자의 권한 상승(Escalation)을 통제하는 로직(`isAdminCapable` 등)이 컨트롤러 수준에서 단편적으로 구현되어 있어, 입력값 조작 시 우회될 위험성이 존재합니다.
*   **먼저 확인해야 할 파일:** `src/features/users/user-account-service.ts`, `src/app/api/admin/users/[id]/route.ts`
*   **다음 단계에서 상세 분석해야 할 항목:** API 입력값(Payload) 엄격 검증(Zod 등의 부재 확인 필요), 본인 권한 승급 취약점 여부.

3. **Database Core 모듈**
*   **먼저 봐야 하는 이유:** 재난 상황 시 데이터 정합성 보장 및 쿼리 퍼포먼스는 생명선과도 같습니다.
*   **보안 위험도:** 중간
*   **성능 병목 가능성:** 높음
*   **유지보수 위험도:** 높음
*   **비즈니스 중요도:** 높음
*   **수정 난이도:** 높음
*   **전체 판단 근거:** 현재 `withDatabaseWriteTransaction` 함수 등에서 SQLite 사용 시 단일 프로세스 큐를 인메모리로 처리하고 있습니다. 다중 인스턴스 배포 시 트랜잭션 락 문제나 N+1 성능 병목 가능성이 커 보입니다.
*   **먼저 확인해야 할 파일:** `src/lib/points-db-modules/connection.ts`, `src/lib/database/sqlite-adapter.ts`, `src/lib/points-db.ts`
*   **다음 단계에서 상세 분석해야 할 항목:** 대량 크롤링 시 동시 트랜잭션 충돌 여부, 외부 입력값에 대한 ORM/SQL 파라미터 바인딩 누락 가능성 확인.

4. **Disaster Incidents 모듈**
*   **먼저 봐야 하는 이유:** 핵심 비즈니스 로직으로, 사용자 요청이 가장 많이 지나가고 모니터링 체계와 직접 연관됩니다.
*   **보안 위험도:** 중간
*   **성능 병목 가능성:** 높음
*   **유지보수 위험도:** 중간
*   **비즈니스 중요도:** 높음
*   **수정 난이도:** 중간
*   **전체 판단 근거:** Rate limit이 `enforceRateLimit` 라는 인메모리 함수로 동작하여 다중 서버 환경에서 무력화됩니다. SSE를 통한 이벤트 발송 시 성능 병목 우려가 있습니다.
*   **먼저 확인해야 할 파일:** `src/app/api/disaster/incidents/route.ts`, `src/lib/rate-limit.ts`
*   **다음 단계에서 상세 분석해야 할 항목:** 인메모리 Rate limit 로직의 구조적 한계점, XSS 방어를 위한 입력값(Description, Address 등) 처리 여부.

5. **External Data & Dataset Import 모듈**
*   **먼저 봐야 하는 이유:** 크롤링 및 외부 API 호출이 메인 스레드를 블로킹할 위험이 있으며, 외부 주입 공격(SSRF 등)에 노출될 수 있습니다.
*   **보안 위험도:** 중간
*   **성능 병목 가능성:** 높음
*   **유지보수 위험도:** 중간
*   **비즈니스 중요도:** 중간
*   **수정 난이도:** 중간
*   **전체 판단 근거:** 외부 경찰청 등 웹사이트 내용을 파싱할 때 악의적인 스크립트나 매우 큰 페이로드가 들어올 경우 메모리 OOM, 파싱 에러 등으로 시스템 장애가 유발될 수 있습니다.
*   **먼저 확인해야 할 파일:** `src/lib/dataset-import.ts`, `src/app/api/assembly-protests/crawl/route.ts`
*   **다음 단계에서 상세 분석해야 할 항목:** 크롤링 응답 데이터 크기 제한, 외부 연결 타임아웃 미설정 여부, HTML 파싱 취약점.

---

## 네 번째 섹션: 보안 취약 가능성 분석

#### 동시성 처리가 결여된 DB 기반 세션 관리 (Race Condition을 통한 세션 탈취/증발 위험)
*   **위치:** `src/lib/auth-sessions.ts` (`readSessions`, `writeSessions`, `createAccessSession`, `revokeAccessSession` 등)
*   **관련 코드 흐름 요약:** 새로운 로그인이 발생하면 `readSessions()`로 DB의 `app_settings` 테이블에서 전체 세션 배열을 로드하고, 배열에 `push(session)`한 뒤, `writeSessions()`를 통해 전체 배열을 JSON 문자열로 직렬화하여 DB에 덮어씌웁니다.
*   **왜 위험해 보이는지:** 로그인 및 로그아웃 요청이 동시다발적으로 발생할 경우(Race Condition), 덮어쓰기 과정에서 기존 유효한 세션이 소실되거나, 만료 처리된 세션이 다시 부활할 수 있습니다.
*   **공격자가 노릴 가능성이 있는 지점:** 세션 증발 현상을 이용하여 서비스 가용성을 해치는 DoS 공격(집중 로그인/로그아웃 반복)을 수행하거나, 로그아웃 타이밍에 레이스 컨디션을 발생시켜 이미 파기되어야 할 관리자 세션을 부활시키는 공격을 시도할 수 있습니다.
*   **실제 악용 절차가 아닌 방어적 관점의 위험 시나리오:** 사용자 A(관제요원)가 정상적으로 로그인하고 업무 중인데, 사용자 B(악의적 내부자 또는 외부자)가 스크립트로 수십 개의 엉터리 계정 로그인/로그아웃 요청을 동시다발적으로 던집니다. 세션 배열이 일관성 없이 덮어씌워져 A의 세션이 날아가 치명적 재난 상황에서 관제 기능이 마비될 수 있습니다.
*   **영향을 받을 수 있는 데이터 또는 기능:** 전체 시스템의 인증 및 세션 유지 기능
*   **위험도:** 높음
*   **발생 가능성:** 높음
*   **확인해야 할 추가 코드:** SQLite, MySQL 등 사용 DB에 상관없이 이 로직은 동시성 문제가 생깁니다. `app_settings`가 아닌 별도 `sessions` 테이블로 관리되는지 스키마 확인 필요.
*   **수정 방향:** 전체 배열을 JSON으로 덮어쓰는 방식을 폐기하고, 별도의 `sessions` 테이블을 생성하여 `INSERT`, `DELETE`, `UPDATE` 단위로 개별 레코드를 원자성(Atomic) 있게 관리해야 합니다.
*   **수정 시 주의할 점:** `sessions` 테이블 설계 시 인덱싱(Token Hash)을 걸어 속도를 보장해야 합니다.
*   **수정 후 테스트해야 할 항목:** `Promise.all` 등을 활용해 동시다발적인 세션 생성/파기 부하 테스트 수행 및 세션 소실 여부 확인.
*   **근거 코드 요약:**
    ```typescript
    const sessions = await readSessions();
    sessions.push(session);
    await writeSessions(sessions); // Race condition 발생 지점
    ```

#### Secure 플래그가 누락된 HTTPOnly 세션 쿠키 설정
*   **위치:** `src/app/api/auth/login/route.ts` (`POST` 함수 내부)
*   **관련 코드 흐름 요약:** 로그인 성공 시 `Set-Cookie` 헤더를 수동으로 작성하여 응답합니다. `${SESSION_COOKIE_NAME}=...; HttpOnly; SameSite=Lax; Path=/; Max-Age=28800` 형태로 전달합니다.
*   **왜 위험해 보이는지:** 쿠키 속성에 `Secure` 플래그가 누락되어 있습니다. 정부망이라 할지라도 네트워크 스니핑이나 강제적인 HTTP 다운그레이드 공격(SSL Stripping)을 통해 관리자의 세션 토큰이 네트워크 상에 평문으로 유출될 수 있습니다.
*   **공격자가 노릴 가능성이 있는 지점:** 네트워크 중간자 공격(MitM)을 수행하는 공격자가 HTTP 트래픽을 도청하여 쿠키 값을 탈취할 수 있습니다.
*   **실제 악용 절차가 아닌 방어적 관점의 위험 시나리오:** 카페나 불안정한 공공망(현장 요원)에서 접속할 때, HTTPS에서 HTTP로 연결이 다운그레이드되면 브라우저가 `Secure` 플래그 없는 세션 쿠키를 평문으로 전송해버립니다. 탈취된 세션으로 시스템에 무단 접근하여 관리자 권한을 행사할 수 있습니다.
*   **영향을 받을 수 있는 데이터 또는 기능:** 시스템에 접근 권한이 있는 모든 데이터 (Session Hijacking)
*   **위험도:** 높음
*   **발생 가능성:** 중간
*   **확인해야 할 추가 코드:** 로그아웃(`src/app/api/auth/logout/route.ts`) 시에도 Secure 쿠키를 삭제하고 있는지 확인.
*   **수정 방향:** 운영 환경(HTTPS)에서는 반드시 `Secure` 속성을 추가해야 합니다.
*   **수정 시 주의할 점:** 리버스 프록시 환경에서는 프록시 설정에서 쿠키 속성이 덮어씌워지지 않는지 2차 확인이 필요합니다.
*   **수정 후 테스트해야 할 항목:** HTTPS 환경에서 로그인 후 브라우저 개발자 도구의 Application 탭에서 세션 쿠키의 `Secure` 플래그 확인.
*   **근거 코드 요약:**
    ```typescript
    "Set-Cookie": `${SESSION_COOKIE_NAME}=${encodeURIComponent(session.token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=28800`
    ```

#### AES-256-GCM 시크릿 마스터 키의 로컬 파일 평문 저장
*   **위치:** `src/lib/secret-box.ts` (`getSecretMaterial` 함수)
*   **관련 코드 흐름 요약:** DB의 API 연결 정보 등을 암호화하기 위해 `getSecretMaterial()` 함수가 `data/.platelets-secret-key` 파일을 읽고, 파일이 없으면 랜덤 생성하여 파일에 평문으로 씁니다.
*   **왜 위험해 보이는지:** 시스템에서 가장 중요한 마스터 키가 소스코드 옆 `data/` 디렉터리에 평문 파일로 존재합니다. LFI(Local File Inclusion) 취약점이나 백업 파일 유출 시 마스터 키가 고스란히 탈취됩니다. 암호화의 의미가 무색해집니다.
*   **공격자가 노릴 가능성이 있는 지점:** 디렉터리 트래버설(Directory Traversal)이나 파일 다운로드 취약점을 찾아내어 `../../data/.platelets-secret-key` 파일을 읽어들이는 공격을 시도할 것입니다.
*   **실제 악용 절차가 아닌 방어적 관점의 위험 시나리오:** 서버 관리자의 실수로 `data/` 폴더가 압축되어 웹 루트에 임시 백업되거나, 애플리케이션 내의 사소한 파일 다운로드 경로 결함으로 인해 `.platelets-secret-key` 파일이 유출됩니다. 공격자는 탈취한 키로 DB(SQLite 등)를 덤프 뜬 뒤, 내부의 모든 외부 연동 API 키(카카오, 오픈AI, 공공데이터 등)를 복호화해 2차 공격을 수행합니다.
*   **영향을 받을 수 있는 데이터 또는 기능:** 시스템에 연동된 모든 외부 API 인프라 과금 탈취, 암호화된 모든 설정값 노출
*   **위험도:** 매우 높음
*   **발생 가능성:** 낮음
*   **확인해야 할 추가 코드:** 해당 마스터 키를 메모리 변수(환경 변수)로 받아오는 로직이 전무한지.
*   **수정 방향:** 마스터 키는 파일에 저장하지 말고 반드시 환경 변수(Environment Variable)나 외부 비밀 관리자(AWS Secrets Manager, HashiCorp Vault 등)로부터 주입받아야 합니다.
*   **수정 시 주의할 점:** 이미 암호화되어 저장된 DB의 데이터를 마이그레이션 해야 하므로 다운타임 및 키 교체 프로세스를 면밀히 설계해야 합니다.
*   **수정 후 테스트해야 할 항목:** `data/.platelets-secret-key` 파일을 삭제한 상태에서도 환경 변수로 키를 주입받아 애플리케이션이 정상 부팅되고 복호화를 수행하는지 테스트.
*   **근거 코드 요약:**
    ```typescript
    const secretFilePath = path.join(dataDirectory, SECRET_FILE_NAME);
    const generatedSecret = randomBytes(32).toString("base64url");
    fs.writeFileSync(secretFilePath, `${generatedSecret}\n`, { ... });
    ```

#### 다중 인스턴스(서버리스) 환경에서 무력화되는 인메모리 Rate Limit
*   **위치:** `src/lib/rate-limit.ts` (`enforceRateLimit` 함수)
*   **관련 코드 흐름 요약:** API 요청에 대해 IP(`x-forwarded-for`, `x-real-ip`)를 기준으로 `const buckets = new Map<string, Bucket>();` 맵(Map) 메모리 변수에 요청 카운트를 누적합니다.
*   **왜 위험해 보이는지:** 메모리에 저장하므로 Node.js 프로세스를 2개 이상 띄우거나 서버리스 환경으로 배포하는 순간, 각각의 인스턴스가 독립적인 Rate Limit을 갖게 됩니다. 30회 제한이 3개의 인스턴스에서는 90회로 늘어납니다.
*   **공격자가 노릴 가능성이 있는 지점:** 로그인 Brute Force 공격 시, 로드밸런서를 통해 트래픽을 분산시키면 인스턴스 개수만큼 제한이 완화되는 점을 악용하여 계정 탈취 가능성을 높일 수 있습니다.
*   **실제 악용 절차가 아닌 방어적 관점의 위험 시나리오:** 악의적 공격자가 스크립트를 사용하여 초당 1,000건의 비밀번호 대입 공격을 시도합니다. 서버가 오토스케일링(Auto-scaling)되며 인스턴스가 늘어날 때마다 공격자는 무한대에 가까운 횟수를 시도할 수 있어 계정 방어가 완전히 뚫립니다.
*   **영향을 받을 수 있는 데이터 또는 기능:** 관리자 계정 탈취 (무차별 대입 공격), 외부 데이터 크롤링 악의적 반복
*   **위험도:** 중간
*   **발생 가능성:** 높음 (다중 인스턴스 구성 시)
*   **확인해야 할 추가 코드:** Nginx나 API Gateway 단에서 별도의 Rate Limit을 걸고 있는지 배포 인프라 설정 확인 필요.
*   **수정 방향:** Rate Limit 정보를 Redis나 공유 DB 테이블(`api_usage_windows` 등)을 이용해 중앙에서 통제하도록 아키텍처를 변경해야 합니다.
*   **수정 시 주의할 점:** DB를 통한 Rate Limit 구현 시 병목 현상(Bottleneck)이 발생하지 않도록 비동기 처리나 인메모리 캐시(Redis) 사용을 강력히 권장합니다.
*   **수정 후 테스트해야 할 항목:** 2개의 서버 프로세스를 띄운 후 로드밸런싱을 통해 번갈아가며 요청했을 때, 지정된 횟수에서 429 Too Many Requests 에러가 정상적으로 떨어지는지 확인.
*   **근거 코드 요약:**
    ```typescript
    const buckets = new Map<string, Bucket>();
    const current = buckets.get(key);
    // ... 인메모리에 계속 누적
    ```

#### XSS(Cross Site Scripting) 취약 가능성을 내포한 외부 데이터 렌더링
*   **위치:** `src/lib/dataset-import.ts` 및 프론트엔드 React 컴포넌트 출력부 (추가 확인 필요)
*   **관련 코드 흐름 요약:** 경찰청 웹사이트의 집회/시위 게시글 본문(`board HTML`)을 그대로 가져오고 파싱하여 DB(`assembly_protests`의 `raw_json` 및 주요 파생 컬럼)에 밀어넣고, 클라이언트로 서빙합니다.
*   **왜 위험해 보이는지:** 외부(정부가 아닌 대외 사이트)에서 수집한 데이터 문자열 속에 악성 `<script>` 태그나 `javascript:alert(1)` 류의 코드가 포함되어 있을 가능성을 배제할 수 없습니다. 특히 `README.md`에 "HTML: popup builders escape source text"라는 정책이 있으나, 소스코드 내 엄격한 Sanitizer(예: `DOMPurify`) 라이브러리가 보이지 않습니다.
*   **공격자가 노릴 가능성이 있는 지점:** 경찰청 집회 게시판 등 외부 크롤링 소스에 임의의 악성 스크립트를 삽입해 둡니다. (Stored XSS의 외부 변형). 관리자가 이 시스템 대시보드에서 해당 사고 위치의 팝업을 열 때 스크립트가 실행되게 합니다.
*   **실제 악용 절차가 아닌 방어적 관점의 위험 시나리오:** 악의적인 시위 주동자가 해당 게시판에 악성 페이로드(예: Session 쿠키를 빼내거나 `admin` API를 쏘는 스크립트)를 심어둡니다. 시스템은 이를 크롤링해오고, 관제 요원(Dispatcher)이 대시보드 지도에서 해당 마커를 클릭해 정보를 보는 순간 백그라운드로 관제 요원의 세션으로 강제 권한 상승 API가 호출됩니다.
*   **영향을 받을 수 있는 데이터 또는 기능:** 관리자 세션 하이재킹, 권한 탈취 및 CSRF 유도
*   **위험도:** 높음
*   **발생 가능성:** 중간
*   **확인해야 할 추가 코드:** 프론트엔드 지도 마커 팝업 생성 로직(`src/components/map-shell.tsx` 등)에서 데이터가 DOM에 어떻게 주입되는지 철저히 확인.
*   **수정 방향:** 백엔드에서 DB에 저장하기 전이나 프론트엔드에서 응답을 렌더링하기 전에 반드시 `DOMPurify` 등 검증된 Sanitization 라이브러리를 사용하여 악성 HTML 구문을 원천 제거해야 합니다.
*   **수정 시 주의할 점:** XSS 필터 구현 시 정상적인 정보가 과도하게 깨지지 않도록 해야 합니다.
*   **수정 후 테스트해야 할 항목:** `<script>alert(document.cookie)</script>` 가 포함된 모의 데이터를 DB에 직접 넣고 대시보드를 띄웠을 때 브라우저에서 스크립트가 실행되지 않고 문자열 그대로 노출되는지 확인.
*   **근거 코드 요약:** 추가 확인 필요 (Sanitizer 미비 확인)

---

## 다섯 번째 섹션: 성능 병목 가능성 분석

#### SQLite 단일 인메모리 큐를 통한 트랜잭션 병목 (Queueing Delay)
*   **위치:** `src/lib/points-db-modules/connection.ts` (`withDatabaseWriteTransaction` 함수)
*   **관련 코드 흐름 요약:** SQLite 사용 시 데이터 무결성을 위해 `writeTransactionQueue`라는 전역 Promise를 두어 모든 쓰기(Write) 트랜잭션을 일렬로 대기시킵니다.
*   **병목이 될 수 있는 이유:** 쓰기 요청이 발생할 때마다 앞선 트랜잭션이 끝날 때까지 큐에서 대기해야 합니다. 한 트랜잭션 안에서 무거운 로직(예: 수백 건의 마커 삽입 등)이 돌면 그 뒤의 모든 쓰기 요청(예: 긴급 사고 접수)이 블로킹됩니다.
*   **어떤 상황에서 부하가 커지는지:** 백그라운드 스케줄러가 공공데이터포털에서 수만 건의 소방 대상물 데이터를 가져와 DB에 벌크 인서트(Bulk Insert)하는 순간, 현장에서 사고를 접수(`POST /api/disaster/incidents`)하려는 요청이 해당 벌크 인서트가 끝날 때까지 타임아웃 되거나 무한 대기할 수 있습니다.
*   **데이터 수가 증가했을 때의 위험:** 데이터 삽입/수정 시간이 길어짐에 따라 큐 대기열이 기하급수적으로 늘어납니다.
*   **트래픽이 증가했을 때의 위험:** 다수의 현장 요원이 동시에 사고를 신고하거나 상태를 업데이트할 경우, 이벤트 누락 및 504 Gateway Timeout 발생 가능성이 급증합니다.
*   **시간 복잡도 관점의 설명:** 큐 대기 시간은 $O(N \times \text{Avg Transaction Time})$이 되어 대기 요청 수에 선형 비례합니다.
*   **데이터베이스 쿼리 비용 관점의 설명:** SQLite의 `BEGIN IMMEDIATE` 락 메커니즘을 전역 인메모리 큐로 감싸면서, WAL 저널 모드임에도 쓰기 병렬 처리가 불가능해집니다.
*   **메모리 사용량 관점의 설명:** 대기 중인 Promise 큐가 쌓이면 V8 메모리 누수로 이어질 가능성이 있습니다.
*   **외부 API 지연 가능성:** 트랜잭션 블록 안에서 외부 API 호출을 동기적으로 수행할 경우(현재 아키텍처상 외부 지오코딩이 혼재될 여지 있음) 치명적인 데드락 유발 가능성.
*   **성능 위험도:** 높음
*   **발생 가능성:** 높음
*   **개선 방향:** 본격 운영 환경에서는 반드시 PostgreSQL 또는 MySQL로 전환하여 row-level lock과 트랜잭션 동시성을 활용해야 합니다. 불가피하게 SQLite를 써야 한다면 쓰기 트랜잭션 내부에서 애플리케이션 로직 시간을 최소화(비동기 I/O 분리)하도록 리팩토링해야 합니다.
*   **개선 전 측정해야 할 지표:** 초당 동시 쓰기 처리량(TPS), 쓰기 트랜잭션 평균 대기 시간(Latency).
*   **개선 후 측정해야 할 지표:** TPS 향상 폭, 대기열 길이.
*   **수정 후 테스트해야 할 항목:** 1,000건의 Bulk Insert 실행 도중 다른 터미널에서 사고 생성 API를 지속 호출했을 때 응답 지연이 없는지 확인.
*   **근거 코드 요약:**
    ```typescript
    writeTransactionQueue = new Promise<void>((resolve) => { releaseTransaction = resolve; });
    await previousTransaction; // 선행 트랜잭션이 끝날 때까지 대기
    ```

#### 페이지네이션 및 제한 없는 대량 쿼리 반환 가능성
*   **위치:** `src/app/api/logs/route.ts` 및 `src/lib/points-db.ts` (`listApiLogs` 함수)
*   **관련 코드 흐름 요약:** 시스템 로그(`api_logs`)를 조회하는 엔드포인트에서 클라이언트가 전달한 `limit` 파라미터가 없으면 200건을 가져오나, 만약 파라미터 제어나 기본 페이징 설계가 빈약할 경우 한 번에 수만 건을 메모리에 올려 반환할 수 있습니다.
*   **병목이 될 수 있는 이유:** DB에서 수집된 데이터를 Node.js의 V8 엔진 힙 메모리에 한꺼번에 맵핑(`rows.map`)하고 JSON으로 직렬화하므로, CPU 스파이크 및 메모리 부족(OOM) 현상이 발생합니다.
*   **어떤 상황에서 부하가 커지는지:** 관리자가 에러 원인을 찾기 위해 로그를 날짜 범위 없이 전체 로드하거나, API 모니터링 툴이 반복적으로 로그를 긁어갈 때.
*   **데이터베이스 쿼리 비용 관점의 설명:** 데이터가 많을수록 `ORDER BY event_at DESC` 정렬을 위해 DB 엔진이 전체 데이터를 스캔(Full Scan)해야 하며 인덱스를 타지 못할 위험이 큽니다.
*   **성능 위험도:** 중간
*   **발생 가능성:** 중간
*   **개선 방향:** 엄격한 커서 기반(Cursor-based) 또는 오프셋(Offset) 페이지네이션을 강제하고, 조회 최대 건수(Max Limit)를 하드 코딩하여 그 이상은 거절하도록 설정합니다.
*   **개선 전 측정해야 할 지표:** 대용량 로그 호출 시 힙 메모리 사용량
*   **개선 후 측정해야 할 지표:** V8 힙 메모리 사용량의 안정성.
*   **수정 후 테스트해야 할 항목:** 대용량 데이터 로드 API 호출 시 에러가 발생하는지 확인.
*   **근거 코드 요약:**
    ```typescript
    const limit = Math.min(Math.max(options.limit ?? 200, 1), 500);
    ```

#### 배열과 객체의 과도한 재생성 및 불필요한 직렬화/역직렬화
*   **위치:** `src/lib/database/values.ts` (`normalizeDatabaseRow` 함수)
*   **관련 코드 흐름 요약:** DB에서 꺼낸 모든 행(Row)에 대해 `Object.entries(row).map(...)`를 수행한 후 다시 `Object.fromEntries()`로 객체를 재생성하며 Date 타입 문자열을 치환하고 있습니다.
*   **병목이 될 수 있는 이유:** 수만 건의 마커 데이터(Points)를 조회할 경우, DB 어댑터 계층에서 건건이 배열을 객체로 부수고 다시 조립하는 비용이 어마어마하게 발생하여 Node.js의 싱글 스레드 Event Loop가 심각하게 블로킹됩니다.
*   **메모리 사용량 관점의 설명:** 기존 객체 외에 임시 변환 배열(`entries`), 매핑된 배열, 그리고 새 객체까지 단기 생명주기 객체(Short-lived objects)가 폭발적으로 생성되어 가비지 컬렉터(GC) 부하를 가중시킵니다.
*   **성능 위험도:** 중간
*   **발생 가능성:** 높음
*   **개선 방향:** 객체를 분해하여 재생성하는 방식 대신, 필요한 컬럼만 제너릭을 통해 타입 단언(Type Assertion)하거나, DB 쿼리 자체에서 `ISO_STRING` 포맷팅을 처리해오도록 변경해야 합니다.
*   **개선 전 측정해야 할 지표:** 대용량 데이터 조회 속도
*   **개선 후 측정해야 할 지표:** 대용량 데이터 조회 시 CPU 사용량 감소
*   **수정 후 테스트해야 할 항목:** 전국 단위 소방수/대상물 마커 10만 건 로드 시 API 지연 속도 측정.
*   **근거 코드 요약:**
    ```typescript
    return Object.fromEntries(
      Object.entries(row).map(([key, value]) => [ key, value instanceof Date ? value.toISOString() : value ]),
    ) as T;
    ```

---

## 여섯 번째 섹션: 유지보수성과 확장성 문제 분석

#### 과도하게 혼재된 `points-db.ts` 클래스의 강결합 (God Class/God File)
*   **위치:** `src/lib/points-db.ts` 파일 전체
*   **현재 구조 요약:** 애플리케이션 설정, 외부 API 사용량 로그(`ApiLog`), 집회 시위(`AssemblyProtest`), 재난 마커(`Points`), 어드민 업데이트 쿨다운 통제 등 도메인 경계가 완전히 다른 DB 접근 로직이 1,500줄이 넘는 하나의 파일(`points-db.ts`)에 응집되어 있습니다.
*   **왜 유지보수에 불리한지:** 새로운 테이블이나 도메인을 추가할 때마다 이 거대한 파일을 수정해야 하며, Import 충돌이나 Git Merge Conflict 빈도가 기하급수적으로 늘어납니다. 무엇보다 모듈의 책임 원칙(Single Responsibility Principle)을 위배합니다.
*   **기능 추가 또는 변경 시 어떤 문제가 생길 수 있는지:** `AssemblyProtest` 로직을 고치다 실수로 `ApiUsage` 저장 로직을 건드리거나 타임아웃 설정에 영향을 줘서 장애의 원인 분석(Debugging)을 극도로 어렵게 만듭니다.
*   **리팩터링 방향:** 이미 도메인별 디렉터리가 잘 나뉘어 있으므로, `points-db.ts` 내부의 함수들을 `src/lib/repositories/` 하위의 `app-setting-repository.ts`, `api-log-repository.ts`, `assembly-protest-repository.ts` 등으로 완전히 분리해야 합니다.
*   **리팩터링 시 주의할 점:** `withDatabaseWriteTransaction` 과 같은 공통 트랜잭션 컨텍스트를 잘 넘겨받을 수 있도록 의존성 주입(DI) 형태나 공유 객체를 고안해야 합니다.
*   **우선순위:** 높음
*   **수정 난이도:** 중간
*   **테스트 필요 항목:** 파일 단위 분리 후 기존 엔드포인트(`api/logs`, `api/assembly-protests`)들이 동일한 응답을 주는지 회귀 테스트(Regression Test) 수행.
*   **근거 코드 요약:** `points-db.ts` 내에 서로 관계없는 `listApiLogs`, `upsertHazardEvents`, `consumeKakaoLocalQuota` 함수들이 동거함.

#### 일관성 없는 에러 핸들링 및 Magic String의 하드코딩
*   **위치:** API 라우터 (예: `src/app/api/admin/users/route.ts`, `src/features/users/user-account-service.ts`)
*   **현재 구조 요약:** 에러 코드가 `"sudo_required"`, `"not_found"`, `"invalid_input"` 등 하드코딩된 문자열(Magic String)로 정의되어 있고, 컨트롤러(Route) 계층에서 이를 받아 `if (code === "sudo_required") return 403;` 와 같이 매뉴얼하게 HTTP 상태 코드로 매핑합니다.
*   **왜 유지보수에 불리한지:** 비즈니스 레이어(`service`)와 프레젠테이션 레이어(`route`) 간의 계약이 느슨한 문자열에 의존하므로, 오타 하나로 전혀 다른 HTTP 응답이 나갈 수 있습니다. 새로운 에러 타입 추가 시 모든 컨트롤러 파일을 찾아다니며 분기문을 갱신해야 합니다.
*   **기능 추가 또는 변경 시 어떤 문제가 생길 수 있는지:** 개발자가 새로운 에러 코드를 추가하고 라우터에서 핸들링하는 것을 잊으면, 클라이언트에는 기본값 400 Bad Request와 모호한 에러가 리턴되어 장애 추적을 헤매게 만듭니다.
*   **리팩터링 방향:** `src/shared/error.ts` 와 같은 공용 에러 클래스를 도입하여 `throw new AppError("sudo_required", 403, "관리자 권한 필요")` 형태로 묶고, 라우터 최상단에서 이를 Catch해 일관된 표준 JSON 포맷 `{ code, message }` 으로 직렬화하는 글로벌 에러 핸들러 미들웨어로 개편합니다.
*   **리팩터링 시 주의할 점:** 에러 메시지에 시스템 내부 정보(DB Stack Trace 등)가 담기지 않도록 `AppError`의 `isPublic` 같은 플래그로 보호해야 합니다.
*   **우선순위:** 중간
*   **수정 난이도:** 낮음
*   **테스트 필요 항목:** 에러 시나리오 통합 테스트.
*   **근거 코드 요약:**
    ```typescript
    function userErrorStatus(code: string) {
      return code === "sudo_required" ? 403 : 400; // 하드코딩
    }
    ```

---

## 일곱 번째 섹션: 데이터 흐름과 요청 흐름 분석

#### 기능 이름: 재난 사고 신고 접수 (Create Incident)
*   **진입점:** `POST /api/disaster/incidents`
*   **호출되는 주요 함수:**
    1. `requireAccessSession(request, "field_worker")`
    2. `enforceRateLimit()`
    3. `incidentService.createIncident()`
    4. `publishIncidentChange()`
    5. `after(() => dispatchIncidentAlerts(incident))` (Next.js 백그라운드 워커)
*   **접근하는 데이터베이스 테이블 또는 모델:**
    *   쓰기: `disaster_incidents`, `disaster_incident_events` (트랜잭션 기반 삽입)
*   **호출하는 외부 API:** 사고 접수 시점에는 외부 API 호출 없음.
*   **인증 필요 여부:** 예 (세션 토큰 검증).
*   **인가 필요 여부:** 예 (최소 `field_worker` 권한).
*   **사용자 입력값:** `latitude`, `longitude`, `type`, `title`, `description`, `address`, `occurredAt`, `riskLevel`
*   **검증 로직:**
    *   `incidentType`, `riskLevel` 문자열 enum 검증.
    *   `assertKoreaCoordinate` 좌표 체계 바운더리(한국) 내 확인.
    *   `boundedText` 함수를 통한 최대 문자열 길이 컷오프(Truncate) 처리.
*   **에러 처리 방식:** `try-catch` 블록으로 포착하여 `noStoreJson({ error: message }, { status: 400 })` 반환.
*   **보안상 주의할 점:** `boundedText`가 길이는 자르지만 특수문자(XSS 페이로드)를 필터링하지 않으므로, 이 데이터가 관리자 대시보드에 렌더링될 때 악용될 가능성이 큽니다. (Stored XSS 주의)
*   **성능상 주의할 점:** `dispatchIncidentAlerts`가 Web Push를 발송하므로 동기적 호출을 분리한 것은 좋으나, 인메모리 이벤트 퍼블리셔(`publishIncidentChange`)가 다중 인스턴스에서는 타 노드에 이벤트를 전달하지 못합니다. (Redis Pub/Sub 등 브로커 도입 필수)

#### 기능 이름: 경찰청 집회/시위 게시판 크롤링
*   **진입점:** `POST /api/assembly-protests/crawl` (Sudo 전용)
*   **호출되는 주요 함수:**
    1. `requireAccessRole(request, "sudo")`
    2. `crawlDailyAssemblyBoards(date)`
    3. `geocodeAssemblyRecord(record)` (LLM / 카카오 API)
    4. `replaceAssemblyProtestsForDate()` (DB 갱신)
*   **접근하는 데이터베이스 테이블 또는 모델:** `assembly_protests`, `assembly_geocode_cache`
*   **호출하는 외부 API:**
    *   각 지방 경찰청 홈페이지 HTML 게시판.
    *   주소 정제 및 지오코딩을 위한 카카오 로컬 API 혹은 LLM(OpenAI) `geocode_place` Tool Call.
*   **인증 필요 여부:** 예.
*   **인가 필요 여부:** 예 (최고 권한인 `sudo` 세션 필요).
*   **사용자 입력값:** 검색할 기준 날짜 (`date`)
*   **검증 로직:** 크롤링된 데이터 파싱 규칙 적용.
*   **에러 처리 방식:** 에러 발생 시 카운트 증가 및 스킵.
*   **응답 형식:** 크롤링 통계 결과 반환.
*   **보안상 주의할 점:** 게시판 원문이 시스템 스레드에서 직접 처리되므로 서버 리소스 고갈(ReDoS 등)과 HTML 파싱 시 취약점이 있을 수 있습니다.
*   **성능상 주의할 점:** 수십 개의 경찰청 데이터를 동시에 긁어올 경우 메모리 오버헤드와 외부 타임아웃, DB 락 대기가 심각해질 수 있습니다. 스케줄러를 통한 백그라운드 비동기 분산 처리가 필요합니다.

---

## 여덟 번째 섹션: 데이터베이스 사용 방식 분석

#### 이슈 제목: 외래 키(Foreign Key) 제약 조건 누락에 따른 정합성 붕괴 위험
*   **관련 모델 또는 테이블:** `disaster_incidents` (사고)와 `disaster_incident_events` (사고 로그)
*   **관련 파일과 함수:** `src/lib/database/schema.ts` (`CREATE TABLE` DDL 구문)
*   **문제가 될 수 있는 이유:** `disaster_incident_events` 테이블의 `incident_id` 컬럼에 `FOREIGN KEY` 선언이 없습니다. 애플리케이션 레벨 트랜잭션에서 무결성을 챙긴다고 하지만, 하위 시스템 버그나 마이그레이션 도중 부모 데이터(Incident)만 지워지고 자식 데이터(Event)는 고아(Orphan) 상태로 남을 수 있습니다.
*   **데이터가 증가했을 때의 위험:** 고아 레코드가 쌓여 스토리지 공간을 무의미하게 점유하고, 백업 크기만 키우게 됩니다.
*   **동시 요청이 증가했을 때의 위험:** 두 트랜잭션이 충돌하여 롤백이 실패하거나 DB 직접 제어가 일어날 경우 무결성이 깨집니다.
*   **정합성 문제 가능성:** 매우 높음
*   **인덱스 또는 제약 조건 필요 여부:** 예
*   **개선 방향:** 스키마 DDL 구문에 `FOREIGN KEY (incident_id) REFERENCES disaster_incidents(id) ON DELETE CASCADE` (혹은 비즈니스 로직에 맞춰 RESTRICT)를 추가해야 합니다.
*   **테스트해야 할 항목:** `disaster_incidents` 행을 임의 삭제 시 연관된 이벤트 행들이 정상적으로 `CASCADE` 삭제되거나 방어되는지 DB 단위 무결성 테스트.

#### 이슈 제목: 페이지네이션 쿼리 오프셋(Offset) 방식의 성능 저하 (Limit/Offset)
*   **관련 모델 또는 테이블:** `points`, `api_logs` 등 조회 테이블 전반
*   **관련 파일과 함수:** `src/lib/points-db.ts` (`SELECT * FROM ... LIMIT ?`)
*   **문제가 될 수 있는 이유:** 목록을 불러올 때 `LIMIT` 만 있고 명시적인 커서가 없습니다. 데이터가 수백만 건일 때 `OFFSET 500000 LIMIT 100` 형태의 조회가 발생한다면, DB는 50만 100건을 다 읽은 후 앞의 50만 건을 버리는 식(비효율적 I/O)으로 동작합니다.
*   **데이터가 증가했을 때의 위험:** 테이블 데이터가 많아질수록 쿼리 시간이 기하급수적으로 느려지며, DB CPU 스파이크가 발생합니다.
*   **동시 요청이 증가했을 때의 위험:** 쿼리 시간이 길어져 DB Connection Pool 고갈 및 성능 저하.
*   **정합성 문제 가능성:** 낮음
*   **인덱스 또는 제약 조건 필요 여부:** 예 (인덱스)
*   **개선 방향:** `OFFSET`을 제거하고 고유 인덱스 컬럼(`id`나 `created_at`)을 기준으로 다음 페이지를 찾는 커서 기반 로직으로 아키텍처를 변경해야 합니다.
*   **테스트해야 할 항목:** 대용량 데이터가 있을 때 페이징 시 쿼리 성능이 유지되는지 테스트.

---

## 아홉 번째 섹션: 테스트 상태 분석

*   **테스트가 잘 되어 있는 부분:** E2E 테스트(Playwright)가 CI/CD 체인에 편입되어 브라우저 호환성(Chromium, Firefox) 검증에 사용되고 있는 점. 단위 테스트가 기본적으로 설정되어 있음.
*   **테스트가 부족한 부분:** 보안에 극도로 민감한 정부망 시스템임에도, Race Condition이나 SQL Injection 방어(파라미터 조작), 인가 우회(IDOR) 등 보안 취약점 악용을 전제로 한 네거티브 테스트(Negative Test) 케이스가 부족합니다.
*   **반드시 추가해야 할 테스트:**
    *   **동시성(Race Condition) 부하 테스트:** 로그인, 세션 파기 API에 수백 개의 동시 요청을 쏘아 데이터 일관성이 지켜지는지 점검.
    *   **권한 우회(IDOR) 테스트:** `field_worker` 세션으로 `sudo` 전용 크롤링 엔드포인트나 계정 삭제 엔드포인트 호출 시 403 반환 확인.
    *   **XSS 페이로드 주입 테스트:** 게시물 제목이나 주소 필드에 악의적 스크립트를 삽입한 뒤, 대시보드 렌더링 시 스크립트가 실행되지 않는지 검증.
*   **보안 개선 전 필요한 테스트:** 인가 우회 테스트, SQL Injection 테스트
*   **성능 개선 전 필요한 테스트:** 인메모리 큐를 제거하기 전 DB 쓰기 동시성 테스트
*   **리팩터링 전 필요한 테스트:** 파일 분리 전 현재 API의 Request/Response 일치 여부를 위한 E2E 테스트.
*   **우선순위가 높은 테스트 목록:** 세션 로직 동시성 이슈, 쿼리 파라미터 변조(Boundary Value) 테스트, 외부 시스템(카카오, VWorld) 응답 지연/장애 시 폴백(Fallback) 처리 검증.

---

## 열 번째 섹션: 환경 설정과 배포 위험 분석

#### 이슈 제목: 암호화 시크릿과 데이터 볼륨의 운명공동체 분리 불가 (Backup Risk)
*   **관련 파일:** `src/lib/secret-box.ts` (`data/.platelets-secret-key`)
*   **현재 설정 요약:** 마스터 키 파일이 데이터베이스 파일(SQLite `points.sqlite`)과 같은 `data/` 디렉터리에 존재합니다.
*   **위험한 이유:** 인프라 해킹 시 서버의 디스크 볼륨이나 백업 서버가 통째로 털릴 경우, 암호화된 데이터와 마스터 키가 한 세트로 공격자에게 넘어갑니다.
*   **운영 환경에서 발생 가능한 문제:** 백업 아카이브(.zip, .tar.gz) 유출만으로도 공공데이터 및 외부 시스템 연동 토큰이 즉시 무방비로 노출됩니다.
*   **개선 방향:** 데이터베이스 백업 경로와 마스터 키 저장소는 물리적, 논리적으로 완벽히 격리되어야 합니다. 마스터 키는 AWS KMS, Vault 같은 키 관리 시스템(KMS)이나 환경 변수 기반으로 격리하고, 볼륨 덤프 시 키 파일이 섞이지 않도록 해야 합니다.
*   **확인해야 할 환경 변수:** 마스터 시크릿 키 주입을 위한 `PLATELETS_MASTER_KEY` 등의 환경 변수 신설 요구.
*   **테스트 또는 검증 방법:** 환경 변수만을 이용해서 정상 복호화가 이루어지는지 검증.

#### 이슈 제목: 이벤트 배포의 단일 프로세스 의존성 (SSE 확장 불가)
*   **관련 파일:** `docs/ARCHITECTURE.md` 및 `src/app/api/disaster/events/route.ts`
*   **현재 설정 요약:** 사건 변경 내역(Event)을 인메모리 Event Hub를 통해 Server-Sent Events(SSE)로 전송하고 있습니다.
*   **위험한 이유:** 정부망 트래픽 수용을 위해 다중 인스턴스(L4/L7 로드밸런싱) 배포를 진행할 경우, 서로 다른 인스턴스에 접속된 클라이언트끼리는 이벤트 전파가 이루어지지 않습니다.
*   **운영 환경에서 발생 가능한 문제:** 대규모 재난 시 현장 요원과 관제 센터 간 실시간 정보 동기화가 깨져, 대응 출동이 늦어지거나 리소스 낭비가 초래되는 치명적 운영 장애.
*   **개선 방향:** Redis Pub/Sub 또는 Message Queue(RabbitMQ 등) 메커니즘을 연동하여, 다중 인스턴스 환경에서도 이벤트를 전역으로 브로드캐스트할 수 있는 Event Broker 아키텍처를 시급히 구현해야 합니다.
*   **확인해야 할 환경 변수:** Redis Connection String (예: `REDIS_URL`)
*   **테스트 또는 검증 방법:** 두 개 이상의 서버 인스턴스 간 이벤트 실시간 브로드캐스팅 정상 동작 여부 확인.

---

## 열한 번째 섹션: 종합 위험 지도

*   **가장 위험한 앱 또는 모듈 1순위:** `Auth & Session / Secret Box 모듈`
*   **가장 위험한 앱 또는 모듈 2순위:** `Disaster Incidents 모듈`
*   **가장 위험한 앱 또는 모듈 3순위:** `Database Core 모듈`
*   **보안상 가장 먼저 봐야 할 파일:** `src/lib/secret-box.ts`, `src/lib/auth-sessions.ts`
*   **성능상 가장 먼저 봐야 할 파일:** `src/lib/points-db-modules/connection.ts`, `src/lib/rate-limit.ts`
*   **유지보수상 가장 먼저 봐야 할 파일:** `src/lib/points-db.ts`
*   **테스트가 가장 시급한 영역:** 인증/인가 우회 네거티브 테스트, 세션 동시 생성/파기 시뮬레이션(Race Condition 테스트), XSS 방어 테스트.
*   **운영 장애 가능성이 가장 높은 영역:** 재난 확산 시 119/112 다중 신고 폭주에 따른 SQLite 인메모리 락 병목 및 메모리 초과 (OOM).
*   **데이터 정합성 문제가 생길 가능성이 가장 높은 영역:** `disaster_incident_events` 로그 테이블 (FK 제약 조건 부재).
*   **권한 문제가 생길 가능성이 가장 높은 영역:** API의 입력값 조작을 통한 사용자 역할(`role`) 임의 상승 구간.
*   **외부 API 문제로 장애가 발생할 가능성이 가장 높은 영역:** 경찰청 크롤링 및 국립중앙의료원/공공데이터포털 연동 시 응답 포맷 변경에 의한 동기 렌더링 블로킹.

---

## 열두 번째 섹션: 다음 단계 제안

이번 단계에서는 코드를 전혀 수정하지 않았으므로, 다음 단계부터는 시스템의 근간(Root)부터 말단(Leaf) 순으로 안정성을 확보하며 순차 개선해야 합니다.

*   **1단계: 가장 먼저 상세 분석할 앱 또는 모듈:** Auth & Access Control 및 Secret Box 모듈
*   **선정 이유:** 모든 트래픽의 대문이자(인증), 모든 시스템 데이터의 열쇠(시크릿 마스터 키)입니다. 정부망 도입을 위한 보안 규격 통과의 가장 기본입니다.
*   **상세 분석에서 확인할 파일:**
    *   `src/lib/secret-box.ts`
    *   `src/lib/auth-sessions.ts`
    *   `src/app/api/auth/login/route.ts`
*   **상세 분석에서 확인할 함수:**
    *   `getSecretMaterial()`
    *   `readSessions()`, `writeSessions()`
*   **보안 관점에서 확인할 항목:** `Secure` 쿠키 플래그 강제 적용, JSON 배열 덮어쓰기 로직 제거를 통한 세션 Race Condition 해결.
*   **성능 관점에서 확인할 항목:** 세션 테이블 분리 시 `tokenHash` 기반 인덱스 추가 확인.
*   **유지보수 관점에서 확인할 항목:** 세션 만료 스케줄러를 DB 단으로 이관 여부 확인.
*   **수정 전에 반드시 작성하거나 확인해야 할 테스트:** 수십 개 동시 로그인/로그아웃 요청 시 기존 세션들이 유지되는지 E2E 테스트.
*   **아직 수정하면 안 되는 이유 또는 주의점:** 이 모듈을 건드리는 순간 현재 로그인된 모든 관리자/테스터의 세션이 파기되므로, 개발/스테이징 환경에서 무중단 패치 방안 마련 후 적용해야 함.

### 분석 요약 표

| 우선순위 | 앱 또는 모듈 | 주요 역할 | 보안 위험도 | 성능 위험도 | 유지보수 위험도 | 비즈니스 중요도 | 수정 난이도 | 먼저 봐야 할 파일 | 핵심 근거 | 추천 다음 작업 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | **Auth & Secret Box** | 인증, 세션, 암호화 키 관리 | **높음** | 중간 | 높음 | **높음** | 높음 | `src/lib/auth-sessions.ts`, `src/lib/secret-box.ts` | 마스터 키 파일 평문 저장, 세션 동시성(Race Condition) 파괴 현상 내포 | DB 테이블 분리로 세션 동시성 문제 해결 및 마스터 키 격리 |
| **2** | **Disaster Incidents** | 사고 접수, 관제, 알림 전파 | 중간 | **높음** | 중간 | **높음** | 중간 | `src/app/api/disaster/incidents/route.ts` | 인메모리 Rate Limit 및 SSE 배포의 다중 인스턴스 확장 불가 | Redis 도입 및 인스턴스 간 이벤트 Pub/Sub 브로커 구축 |
| **3** | **User Admin** | 관리자 권한 제어 및 생성 | **높음** | 낮음 | 중간 | **높음** | 중간 | `src/features/users/user-account-service.ts` | 입력값 조작 시 우회(IDOR) 위험 및 하드코딩 에러 매핑 | API Payload 검증(Zod) 추가 및 전역 에러 핸들러 도입 |
| **4** | **Database Core** | DB 쿼리 및 트랜잭션 관리 | 중간 | **높음** | **높음** | **높음** | 높음 | `src/lib/points-db-modules/connection.ts` | SQLite 글로벌 인메모리 큐 대기에 따른 대규모 트랜잭션 블로킹 | 프로덕션용 DB 전환 고려 및 외래키(FK) 무결성 제약 추가 |
| **5** | **Dataset Import** | 외부 API 및 크롤링 연동 | 중간 | 높음 | 중간 | 중간 | 중간 | `src/lib/dataset-import.ts` | 응답 파싱 시 악성 스크립트(XSS) 주입 노출 가능성 | 외부 HTML 렌더링 전 DOMPurify 적용 및 크롤링 분산 처리 |
| **6** | **points-db.ts** | 앱 내 설정 및 마커 관리 | 낮음 | 중간 | **높음** | 중간 | 중간 | `src/lib/points-db.ts` | 하나의 거대한 파일에 여러 도메인 코드가 강하게 응집 | 도메인별(Repository)로 기능들을 여러 파일로 강제 분리 |
