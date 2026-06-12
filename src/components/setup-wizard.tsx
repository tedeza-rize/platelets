"use client";

import {
  ArrowLeft,
  ArrowRight,
  Check,
  Database,
  FileCheck2,
  KeyRound,
  Languages,
  LoaderCircle,
  Moon,
  ServerCog,
  ShieldAlert,
  ShieldCheck,
  Sun,
  UserCog,
  Users,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useMemo,
  useState,
} from "react";
import type { Locale } from "@/lib/i18n";
import {
  getPasswordRequirementResults,
  isPasswordValid,
  type PasswordRequirementId,
} from "@/lib/password-policy";
import styles from "./setup-wizard.module.css";

type AccountForm = {
  confirmPassword: string;
  email: string;
  fullName: string;
  password: string;
};

type ApiKeysForm = {
  kakaoMobilityRestApiKey: string;
  kakaoRestApiKey: string;
  openaiApiKey: string;
  openaiBaseUrl: string;
  publicDataApiKey: string;
  seoulOpenApiKey: string;
  vworldApiKey: string;
};

type EnvironmentCheck = {
  detail: string;
  id: string;
  ok: boolean;
  title: string;
};

type StatusPayload = {
  environment: {
    checks: EnvironmentCheck[];
    databaseExists: boolean;
  };
  installed: boolean;
};

const steps = [
  { icon: ShieldAlert, id: "start", labelKey: "step.start" },
  { icon: FileCheck2, id: "license", labelKey: "step.license" },
  { icon: ServerCog, id: "environment", labelKey: "step.environment" },
  { icon: UserCog, id: "sudo", labelKey: "step.sudo" },
  { icon: Users, id: "admin", labelKey: "step.admin" },
  { icon: KeyRound, id: "api", labelKey: "step.api" },
  { icon: Database, id: "finish", labelKey: "step.finish" },
] as const;

const initialAccount: AccountForm = {
  confirmPassword: "",
  email: "",
  fullName: "",
  password: "",
};

const initialApiKeys: ApiKeysForm = {
  kakaoMobilityRestApiKey: "",
  kakaoRestApiKey: "",
  openaiApiKey: "",
  openaiBaseUrl: "https://api.openai.com/v1",
  publicDataApiKey: "",
  seoulOpenApiKey: "",
  vworldApiKey: "",
};

const setupCopy = {
  en: {
    "api.failed": "API key check failed.",
    "api.ready": "API key configuration is ready to save.",
    "api.test": "Test API keys",
    "api.lead":
      "Save provider keys for maps, public data, geocoding, routing, Seoul citydata, and AI.",
    "api.title": "API keys",
    "brand.subtitle": "Setup Assistant",
    "controls.language": "Language",
    "controls.theme": "Theme",
    "environment.checking.detail": "Reading runtime and filesystem status.",
    "environment.checking.title": "Checking server",
    "environment.lead":
      "Confirm the deployment can create and use the local database.",
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
      "The installer stores credential hashes, never plain passwords. Existing environment variables remain valid as deployment fallbacks.",
    "finish.lead":
      "Platelets will create the SQLite database, store the setup configuration, and open the home map.",
    "finish.title": "Create database",
    "install.failed": "Installation failed.",
    "json.failed":
      "The setup API did not return JSON. Check the server console and try again.",
    "language.en": "EN",
    "language.ko": "KO",
    "license.accept": "I have read and accept the Platelets setup terms.",
    "license.lead": "Review and accept the terms before continuing.",
    "license.section1.body":
      "Platelets is intended for self-hosted public-safety data operations. Keep provider API terms, attribution, and local operating policies in force.",
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
      "This assistant creates the local SQLite database, stores operator credentials, and saves server-side API keys for this deployment.",
    "start.lead":
      "Set up this self-hosted emergency response CMS before the map becomes available.",
    "start.title": "Welcome to Platelets",
    "status.step": "Step {current} of {total}",
    "step.admin": "Admin account",
    "step.api": "API keys",
    "step.environment": "Server check",
    "step.finish": "Database",
    "step.license": "Terms",
    "step.start": "Start",
    "step.sudo": "Sudo account",
    "sudo.description":
      "This developer/operator account controls setup, datasets, logs, schedules, and AI configuration.",
    "sudo.title": "Create the sudo account",
    "admin.description":
      "This user-facing administrator can access protected operational and AI workflows without sudo privileges.",
    "admin.title": "Create the admin account",
    "theme.dark": "Dark",
    "theme.light": "Light",
    "validation.account.email": "A valid email address is required.",
    "validation.account.fullName": "Full name is required.",
    "validation.account.password":
      "Password must be at least 12 characters and include lowercase, uppercase, number, and special characters.",
    "validation.account.passwordConfirm": "Passwords do not match.",
    "validation.api": "Test the API key configuration before continuing.",
    "validation.license": "Accept the terms to continue.",
  },
  ko: {
    "api.failed": "API 키 확인에 실패했습니다.",
    "api.ready": "API 키 설정을 저장할 준비가 되었습니다.",
    "api.test": "API 키 테스트",
    "api.lead":
      "지도, 공공데이터, 지오코딩, 경로, 서울 도시데이터, AI에 사용할 제공자 키를 저장합니다.",
    "api.title": "API 키",
    "brand.subtitle": "설치 도우미",
    "controls.language": "언어",
    "controls.theme": "테마",
    "environment.checking.detail": "런타임과 파일 시스템 상태를 읽는 중입니다.",
    "environment.checking.title": "서버 확인 중",
    "environment.lead":
      "배포 환경이 로컬 데이터베이스를 만들고 사용할 수 있는지 확인합니다.",
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
      "설치 도구는 비밀번호 원문을 저장하지 않고 해시만 저장합니다. 기존 환경 변수는 배포용 fallback으로 계속 사용할 수 있습니다.",
    "finish.lead":
      "Platelets가 SQLite 데이터베이스를 만들고 설치 설정을 저장한 뒤 홈 지도를 엽니다.",
    "finish.title": "데이터베이스 생성",
    "install.failed": "설치에 실패했습니다.",
    "json.failed":
      "설치 API가 JSON을 반환하지 않았습니다. 서버 콘솔을 확인한 뒤 다시 시도해 주세요.",
    "language.en": "EN",
    "language.ko": "KO",
    "license.accept": "Platelets 설치 약관을 읽고 동의합니다.",
    "license.lead": "계속하기 전에 약관을 확인하고 동의해 주세요.",
    "license.section1.body":
      "Platelets는 자체 호스팅 공공안전 데이터 운영을 위한 도구입니다. 제공자 API 약관, 저작권 표기, 로컬 운영 정책을 지켜야 합니다.",
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
      "이 도우미는 로컬 SQLite 데이터베이스를 만들고 운영자 계정과 서버 측 API 키를 이 배포 환경에 저장합니다.",
    "start.lead":
      "지도를 사용하기 전에 자체 호스팅 응급 대응 CMS를 설정합니다.",
    "start.title": "Platelets에 오신 것을 환영합니다",
    "status.step": "{total}단계 중 {current}단계",
    "step.admin": "관리자 계정",
    "step.api": "API 키",
    "step.environment": "서버 확인",
    "step.finish": "데이터베이스",
    "step.license": "약관",
    "step.start": "시작",
    "step.sudo": "sudo 계정",
    "sudo.description":
      "이 개발자/운영자 계정은 설치, 데이터셋, 로그, 스케줄, AI 설정을 제어합니다.",
    "sudo.title": "sudo 계정 생성",
    "admin.description":
      "이 사용자용 관리자는 sudo 권한 없이 보호된 운영 및 AI 흐름에 접근할 수 있습니다.",
    "admin.title": "관리자 계정 생성",
    "theme.dark": "다크",
    "theme.light": "라이트",
    "validation.account.email": "올바른 이메일 주소가 필요합니다.",
    "validation.account.fullName": "이름을 입력해야 합니다.",
    "validation.account.password":
      "비밀번호는 12자 이상이며 소문자, 대문자, 숫자, 특수문자를 포함해야 합니다.",
    "validation.account.passwordConfirm": "비밀번호가 일치하지 않습니다.",
    "validation.api": "계속하기 전에 API 키 설정을 테스트해 주세요.",
    "validation.license": "계속하려면 약관에 동의해야 합니다.",
  },
} satisfies Record<Locale, Record<string, string>>;

type SetupCopy = (typeof setupCopy)["en"];
type SetupCopyKey = keyof SetupCopy;
type ThemeMode = "dark" | "light";

const passwordRequirementLabelKeys: Record<
  PasswordRequirementId,
  SetupCopyKey
> = {
  length: "password.requirement.length",
  lowercase: "password.requirement.lowercase",
  number: "password.requirement.number",
  symbol: "password.requirement.symbol",
  uppercase: "password.requirement.uppercase",
};

function formatCopy(
  copy: SetupCopy,
  key: SetupCopyKey,
  values: Record<string, string | number> = {},
) {
  return copy[key].replace(/\{(\w+)\}/g, (match, name) =>
    Object.hasOwn(values, name) ? String(values[name]) : match,
  );
}

function validateAccount(account: AccountForm, copy: SetupCopy) {
  if (!account.fullName.trim()) return copy["validation.account.fullName"];
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(account.email.trim())) {
    return copy["validation.account.email"];
  }
  if (!isPasswordValid(account.password)) {
    return copy["validation.account.password"];
  }
  if (account.password !== account.confirmPassword) {
    return copy["validation.account.passwordConfirm"];
  }
  return null;
}

async function readJsonResponse<TPayload>(
  response: Response,
  fallbackMessage: string,
) {
  const contentType = response.headers.get("content-type") ?? "";

  if (!contentType.toLowerCase().includes("application/json")) {
    throw new Error(fallbackMessage);
  }

  try {
    return (await response.json()) as TPayload;
  } catch {
    throw new Error(fallbackMessage);
  }
}

function Field({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) {
  const generatedId = useId();
  const childId =
    isValidElement<{ id?: string }>(children) && children.props.id
      ? children.props.id
      : generatedId;
  const control = isValidElement<{ id?: string }>(children)
    ? cloneElement(children, { id: childId })
    : children;

  return (
    <label className={styles.field} htmlFor={childId}>
      <span>{label}</span>
      {control}
    </label>
  );
}

export function SetupWizard({
  initialLocale,
  initialStatus = null,
}: {
  initialLocale: Locale;
  initialStatus?: StatusPayload | null;
}) {
  const router = useRouter();
  const initialJsonError = setupCopy[initialLocale]["json.failed"];
  const [locale, setLocale] = useState<Locale>(initialLocale);
  const [theme, setTheme] = useState<ThemeMode>("light");
  const [stepIndex, setStepIndex] = useState(0);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [sudo, setSudo] = useState<AccountForm>(initialAccount);
  const [admin, setAdmin] = useState<AccountForm>(initialAccount);
  const [apiKeys, setApiKeys] = useState<ApiKeysForm>(initialApiKeys);
  const [status, setStatus] = useState<StatusPayload | null>(initialStatus);
  const [apiTested, setApiTested] = useState(false);
  const [apiTestMessage, setApiTestMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  const activeStep = steps[stepIndex];
  const isLastStep = stepIndex === steps.length - 1;
  const copy = setupCopy[locale];
  const t = (key: SetupCopyKey, values?: Record<string, string | number>) =>
    formatCopy(copy, key, values);

  useEffect(() => {
    let isDisposed = false;

    setIsHydrated(true);
    const storedLocale = window.localStorage.getItem("platelets.setup.locale");
    const storedTheme = window.localStorage.getItem("platelets.setup.theme");

    if (storedLocale === "ko" || storedLocale === "en") {
      setLocale(storedLocale);
    } else if (navigator.language.toLowerCase().startsWith("ko")) {
      setLocale("ko");
    }

    if (storedTheme === "light" || storedTheme === "dark") {
      setTheme(storedTheme);
    } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      setTheme("dark");
    }

    if (initialStatus) {
      return () => {
        isDisposed = true;
      };
    }

    fetch("/api/setup/status", { cache: "no-store" })
      .then((response) =>
        readJsonResponse<StatusPayload>(response, initialJsonError),
      )
      .then((payload: StatusPayload) => {
        if (!isDisposed) {
          setStatus(payload);
        }
      })
      .catch((requestError) => {
        if (!isDisposed) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : String(requestError),
          );
        }
      });

    return () => {
      isDisposed = true;
    };
  }, [initialJsonError, initialStatus]);

  const stepError = useMemo(() => {
    if (activeStep.id === "license" && !acceptedTerms) {
      return copy["validation.license"];
    }
    if (activeStep.id === "sudo") {
      return validateAccount(sudo, copy);
    }
    if (activeStep.id === "admin") {
      return validateAccount(admin, copy);
    }
    if (activeStep.id === "api" && !apiTested) {
      return copy["validation.api"];
    }
    return null;
  }, [acceptedTerms, activeStep.id, admin, apiTested, sudo, copy]);

  function updateSudo(patch: Partial<AccountForm>) {
    setSudo((current) => ({ ...current, ...patch }));
  }

  function updateAdmin(patch: Partial<AccountForm>) {
    setAdmin((current) => ({ ...current, ...patch }));
  }

  function updateApiKeys(patch: Partial<ApiKeysForm>) {
    setApiKeys((current) => ({ ...current, ...patch }));
    setApiTested(false);
  }

  function changeLocale(nextLocale: Locale) {
    setLocale(nextLocale);
    window.localStorage.setItem("platelets.setup.locale", nextLocale);
  }

  function changeTheme(nextTheme: ThemeMode) {
    setTheme(nextTheme);
    window.localStorage.setItem("platelets.setup.theme", nextTheme);
  }

  async function testApiKeys() {
    setIsBusy(true);
    setError(null);
    setApiTestMessage(null);

    try {
      const response = await fetch("/api/setup/test-keys", {
        body: JSON.stringify(apiKeys),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = await readJsonResponse<{
        error?: string;
        ok?: boolean;
      }>(response, copy["json.failed"]);

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? copy["api.failed"]);
      }

      setApiTested(true);
      setApiTestMessage(copy["api.ready"]);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : String(requestError),
      );
    } finally {
      setIsBusy(false);
    }
  }

  async function completeInstallation() {
    setIsBusy(true);
    setError(null);

    try {
      const response = await fetch("/api/setup/complete", {
        body: JSON.stringify({
          admin,
          apiKeys,
          licenseAccepted: acceptedTerms,
          sudo,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = await readJsonResponse<{
        error?: string;
        ok?: boolean;
      }>(response, copy["json.failed"]);

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? copy["install.failed"]);
      }

      router.push("/");
      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : String(requestError),
      );
    } finally {
      setIsBusy(false);
    }
  }

  function goNext() {
    setError(null);

    if (stepError) {
      setError(stepError);
      return;
    }

    if (isLastStep) {
      void completeInstallation();
      return;
    }

    setStepIndex((current) => Math.min(current + 1, steps.length - 1));
  }

  return (
    <main className={styles.page} data-theme={theme}>
      <section className={styles.shell} aria-label="Platelets setup wizard">
        <aside className={styles.sidebar}>
          <div className={styles.sidebarTop}>
            <div className={styles.brand}>
              <span className={styles.logo}>
                <ShieldAlert aria-hidden="true" size={22} strokeWidth={2.6} />
              </span>
              <div>
                <strong>Platelets</strong>
                <span>{copy["brand.subtitle"]}</span>
              </div>
            </div>

            <div className={styles.controls}>
              <fieldset
                aria-label={copy["controls.language"]}
                className={styles.segmented}
              >
                <button
                  aria-pressed={locale === "ko"}
                  onClick={() => changeLocale("ko")}
                  type="button"
                >
                  <Languages aria-hidden="true" size={15} />
                  {copy["language.ko"]}
                </button>
                <button
                  aria-pressed={locale === "en"}
                  onClick={() => changeLocale("en")}
                  type="button"
                >
                  {copy["language.en"]}
                </button>
              </fieldset>
              <fieldset
                aria-label={copy["controls.theme"]}
                className={styles.segmented}
              >
                <button
                  aria-pressed={theme === "light"}
                  onClick={() => changeTheme("light")}
                  type="button"
                >
                  <Sun aria-hidden="true" size={15} />
                  {copy["theme.light"]}
                </button>
                <button
                  aria-pressed={theme === "dark"}
                  onClick={() => changeTheme("dark")}
                  type="button"
                >
                  <Moon aria-hidden="true" size={15} />
                  {copy["theme.dark"]}
                </button>
              </fieldset>
            </div>
          </div>

          <ol className={styles.steps}>
            {steps.map((step, index) => {
              const Icon = step.icon;
              const isDone = index < stepIndex;
              const isActive = index === stepIndex;

              return (
                <li
                  className={isActive ? styles.stepActive : styles.step}
                  key={step.id}
                >
                  <span className={isDone ? styles.stepDone : styles.stepMark}>
                    {isDone ? (
                      <Check aria-hidden="true" size={16} />
                    ) : (
                      <Icon aria-hidden="true" size={16} />
                    )}
                  </span>
                  <span>{copy[step.labelKey]}</span>
                </li>
              );
            })}
          </ol>

          <span className={styles.stepCount}>
            {t("status.step", { current: stepIndex + 1, total: steps.length })}
          </span>
        </aside>

        <div className={styles.content}>
          <div className={styles.mainPanel}>
            <span className={styles.eyebrow}>
              {t("status.step", {
                current: stepIndex + 1,
                total: steps.length,
              })}
            </span>

            {activeStep.id === "start" && (
              <>
                <h1>{copy["start.title"]}</h1>
                <p className={styles.lead}>{copy["start.lead"]}</p>
                <div className={styles.infoPanel}>{copy["start.info"]}</div>
              </>
            )}

            {activeStep.id === "license" && (
              <>
                <h1>{copy["license.title"]}</h1>
                <p className={styles.lead}>{copy["license.lead"]}</p>
                <div className={styles.termsBox}>
                  <h2>{copy["license.section1.title"]}</h2>
                  <p>{copy["license.section1.body"]}</p>
                  <h2>{copy["license.section2.title"]}</h2>
                  <p>{copy["license.section2.body"]}</p>
                </div>
                <label className={styles.checkRow}>
                  <input
                    checked={acceptedTerms}
                    onChange={(event) => setAcceptedTerms(event.target.checked)}
                    type="checkbox"
                  />
                  {copy["license.accept"]}
                </label>
              </>
            )}

            {activeStep.id === "environment" && (
              <>
                <h1>{copy["environment.title"]}</h1>
                <p className={styles.lead}>{copy["environment.lead"]}</p>
                <div className={styles.checkList}>
                  {(status?.environment.checks ?? []).map((check) => (
                    <div className={styles.checkItem} key={check.id}>
                      <span className={styles.okMark}>
                        <Check aria-hidden="true" size={16} />
                      </span>
                      <div>
                        <strong>{check.title}</strong>
                        <p>{check.detail}</p>
                      </div>
                    </div>
                  ))}
                  {!status && (
                    <div className={styles.checkItem}>
                      <LoaderCircle aria-hidden="true" size={18} />
                      <div>
                        <strong>{copy["environment.checking.title"]}</strong>
                        <p>{copy["environment.checking.detail"]}</p>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {activeStep.id === "sudo" && (
              <AccountStep
                account={sudo}
                t={t}
                description={copy["sudo.description"]}
                onChange={updateSudo}
                title={copy["sudo.title"]}
              />
            )}

            {activeStep.id === "admin" && (
              <AccountStep
                account={admin}
                t={t}
                description={copy["admin.description"]}
                onChange={updateAdmin}
                title={copy["admin.title"]}
              />
            )}

            {activeStep.id === "api" && (
              <>
                <h1>{copy["api.title"]}</h1>
                <p className={styles.lead}>{copy["api.lead"]}</p>
                <div className={styles.grid}>
                  <Field label={copy["field.vworldApiKey"]}>
                    <input
                      onChange={(event) =>
                        updateApiKeys({ vworldApiKey: event.target.value })
                      }
                      value={apiKeys.vworldApiKey}
                    />
                  </Field>
                  <Field label={copy["field.publicDataApiKey"]}>
                    <input
                      onChange={(event) =>
                        updateApiKeys({ publicDataApiKey: event.target.value })
                      }
                      value={apiKeys.publicDataApiKey}
                    />
                  </Field>
                  <Field label={copy["field.kakaoRestApiKey"]}>
                    <input
                      onChange={(event) =>
                        updateApiKeys({ kakaoRestApiKey: event.target.value })
                      }
                      value={apiKeys.kakaoRestApiKey}
                    />
                  </Field>
                  <Field label={copy["field.kakaoMobilityRestApiKey"]}>
                    <input
                      onChange={(event) =>
                        updateApiKeys({
                          kakaoMobilityRestApiKey: event.target.value,
                        })
                      }
                      value={apiKeys.kakaoMobilityRestApiKey}
                    />
                  </Field>
                  <Field label={copy["field.seoulOpenApiKey"]}>
                    <input
                      onChange={(event) =>
                        updateApiKeys({ seoulOpenApiKey: event.target.value })
                      }
                      value={apiKeys.seoulOpenApiKey}
                    />
                  </Field>
                  <Field label={copy["field.openaiApiKey"]}>
                    <input
                      onChange={(event) =>
                        updateApiKeys({ openaiApiKey: event.target.value })
                      }
                      type="password"
                      value={apiKeys.openaiApiKey}
                    />
                  </Field>
                </div>
                <Field label={copy["field.openaiBaseUrl"]}>
                  <input
                    onChange={(event) =>
                      updateApiKeys({ openaiBaseUrl: event.target.value })
                    }
                    value={apiKeys.openaiBaseUrl}
                  />
                </Field>
                <button
                  className={styles.secondaryButton}
                  disabled={!isHydrated || isBusy}
                  onClick={testApiKeys}
                  type="button"
                >
                  {copy["api.test"]}
                </button>
                {apiTestMessage && (
                  <p className={styles.successText}>{apiTestMessage}</p>
                )}
              </>
            )}

            {activeStep.id === "finish" && (
              <>
                <h1>{copy["finish.title"]}</h1>
                <p className={styles.lead}>{copy["finish.lead"]}</p>
                <div className={styles.infoPanel}>{copy["finish.info"]}</div>
              </>
            )}

            {error && <p className={styles.errorText}>{error}</p>}
          </div>

          <footer className={styles.footer}>
            <button
              className={styles.backButton}
              disabled={!isHydrated || stepIndex === 0 || isBusy}
              onClick={() =>
                setStepIndex((current) => Math.max(0, current - 1))
              }
              type="button"
            >
              <ArrowLeft aria-hidden="true" size={17} /> {copy["nav.back"]}
            </button>
            <button
              className={styles.primaryButton}
              disabled={!isHydrated || isBusy}
              onClick={goNext}
              type="button"
            >
              {isBusy ? (
                <LoaderCircle aria-hidden="true" size={17} />
              ) : isLastStep ? (
                <ShieldCheck aria-hidden="true" size={17} />
              ) : (
                <ArrowRight aria-hidden="true" size={17} />
              )}
              {isLastStep ? copy["nav.install"] : copy["nav.continue"]}
            </button>
          </footer>
        </div>
      </section>
    </main>
  );
}

function AccountStep({
  account,
  description,
  onChange,
  t,
  title,
}: {
  account: AccountForm;
  description: string;
  onChange: (patch: Partial<AccountForm>) => void;
  t: (key: SetupCopyKey, values?: Record<string, string | number>) => string;
  title: string;
}) {
  const passwordRequirementsId = useId();

  return (
    <>
      <h1>{title}</h1>
      <p className={styles.lead}>{description}</p>
      <div className={styles.grid}>
        <Field label={t("field.fullName")}>
          <input
            autoComplete="name"
            onChange={(event) => onChange({ fullName: event.target.value })}
            value={account.fullName}
          />
        </Field>
        <Field label={t("field.email")}>
          <input
            autoComplete="email"
            onChange={(event) => onChange({ email: event.target.value })}
            type="email"
            value={account.email}
          />
        </Field>
      </div>
      <label className={styles.field} htmlFor={passwordRequirementsId}>
        <span>{t("field.password")}</span>
        <input
          autoComplete="new-password"
          aria-describedby={`${passwordRequirementsId}-requirements`}
          id={passwordRequirementsId}
          onChange={(event) => onChange({ password: event.target.value })}
          type="password"
          value={account.password}
        />
      </label>
      <PasswordRequirementList
        id={`${passwordRequirementsId}-requirements`}
        password={account.password}
        t={t}
      />
      <Field label={t("field.confirmPassword")}>
        <input
          autoComplete="new-password"
          onChange={(event) =>
            onChange({ confirmPassword: event.target.value })
          }
          type="password"
          value={account.confirmPassword}
        />
      </Field>
    </>
  );
}

function PasswordRequirementList({
  id,
  password,
  t,
}: {
  id: string;
  password: string;
  t: (key: SetupCopyKey, values?: Record<string, string | number>) => string;
}) {
  const requirements = getPasswordRequirementResults(password);

  return (
    <output aria-live="polite" className={styles.passwordChecklist} id={id}>
      <span className={styles.passwordChecklistTitle}>
        {t("password.requirement.title")}
      </span>
      <ul>
        {requirements.map((requirement) => {
          const status = requirement.met
            ? t("password.requirement.met")
            : t("password.requirement.missing");

          return (
            <li
              className={
                requirement.met
                  ? styles.passwordRequirementMet
                  : styles.passwordRequirementMissing
              }
              key={requirement.id}
            >
              {requirement.met ? (
                <Check aria-hidden="true" size={15} />
              ) : (
                <X aria-hidden="true" size={15} />
              )}
              <span>{t(passwordRequirementLabelKeys[requirement.id])}</span>
              <span className={styles.visuallyHidden}>{status}</span>
            </li>
          );
        })}
      </ul>
    </output>
  );
}
