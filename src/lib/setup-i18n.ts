type SetupLocale = "ko" | "en";

const setupDictionary = {
  en: {
    "api.failed": "API key check failed.",
    "api.lead":
      "Save provider keys for maps, public data, geocoding, routing, Seoul city data, and AI.",
    "api.ready": "API key settings are ready to save.",
    "api.test": "Test API keys",
    "api.title": "API keys",
    "brand.name": "Platelets",
    "brand.subtitle": "Setup Assistant",
    "brand.wizardAria": "Platelets setup wizard",
    "controls.language": "Language",
    "controls.theme": "Theme",
    "database.alreadyInstalled": "Setup is already complete.",
    "database.connectionString": "Connection URL",
    "database.connectionStringHelp":
      "Use a service account URL. It is encrypted before being saved on this server.",
    "database.engine.mariadb": "MariaDB",
    "database.engine.mysql": "MySQL",
    "database.engine.postgresql": "PostgreSQL",
    "database.engine.sqlite": "SQLite",
    "database.failed": "Database connection check failed.",
    "database.field.engine": "Database engine",
    "database.ready": "Database connection is ready.",
    "database.test": "Test database",
    "database.testing": "Testing database",
    "database.title": "Database selection",
    "environment.checking.detail": "Reading runtime and filesystem status.",
    "environment.checking.title": "Checking server",
    "environment.clock.browserSkewed":
      "Did this browser arrive from the past or future? Its clock does not match the server. Turn on automatic time settings, then try again.",
    "environment.clock.ok": "Server and browser time are synchronized.",
    "environment.clock.pending": "Checking server and browser time.",
    "environment.clock.serverSkewed":
      "Did the server arrive from the past or future? Its clock is not synchronized. Check the server time settings, then try again.",
    "environment.clock.title": "Time synchronization",
    "environment.clock.unavailable":
      "The server could not verify time synchronization. Check network access and server time settings.",
    "environment.clientClock.ok":
      "Client-server offset is {offsetSeconds}s, within the {thresholdSeconds}s limit.",
    "environment.clientClock.pending":
      "Measuring client-server offset with this browser.",
    "environment.clientClock.skewed":
      "Client-server offset is {offsetSeconds}s, above the {thresholdSeconds}s limit.",
    "environment.clientClock.title": "Client-server clock",
    "environment.dataDirectory.notWritable":
      "Grant read and write permission to this folder: {path}.",
    "environment.dataDirectory.title": "Writable data folder",
    "environment.dataDirectory.writable":
      "The data folder can be read and written.",
    "environment.database.external":
      "The selected external database will be checked before installation.",
    "environment.database.title": "Selected database",
    "environment.lead":
      "Confirm this deployment can create and use the selected database.",
    "environment.node.detail": "Node {version}",
    "environment.node.title": "Node.js runtime",
    "environment.ntp.ok":
      "{host} reports the server clock is {offsetSeconds}s from NTP, within the {thresholdSeconds}s limit.",
    "environment.ntp.skewed":
      "{host} reports the server clock is {offsetSeconds}s from NTP, above the {thresholdSeconds}s limit. Check server NTP before operators rely on event times.",
    "environment.ntp.title": "NTP-server clock",
    "environment.ntp.unavailable":
      "No NTP server responded, so the {thresholdSeconds}s limit could not be verified.",
    "environment.sqlite.absent":
      "The SQLite database file can be created during installation.",
    "environment.sqlite.delete": "Delete database file",
    "environment.sqlite.deleteFailed": "Could not delete the database file.",
    "environment.sqlite.deleting": "Deleting database file",
    "environment.sqlite.exists":
      "A SQLite database file already exists: {path}",
    "environment.sqlite.title": "SQLite database file",
    "environment.title": "Server environment check",
    "field.confirmPassword": "Confirm password",
    "field.email": "Email address",
    "field.fullName": "Full name",
    "field.kakaoMobilityRestApiKey": "Kakao Mobility REST API key",
    "field.kakaoRestApiKey": "Kakao REST API key",
    "field.openaiApiKey": "OpenAI API key",
    "field.openaiBaseUrl": "OpenAI base URL",
    "field.password": "Password",
    "field.publicDataApiKey": "Public data API key",
    "field.seoulOpenApiKey": "Seoul Open API key",
    "field.vworldApiKey": "VWorld API key",
    "finish.info":
      "The installer stores password hashes, never plain passwords. External service connection values are encrypted in the application database.",
    "finish.lead":
      "Platelets will create the selected database schema, save setup settings, and open the safety map.",
    "finish.title": "Create database",
    "install.failed": "Installation failed.",
    "json.failed":
      "The setup API did not return JSON. Check the server console and try again.",
    "language.en": "EN",
    "language.ko": "KO",
    "license.accept": "I have read and accept the Platelets setup terms.",
    "license.lead": "Review and accept the terms before continuing.",
    "license.section1.body":
      "Platelets is intended for public-safety data operations run by your organization. Keep provider API terms, attribution, and local operating policies in force.",
    "license.section1.title": "1. Open source deployment",
    "license.section2.body":
      "Emergency, map, AI, and public data outputs are operational aids. They do not replace official dispatch, medical, or emergency decisions.",
    "license.section2.title": "2. Data and model caveats",
    "license.title": "License agreement",
    "nav.back": "Back",
    "nav.continue": "Continue",
    "nav.install": "Install",
    "password.requirement.length": "At least 12 characters",
    "password.requirement.lowercase": "Includes a lowercase letter",
    "password.requirement.met": "Met",
    "password.requirement.missing": "Not met",
    "password.requirement.number": "Includes a number",
    "password.requirement.symbol": "Includes a symbol",
    "password.requirement.title": "Password requirements",
    "password.requirement.uppercase": "Includes an uppercase letter",
    "setup.aria": "Platelets setup wizard",
    "start.info":
      "This assistant creates the selected database, saves operator accounts, and stores server-side API keys for this deployment.",
    "start.lead":
      "Set up this emergency response map before operators start using it.",
    "start.title": "Welcome to Platelets",
    "status.step": "Step {current} of {total}",
    "step.admin": "Operator account",
    "step.api": "API keys",
    "step.environment": "Server check",
    "step.finish": "Database",
    "step.license": "Terms",
    "step.start": "Start",
    "step.sudo": "Administrator account",
    "sudo.description":
      "This administrator account controls setup, datasets, logs, schedules, and AI configuration.",
    "sudo.title": "Create the administrator account",
    "admin.description":
      "This operator account can access protected response and AI workflows without administrator privileges.",
    "admin.title": "Create the operator account",
    "theme.dark": "Dark",
    "theme.light": "Light",
    "validation.account.email": "A valid email address is required.",
    "validation.account.fullName": "Full name is required.",
    "validation.account.password":
      "Password must be at least 12 characters and include lowercase, uppercase, number, and special characters.",
    "validation.account.passwordConfirm": "Passwords do not match.",
    "validation.api": "Test the API key settings before continuing.",
    "validation.api.openaiBaseUrl": "Enter a valid HTTPS URL.",
    "validation.api.openaiBaseUrlSecure":
      "Enter an HTTPS provider URL without a username or password.",
    "validation.database.connectionString":
      "Enter a valid connection URL for the selected database.",
    "validation.database.test":
      "Test the database connection before continuing.",
    "validation.environment":
      "Resolve the server environment checks before continuing.",
    "validation.license": "Accept the terms to continue.",
  },
  ko: {
    "api.failed": "API 키 확인에 실패했습니다.",
    "api.lead":
      "지도, 공공데이터, 지오코딩, 경로, 서울 도시데이터, AI에 사용할 제공자 키를 저장합니다.",
    "api.ready": "API 키 설정을 저장할 준비가 되었습니다.",
    "api.test": "API 키 테스트",
    "api.title": "API 키",
    "brand.name": "Platelets",
    "brand.subtitle": "설치 도우미",
    "brand.wizardAria": "Platelets 설치 마법사",
    "controls.language": "언어",
    "controls.theme": "테마",
    "database.alreadyInstalled": "이미 설치가 완료되었습니다.",
    "database.connectionString": "연결 주소",
    "database.connectionStringHelp":
      "서비스 계정 연결 주소를 입력하세요. 서버에 저장하기 전에 암호화됩니다.",
    "database.engine.mariadb": "MariaDB",
    "database.engine.mysql": "MySQL",
    "database.engine.postgresql": "PostgreSQL",
    "database.engine.sqlite": "SQLite",
    "database.failed": "데이터베이스 연결 확인에 실패했습니다.",
    "database.field.engine": "데이터베이스 종류",
    "database.ready": "데이터베이스 연결을 사용할 수 있습니다.",
    "database.test": "데이터베이스 확인",
    "database.testing": "데이터베이스 확인 중",
    "database.title": "데이터베이스 선택",
    "environment.checking.detail": "런타임과 파일 시스템 상태를 읽는 중입니다.",
    "environment.checking.title": "서버 확인 중",
    "environment.clock.browserSkewed":
      "이 브라우저가 과거나 미래에서 온 것 같습니다. 기기 시간을 자동 설정으로 맞춘 뒤 다시 시도하세요.",
    "environment.clock.ok": "서버와 브라우저 시간이 정상 범위입니다.",
    "environment.clock.pending": "서버와 브라우저 시간을 확인하고 있습니다.",
    "environment.clock.serverSkewed":
      "서버가 과거나 미래에서 온 것 같습니다. 서버의 시간 동기화 설정을 확인한 뒤 다시 시도하세요.",
    "environment.clock.title": "시간 동기화",
    "environment.clock.unavailable":
      "시간 동기화를 확인하지 못했습니다. 서버의 네트워크와 시간 설정을 확인하세요.",
    "environment.clientClock.ok":
      "클라이언트-서버 오차는 {offsetSeconds}초로 {thresholdSeconds}초 기준 이내입니다.",
    "environment.clientClock.pending":
      "이 브라우저와 서버 사이의 시간 오차를 측정하는 중입니다.",
    "environment.clientClock.skewed":
      "클라이언트-서버 오차는 {offsetSeconds}초로 {thresholdSeconds}초 기준을 넘었습니다.",
    "environment.clientClock.title": "클라이언트-서버 시계",
    "environment.dataDirectory.notWritable":
      "이 폴더에 읽기/쓰기 권한을 부여하세요: {path}",
    "environment.dataDirectory.title": "쓰기 가능한 데이터 폴더",
    "environment.dataDirectory.writable": "데이터 폴더를 읽고 쓸 수 있습니다.",
    "environment.database.external":
      "설치 전에 선택한 외부 데이터베이스 연결을 확인합니다.",
    "environment.database.title": "선택한 데이터베이스",
    "environment.lead":
      "배포 환경이 선택한 데이터베이스를 만들고 사용할 수 있는지 확인합니다.",
    "environment.node.detail": "Node {version}",
    "environment.node.title": "Node.js 런타임",
    "environment.ntp.ok":
      "{host} 기준 서버 시계의 NTP 오차는 {offsetSeconds}초로 {thresholdSeconds}초 이내입니다.",
    "environment.ntp.skewed":
      "{host} 기준 서버 시계의 NTP 오차는 {offsetSeconds}초로 {thresholdSeconds}초를 넘었습니다. 운영자가 사건 시각을 믿기 전에 서버 NTP를 확인하세요.",
    "environment.ntp.title": "NTP-서버 시계",
    "environment.ntp.unavailable":
      "응답한 NTP 서버가 없어 {thresholdSeconds}초 기준을 확인할 수 없습니다.",
    "environment.sqlite.absent": "설치 중 SQLite DB 파일을 생성할 수 있습니다.",
    "environment.sqlite.delete": "DB 파일 삭제",
    "environment.sqlite.deleteFailed": "DB 파일을 삭제하지 못했습니다.",
    "environment.sqlite.deleting": "DB 파일 삭제 중",
    "environment.sqlite.exists": "SQLite DB 파일이 이미 있습니다: {path}",
    "environment.sqlite.title": "SQLite 데이터베이스 파일",
    "environment.title": "서버 환경 확인",
    "field.confirmPassword": "비밀번호 확인",
    "field.email": "이메일 주소",
    "field.fullName": "이름",
    "field.kakaoMobilityRestApiKey": "Kakao Mobility REST API 키",
    "field.kakaoRestApiKey": "Kakao REST API 키",
    "field.openaiApiKey": "OpenAI API 키",
    "field.openaiBaseUrl": "OpenAI base URL",
    "field.password": "비밀번호",
    "field.publicDataApiKey": "공공데이터 API 키",
    "field.seoulOpenApiKey": "서울 열린데이터 API 키",
    "field.vworldApiKey": "VWorld API 키",
    "finish.info":
      "설치 도구는 비밀번호 원문을 저장하지 않고 해시만 저장합니다. 외부 서비스 연결값은 암호화된 애플리케이션 데이터베이스에 저장합니다.",
    "finish.lead":
      "Platelets가 선택한 데이터베이스 구조를 만들고, 설치 설정을 저장한 뒤 안전 지도를 엽니다.",
    "finish.title": "데이터베이스 생성",
    "install.failed": "설치에 실패했습니다.",
    "json.failed":
      "설치 API가 JSON을 반환하지 않았습니다. 서버 콘솔을 확인한 뒤 다시 시도해 주세요.",
    "language.en": "EN",
    "language.ko": "KO",
    "license.accept": "Platelets 설치 약관을 읽고 동의합니다.",
    "license.lead": "계속하기 전에 약관을 확인하고 동의해 주세요.",
    "license.section1.body":
      "Platelets는 기관이 직접 운영하는 공공안전 데이터 도구입니다. 제공자 API 약관, 저작권 표기, 로컬 운영 정책을 지켜야 합니다.",
    "license.section1.title": "1. 오픈소스 배포",
    "license.section2.body":
      "응급, 지도, AI, 공공데이터 결과는 운영 보조 정보입니다. 공식 출동, 의료, 재난 의사결정을 대체하지 않습니다.",
    "license.section2.title": "2. 데이터와 모델의 한계",
    "license.title": "라이선스 동의",
    "nav.back": "이전",
    "nav.continue": "계속",
    "nav.install": "설치",
    "password.requirement.length": "12자 이상",
    "password.requirement.lowercase": "소문자 포함",
    "password.requirement.met": "충족",
    "password.requirement.missing": "미충족",
    "password.requirement.number": "숫자 포함",
    "password.requirement.symbol": "특수문자 포함",
    "password.requirement.title": "비밀번호 요구 조건",
    "password.requirement.uppercase": "대문자 포함",
    "setup.aria": "Platelets 설치 마법사",
    "start.info":
      "이 도우미는 선택한 데이터베이스를 만들고, 담당자 계정과 서버 API 키를 저장합니다.",
    "start.lead": "지도를 사용하기 전에 응급 대응 지도 운영 환경을 설정합니다.",
    "start.title": "Platelets에 오신 것을 환영합니다",
    "status.step": "{total}단계 중 {current}단계",
    "step.admin": "담당자 계정",
    "step.api": "API 키",
    "step.environment": "서버 확인",
    "step.finish": "데이터베이스",
    "step.license": "약관",
    "step.start": "시작",
    "step.sudo": "관리자 계정",
    "sudo.description":
      "이 관리자 계정은 설치, 데이터셋, 로그, 스케줄, AI 설정을 제어합니다.",
    "sudo.title": "관리자 계정 생성",
    "admin.description":
      "담당자 계정은 관리자 권한 없이 보호된 운영 및 AI 흐름에 접근할 수 있습니다.",
    "admin.title": "담당자 계정 생성",
    "theme.dark": "다크",
    "theme.light": "라이트",
    "validation.account.email": "올바른 이메일 주소가 필요합니다.",
    "validation.account.fullName": "이름을 입력해야 합니다.",
    "validation.account.password":
      "비밀번호는 12자 이상이며 소문자, 대문자, 숫자, 특수문자를 포함해야 합니다.",
    "validation.account.passwordConfirm": "비밀번호가 일치하지 않습니다.",
    "validation.api": "계속하기 전에 API 키 설정을 테스트해 주세요.",
    "validation.api.openaiBaseUrl": "올바른 HTTPS URL을 입력해 주세요.",
    "validation.api.openaiBaseUrlSecure":
      "사용자 이름이나 비밀번호가 없는 HTTPS 제공자 URL을 입력해 주세요.",
    "validation.database.connectionString":
      "선택한 데이터베이스에 맞는 연결 주소를 입력하세요.",
    "validation.database.test": "계속하기 전에 데이터베이스 연결을 확인하세요.",
    "validation.environment": "계속하려면 서버 환경 확인 문제를 해결해 주세요.",
    "validation.license": "계속하려면 약관에 동의해야 합니다.",
  },
} satisfies Record<SetupLocale, Record<string, string>>;

export type SetupDictionary = (typeof setupDictionary)["en"];
export type SetupDictionaryKey = keyof SetupDictionary;
export type SetupDictionaries = Record<SetupLocale, SetupDictionary>;

export const setupDictionaries: SetupDictionaries = setupDictionary;

export function formatSetupText(
  copy: SetupDictionary,
  key: SetupDictionaryKey,
  values: Record<string, string | number> = {},
) {
  return copy[key].replace(/\{(\w+)\}/g, (match, name) =>
    Object.hasOwn(values, name) ? String(values[name]) : match,
  );
}
