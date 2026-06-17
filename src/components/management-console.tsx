"use client";

import {
  AlertTriangle,
  BookOpen,
  Building2,
  ClipboardList,
  Clock3,
  Database,
  Droplets,
  Flame,
  GraduationCap,
  HeartPulse,
  RefreshCw,
  Save,
  Shield,
  TerminalSquare,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { DatabaseMigrationPanel } from "@/components/database-migration-panel";
import { IntegrationSettingsPanel } from "@/components/integration-settings-panel";
import type { DatabaseEngine } from "@/lib/database/types";
import type { DatasetSourceId } from "@/lib/dataset-sources";
import { type AppDictionary, uiText } from "@/lib/i18n";
import type { OperationalSettings } from "@/lib/operational-settings";
import styles from "./management-console.module.css";

type DatasetStatus = {
  error: string | null;
  failedCount: number;
  fetchedAt: string | null;
  geocodedCount: number;
  id: DatasetSourceId;
  importProgress: DatasetImportProgress | null;
  label: string;
  recordCount: number;
  skippedCount: number;
  updatedAt: string | null;
  updateProgress: DatasetUpdateProgress | null;
};

type DatasetUpdateProgress = {
  message: string;
  percent: number;
  source: DatasetSourceId;
  stage:
    | "preparing"
    | "requesting"
    | "receiving"
    | "processing"
    | "saving"
    | "completed"
    | "failed";
  status: "completed" | "failed" | "running";
  updatedAt: string;
};

type DatasetImportProgress = {
  failedCount: number;
  fetchedAt: string;
  geocodedCount: number;
  importedCount: number;
  mode: "restart" | "resume";
  nextIndex: number;
  reason: string | null;
  skippedCount: number;
  source: DatasetSourceId;
  startedAt: string;
  status: "paused" | "running";
  totalCount: number;
  updatedAt: string;
};

type ApiUsageWindow = {
  monthlyLimit: number;
  provider: "kakao-local" | "kma-earthquake";
  registeredAt: string | null;
  updatedAt: string | null;
  usedCount: number;
  windowEndsAt: string | null;
  windowStartedAt: string | null;
};

type ApiLogEntry = {
  action: string;
  category: string;
  eventAt: string;
  id: number;
  level: string;
  message: string;
  metadata: Record<string, unknown>;
  requestCount: number;
  source: DatasetSourceId | null;
  status: "failure" | "skipped" | "success";
};

type UpdateCooldown = {
  action: string;
  available: boolean;
  cooldownMs: number;
  lastUsedAt: string | null;
  nextAvailableAt: string | null;
  remainingMs: number;
};

type TimeStatus = {
  ntp: {
    error: string | null;
    selected: {
      host: string;
      offsetMs: number | null;
      roundTripDelayMs: number | null;
    } | null;
  };
  ntpServers: string[];
  serverTime: string;
  thresholdMs: number;
};

type ManagementConsoleProps = {
  currentDatabaseEngine?: DatabaseEngine;
  dictionary: AppDictionary;
  mode: "admin" | "sudo";
  hasSudoSession?: boolean;
};

type ManagementTab =
  | "integrations"
  | "logs"
  | "overview"
  | "settings"
  | "status"
  | "updates";

type ProgressState = {
  currentStep: string;
  percent: number;
  title: string;
};

type DatasetScheduleSettings = Record<
  DatasetSourceId,
  { enabled: boolean; intervalDays: number }
>;

function formatDateTime(value: string | null, locale: string) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeZone: "Asia/Seoul",
    timeStyle: "short",
  }).format(date);
}

function formatDuration(value: number) {
  const totalSeconds = Math.max(0, Math.ceil(value / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function formatSignedSeconds(value: number | null, locale: string) {
  if (value === null) {
    return "-";
  }

  const sign = value > 0 ? "+" : "";

  return `${sign}${(value / 1000).toLocaleString(locale, {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  })}s`;
}

function statusClassName(status: ApiLogEntry["status"]) {
  if (status === "success") {
    return styles.statusSuccess;
  }

  if (status === "failure") {
    return styles.statusFailure;
  }

  return styles.statusSkipped;
}

function datasetIcon(source: DatasetSourceId) {
  if (source === "fire-stations") {
    return <Flame aria-hidden="true" size={16} strokeWidth={2.4} />;
  }

  if (
    source === "fire-safety-targets" ||
    source === "busan-fire-safety-targets"
  ) {
    return <Building2 aria-hidden="true" size={16} strokeWidth={2.4} />;
  }

  if (
    source === "fire-water-sources" ||
    source === "busan-fire-water-sources"
  ) {
    return <Droplets aria-hidden="true" size={16} strokeWidth={2.4} />;
  }

  if (source === "police-stations") {
    return <Shield aria-hidden="true" size={16} strokeWidth={2.4} />;
  }

  if (source === "schools") {
    return <BookOpen aria-hidden="true" size={16} strokeWidth={2.4} />;
  }

  if (source === "universities") {
    return <GraduationCap aria-hidden="true" size={16} strokeWidth={2.4} />;
  }

  return <HeartPulse aria-hidden="true" size={16} strokeWidth={2.4} />;
}

function formatImportProgress(
  progress: DatasetImportProgress | null,
  dictionary: AppDictionary,
) {
  if (!progress) {
    return "-";
  }

  const label =
    progress.status === "paused"
      ? uiText(dictionary, "일시중단")
      : uiText(dictionary, "진행 중");

  return uiText(dictionary, "진행 중 {current}/{total}, 좌표 {geocoded}", {
    current: progress.nextIndex.toLocaleString(dictionary.formatLocale),
    geocoded: progress.geocodedCount.toLocaleString(dictionary.formatLocale),
    total: progress.totalCount.toLocaleString(dictionary.formatLocale),
  }).replace(uiText(dictionary, "진행 중"), label);
}

export function ManagementConsole({
  currentDatabaseEngine,
  dictionary,
  mode,
  hasSudoSession = false,
}: ManagementConsoleProps) {
  const progressTitleId = useId();
  const t = useCallback(
    (key: string, values?: Record<string, string | number>) =>
      uiText(dictionary, key, values),
    [dictionary],
  );
  const [datasets, setDatasets] = useState<DatasetStatus[]>([]);
  const [quota, setQuota] = useState<ApiUsageWindow | null>(null);
  const [kmaQuota, setKmaQuota] = useState<ApiUsageWindow | null>(null);
  const [logs, setLogs] = useState<ApiLogEntry[]>([]);
  const [cooldowns, setCooldowns] = useState<UpdateCooldown[]>([]);
  const [timeStatus, setTimeStatus] = useState<TimeStatus | null>(null);
  const [ntpServersDraft, setNtpServersDraft] = useState("");
  const [activeUpdate, setActiveUpdate] = useState<DatasetSourceId | "all">();
  const [activeDatasetSource, setActiveDatasetSource] =
    useState<DatasetSourceId>();
  const [notice, setNotice] = useState<string>("");
  const [progress, setProgress] = useState<ProgressState | null>(null);
  const [schedules, setSchedules] = useState<DatasetScheduleSettings | null>(
    null,
  );
  const [operationalSettings, setOperationalSettings] =
    useState<OperationalSettings | null>(null);
  const [savingSchedules, setSavingSchedules] = useState(false);
  const [savingOperationalSettings, setSavingOperationalSettings] =
    useState(false);
  const [savingNtpServers, setSavingNtpServers] = useState(false);
  const [clockTick, setClockTick] = useState(0);
  const [sudoPassword, setSudoPassword] = useState("");
  const [activeTab, setActiveTab] = useState<ManagementTab>("overview");
  const [isSudoActive, setIsSudoActive] = useState(hasSudoSession);
  const [loggingIn, setLoggingIn] = useState(false);

  const title =
    mode === "sudo" ? t("개발자 총 권한 페이지") : t("관리자 페이지");
  const loginIfNeeded = useCallback(async () => {
    const password = sudoPassword.trim();
    if (!password) return;

    const response = await fetch("/api/auth/login", {
      body: JSON.stringify({ password }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const payload = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;

    if (!response.ok) {
      throw new Error(payload?.error ?? t("로그인에 실패했습니다."));
    }

    setSudoPassword("");
    setIsSudoActive(true);
  }, [sudoPassword, t]);
  const quotaPercent = useMemo(() => {
    if (!quota || quota.monthlyLimit === 0) {
      return 0;
    }

    return Math.round((quota.usedCount / quota.monthlyLimit) * 1000) / 10;
  }, [quota]);
  const kmaQuotaPercent = useMemo(() => {
    if (!kmaQuota || kmaQuota.monthlyLimit === 0) {
      return 0;
    }

    return Math.round((kmaQuota.usedCount / kmaQuota.monthlyLimit) * 1000) / 10;
  }, [kmaQuota]);
  const cooldownByAction = useMemo(
    () => new Map(cooldowns.map((cooldown) => [cooldown.action, cooldown])),
    [cooldowns],
  );
  const isUpdating = Boolean(activeUpdate) || Boolean(progress);
  const datasetProgress = useMemo<ProgressState | null>(() => {
    if (!activeUpdate) {
      return null;
    }

    const current =
      datasets.find((dataset) => dataset.id === activeDatasetSource) ??
      datasets.find(
        (dataset) => dataset.updateProgress?.status === "running",
      ) ??
      (activeUpdate === "all"
        ? null
        : datasets.find((dataset) => dataset.id === activeUpdate));
    const updateProgress = current?.updateProgress;

    if (!updateProgress) {
      return {
        currentStep: t("업데이트 요청을 서버에 전달하고 있습니다."),
        percent: 1,
        title:
          activeUpdate === "all" ? t("전체 데이터 갱신") : t("데이터셋 갱신"),
      };
    }

    return {
      currentStep: `${current.label}: ${updateProgress.message}`,
      percent: updateProgress.percent,
      title:
        activeUpdate === "all"
          ? t("전체 데이터 갱신")
          : `${current.label} ${t("갱신")}`,
    };
  }, [activeDatasetSource, activeUpdate, datasets, t]);
  const visibleProgress = progress ?? datasetProgress;

  function getCooldown(action: string) {
    const cooldown = cooldownByAction.get(action);
    void clockTick;

    if (!cooldown?.nextAvailableAt) {
      return cooldown ?? null;
    }

    const remainingMs = Math.max(
      0,
      new Date(cooldown.nextAvailableAt).getTime() - Date.now(),
    );

    return {
      ...cooldown,
      available: remainingMs === 0,
      remainingMs,
    };
  }

  function datasetCooldown(source: DatasetSourceId) {
    return getCooldown(`dataset:${source}`);
  }

  function actionUnavailableLabel(cooldown: UpdateCooldown | null) {
    if (!cooldown || cooldown.available) {
      return "";
    }

    return t("다시 가능: {duration}", {
      duration: formatDuration(cooldown.remainingMs),
    });
  }

  async function parseUpdateError(response: Response, fallback: string) {
    const payload = (await response.json().catch(() => null)) as {
      cooldown?: UpdateCooldown;
      error?: string;
    } | null;

    if (response.status === 429 && payload?.cooldown) {
      return t(
        "5분 갱신 간격 적용 중입니다. {duration} 뒤 다시 시도할 수 있습니다.",
        { duration: formatDuration(payload.cooldown.remainingMs) },
      );
    }

    return payload?.error ?? fallback;
  }

  const refresh = useCallback(async () => {
    const [
      datasetsResponse,
      timeResponse,
      schedulesResponse,
      operationalSettingsResponse,
    ] = await Promise.all([
      fetch("/api/datasets", { cache: "no-store" }),
      fetch("/api/server-time", { cache: "no-store" }),
      fetch("/api/admin/dataset-schedules", { cache: "no-store" }),
      fetch("/api/admin/operational-settings", { cache: "no-store" }),
    ]);

    if (
      !(
        datasetsResponse.ok &&
        timeResponse.ok &&
        schedulesResponse.ok &&
        operationalSettingsResponse.ok
      )
    ) {
      throw new Error(t("관리 데이터를 불러오지 못했습니다."));
    }

    setDatasets((await datasetsResponse.json()).datasets);
    setSchedules((await schedulesResponse.json()).schedules);
    setOperationalSettings((await operationalSettingsResponse.json()).settings);
    const nextTimeStatus = (await timeResponse.json()) as TimeStatus;
    setTimeStatus(nextTimeStatus);
    setNtpServersDraft(nextTimeStatus.ntpServers.join("\n"));

    if (mode !== "sudo" || !isSudoActive) {
      setQuota(null);
      setKmaQuota(null);
      setLogs([]);
      setCooldowns([]);
      return;
    }

    const [quotaResponse, kmaQuotaResponse, logsResponse, cooldownsResponse] =
      await Promise.all([
        fetch("/api/geocoding/quota", {
          cache: "no-store",
        }),
        fetch("/api/hazards/quota", {
          cache: "no-store",
        }),
        fetch(`/api/logs?limit=12&ts=${Date.now()}`, {
          cache: "no-store",
        }),
        fetch("/api/admin/update-cooldowns", {
          cache: "no-store",
        }),
      ]);

    if (
      !(
        quotaResponse.ok &&
        kmaQuotaResponse.ok &&
        logsResponse.ok &&
        cooldownsResponse.ok
      )
    ) {
      throw new Error(t("개발자 권한 데이터를 불러오지 못했습니다."));
    }

    setQuota((await quotaResponse.json()).quota);
    setKmaQuota((await kmaQuotaResponse.json()).quota);
    setLogs((await logsResponse.json()).logs);
    setCooldowns((await cooldownsResponse.json()).cooldowns);
  }, [mode, isSudoActive, t]);

  async function handleSudoLogin(event?: React.FormEvent) {
    if (event) {
      event.preventDefault();
    }
    const password = sudoPassword.trim();
    if (!password) return;

    setLoggingIn(true);
    setNotice("");
    try {
      const response = await fetch("/api/auth/login", {
        body: JSON.stringify({ password }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? t("로그인에 실패했습니다."));
      }

      setSudoPassword("");
      setIsSudoActive(true);
      setNotice(t("세션 활성화 완료"));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setLoggingIn(false);
    }
  }

  async function requestDatasetUpdate(
    source: DatasetSourceId,
    importMode: "restart" | "resume",
  ) {
    const response = await fetch(`/api/datasets/${source}/update`, {
      body: JSON.stringify({ mode: importMode }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });

    if (!response.ok) {
      throw new Error(await parseUpdateError(response, t("업데이트 실패")));
    }

    const payload = (await response.json().catch(() => null)) as {
      error?: string;
      paused?: boolean;
    } | null;

    return payload?.paused
      ? (payload.error ?? t("업데이트가 일시중단되었습니다."))
      : null;
  }

  async function updateDataset(
    source: DatasetSourceId | "all",
    updateMode: "restart" | "resume" = "restart",
  ) {
    if (mode !== "sudo") {
      return;
    }

    const blockedCooldown =
      source === "all"
        ? datasets
            .map((dataset) => datasetCooldown(dataset.id))
            .find((cooldown) => cooldown && !cooldown.available)
        : datasetCooldown(source);

    if (blockedCooldown && !blockedCooldown.available) {
      setNotice(
        t(
          "5분 갱신 간격 적용 중입니다. {duration} 뒤 다시 시도할 수 있습니다.",
          { duration: formatDuration(blockedCooldown.remainingMs) },
        ),
      );
      return;
    }

    setActiveUpdate(source);
    setNotice(t("업데이트 중"));

    try {
      await loginIfNeeded();
      let pausedMessage: string | null = null;

      if (source === "all") {
        for (const dataset of datasets) {
          setActiveDatasetSource(dataset.id);
          pausedMessage = await requestDatasetUpdate(dataset.id, "restart");

          if (pausedMessage) {
            break;
          }
        }
      } else {
        setActiveDatasetSource(source);
        pausedMessage = await requestDatasetUpdate(source, updateMode);
      }

      await refresh();
      setNotice(pausedMessage ?? t("업데이트 완료"));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setActiveUpdate(undefined);
      setActiveDatasetSource(undefined);
    }
  }

  async function saveSchedules() {
    if (mode !== "sudo" || !schedules) {
      return;
    }

    setSavingSchedules(true);

    try {
      await loginIfNeeded();
      const response = await fetch("/api/admin/dataset-schedules", {
        body: JSON.stringify({ schedules }),
        headers: { "Content-Type": "application/json" },
        method: "PUT",
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(payload?.error ?? t("갱신 주기 저장 실패"));
      }

      setSchedules((await response.json()).schedules);
      setNotice(t("데이터셋 갱신 주기를 저장했습니다."));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setSavingSchedules(false);
    }
  }

  async function saveOperationalSettingsForm() {
    if (mode !== "sudo" || !operationalSettings) {
      return;
    }

    setSavingOperationalSettings(true);

    try {
      await loginIfNeeded();
      const response = await fetch("/api/admin/operational-settings", {
        body: JSON.stringify({ settings: operationalSettings }),
        headers: { "Content-Type": "application/json" },
        method: "PUT",
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        settings?: OperationalSettings;
      } | null;

      if (!(response.ok && payload?.settings)) {
        throw new Error(payload?.error ?? t("운영 설정 저장 실패"));
      }

      setOperationalSettings(payload.settings);
      setNotice(t("운영 설정을 저장했습니다."));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setSavingOperationalSettings(false);
    }
  }

  async function updateHazards() {
    if (mode !== "sudo") {
      return;
    }

    const blockedCooldown = getCooldown("hazards");

    if (blockedCooldown && !blockedCooldown.available) {
      setNotice(
        t(
          "5분 갱신 간격 적용 중입니다. {duration} 뒤 다시 시도할 수 있습니다.",
          { duration: formatDuration(blockedCooldown.remainingMs) },
        ),
      );
      return;
    }

    setNotice(t("지진/지진해일 업데이트 중"));
    setProgress({
      currentStep: t("기상청 지진/지진해일 정보 요청 중"),
      percent: 35,
      title: t("재난 이벤트 갱신"),
    });

    try {
      await loginIfNeeded();
      const response = await fetch("/api/hazards/update", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error(
          await parseUpdateError(response, t("지진/지진해일 업데이트 실패")),
        );
      }

      setProgress({
        currentStep: t("갱신 결과 불러오는 중"),
        percent: 90,
        title: t("재난 이벤트 갱신"),
      });
      await refresh();
      setNotice(t("지진/지진해일 업데이트 완료"));
      setProgress({
        currentStep: t("완료"),
        percent: 100,
        title: t("재난 이벤트 갱신"),
      });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      window.setTimeout(() => setProgress(null), 500);
    }
  }

  async function saveNtpServers() {
    if (mode !== "sudo") {
      return;
    }

    setSavingNtpServers(true);
    setNotice(t("NTP 서버 목록 저장 중"));

    try {
      await loginIfNeeded();
      const servers = ntpServersDraft
        .split(/\r?\n/)
        .map((server) => server.trim())
        .filter(Boolean);
      const response = await fetch("/api/ntp/servers", {
        body: JSON.stringify({ servers }),
        headers: { "Content-Type": "application/json" },
        method: "PUT",
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(payload?.error ?? t("NTP 서버 목록 저장 실패"));
      }

      await refresh();
      setNotice(t("NTP 서버 목록 저장 완료"));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setSavingNtpServers(false);
    }
  }

  useEffect(() => {
    refresh().catch((error) => {
      setNotice(error instanceof Error ? error.message : String(error));
    });
  }, [refresh]);

  useEffect(() => {
    if (!(activeUpdate || progress)) {
      return;
    }

    const timer = window.setInterval(() => {
      refresh().catch((error) => {
        setNotice(error instanceof Error ? error.message : String(error));
      });
    }, 2500);

    return () => window.clearInterval(timer);
  }, [activeUpdate, progress, refresh]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      refresh().catch((error) => {
        setNotice(error instanceof Error ? error.message : String(error));
      });
    }, 10_000);

    return () => window.clearInterval(timer);
  }, [refresh]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setClockTick((value) => value + 1);
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  const allDatasetCooldown =
    datasets
      .map((dataset) => datasetCooldown(dataset.id))
      .find((cooldown) => cooldown && !cooldown.available) ?? null;
  const hazardsCooldown = getCooldown("hazards");
  const pausedDatasets = datasets.filter(
    (dataset) => dataset.importProgress?.status === "paused",
  );
  const managementTabs = useMemo(
    () =>
      [
        { id: "overview", label: t("adminTabs.overview") },
        mode === "sudo" && isSudoActive
          ? { id: "integrations", label: t("adminTabs.integrations") }
          : null,
        mode === "sudo" && isSudoActive
          ? { id: "settings", label: t("adminTabs.settings") }
          : null,
        mode === "sudo" && isSudoActive
          ? { id: "updates", label: t("adminTabs.updates") }
          : null,
        { id: "status", label: t("adminTabs.status") },
        mode === "sudo" && isSudoActive
          ? { id: "logs", label: t("adminTabs.logs") }
          : null,
      ].filter((tab): tab is { id: ManagementTab; label: string } =>
        Boolean(tab),
      ),
    [mode, isSudoActive, t],
  );

  useEffect(() => {
    if (!managementTabs.some((tab) => tab.id === activeTab)) {
      setActiveTab(managementTabs[0]?.id ?? "overview");
    }
  }, [activeTab, managementTabs]);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>{title}</h1>
        <nav className={styles.navLinks} aria-label={t("관리 메뉴")}>
          <Link className={styles.navLink} href="/">
            {t("지도")}
          </Link>
          <Link className={styles.navLink} href="/admin">
            {t("관리자")}
          </Link>
          {mode === "sudo" ? (
            <>
              <Link className={styles.navLink} href="/sudo">
                {t("개발자")}
              </Link>
              <Link className={styles.navLink} href="/logs">
                {t("로그")}
              </Link>
            </>
          ) : null}
        </nav>
      </header>

      <main className={styles.content}>
        <div
          aria-label={t("adminTabs.label")}
          className={styles.tabList}
          role="tablist"
        >
          {managementTabs.map((tab) => (
            <button
              aria-selected={activeTab === tab.id}
              className={styles.tabButton}
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              role="tab"
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </div>

        {notice ? <output className={styles.notice}>{notice}</output> : null}

        {activeTab === "overview" ? (
          <section className={styles.summaryGrid}>
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <span className={styles.cardTitle}>
                  <Database aria-hidden="true" size={18} strokeWidth={2.4} />
                  {t("데이터셋")}
                </span>
              </div>
              <strong className={styles.metric}>
                {datasets
                  .reduce((total, dataset) => total + dataset.recordCount, 0)
                  .toLocaleString(dictionary.formatLocale)}
              </strong>
              <span className={styles.muted}>{t("저장된 전체 기록")}</span>
            </div>

            {mode === "sudo" ? (
              <>
                <div className={styles.card}>
                  <div className={styles.cardHeader}>
                    <span className={styles.cardTitle}>
                      <TerminalSquare
                        aria-hidden="true"
                        size={18}
                        strokeWidth={2.4}
                      />
                      {t("카카오 로컬 API")}
                    </span>
                  </div>
                  <strong className={styles.metric}>
                    {uiText(dictionary, "format.quota", {
                      limit: (quota?.monthlyLimit ?? 100000).toLocaleString(
                        dictionary.formatLocale,
                      ),
                      used: (quota?.usedCount ?? 0).toLocaleString(
                        dictionary.formatLocale,
                      ),
                    })}
                  </strong>
                  <span className={styles.muted}>
                    {quotaPercent}
                    {t("% 사용, 리셋")}{" "}
                    {formatDateTime(
                      quota?.windowEndsAt ?? null,
                      dictionary.formatLocale,
                    )}
                  </span>
                </div>

                <div className={styles.card}>
                  <div className={styles.cardHeader}>
                    <span className={styles.cardTitle}>
                      <AlertTriangle
                        aria-hidden="true"
                        size={18}
                        strokeWidth={2.4}
                      />
                      {t("기상청 지진 API")}
                    </span>
                  </div>
                  <strong className={styles.metric}>
                    {uiText(dictionary, "format.quota", {
                      limit: (kmaQuota?.monthlyLimit ?? 5000).toLocaleString(
                        dictionary.formatLocale,
                      ),
                      used: (kmaQuota?.usedCount ?? 0).toLocaleString(
                        dictionary.formatLocale,
                      ),
                    })}
                  </strong>
                  <span className={styles.muted}>
                    {kmaQuotaPercent}
                    {t("% 사용, 리셋")}{" "}
                    {formatDateTime(
                      kmaQuota?.windowEndsAt ?? null,
                      dictionary.formatLocale,
                    )}
                  </span>
                </div>

                <div className={styles.card}>
                  <div className={styles.cardHeader}>
                    <span className={styles.cardTitle}>
                      <ClipboardList
                        aria-hidden="true"
                        size={18}
                        strokeWidth={2.4}
                      />
                      {t("최근 로그")}
                    </span>
                  </div>
                  <strong className={styles.metric}>
                    {logs.length.toLocaleString(dictionary.formatLocale)}
                  </strong>
                  <span className={styles.muted}>{t("최근 12건")}</span>
                </div>
              </>
            ) : null}
          </section>
        ) : null}

        {mode === "sudo" && activeTab === "overview" && !isSudoActive ? (
          <section className={styles.card}>
            <form
              onSubmit={handleSudoLogin}
              className={styles.settingsGrid}
              style={{ gridTemplateColumns: "1fr" }}
            >
              <div className={styles.cardHeader}>
                <span className={styles.cardTitle}>{t("개발자 권한")}</span>
                <span className={styles.muted}>{t("세션 필요")}</span>
              </div>
              <label className={styles.fieldLabel}>
                {t("sudo 비밀번호")}
                <input
                  autoComplete="current-password"
                  className={styles.textInput}
                  onChange={(event) => setSudoPassword(event.target.value)}
                  type="password"
                  value={sudoPassword}
                />
              </label>
              <button
                className={styles.actionButton}
                disabled={loggingIn || !sudoPassword.trim()}
                type="submit"
                style={{ justifySelf: "start", marginTop: "10px" }}
              >
                {loggingIn ? (
                  <RefreshCw
                    aria-hidden="true"
                    className={styles.spinning}
                    size={16}
                    strokeWidth={2.4}
                  />
                ) : null}
                {t("인증")}
              </button>
            </form>
          </section>
        ) : null}

        {mode === "sudo" &&
        activeTab === "integrations" &&
        currentDatabaseEngine ? (
          <DatabaseMigrationPanel
            currentEngine={currentDatabaseEngine}
            dictionary={dictionary}
            ensureSudoSession={loginIfNeeded}
          />
        ) : null}

        {mode === "sudo" && activeTab === "integrations" ? (
          <IntegrationSettingsPanel
            dictionary={dictionary}
            ensureSudoSession={loginIfNeeded}
            isSudoActive={isSudoActive}
          />
        ) : null}

        {mode === "sudo" && activeTab === "settings" && operationalSettings ? (
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <span className={styles.cardTitle}>{t("운영 설정")}</span>
              <button
                className={styles.actionButton}
                disabled={savingOperationalSettings}
                onClick={saveOperationalSettingsForm}
                type="button"
              >
                <Save aria-hidden="true" size={16} strokeWidth={2.4} />
                {t("저장")}
              </button>
            </div>
            <div className={styles.settingsGrid}>
              <label className={styles.fieldLabel}>
                <input
                  checked={operationalSettings.aiAllowPrivateBaseUrl}
                  onChange={(event) =>
                    setOperationalSettings((current) =>
                      current
                        ? {
                            ...current,
                            aiAllowPrivateBaseUrl: event.target.checked,
                          }
                        : current,
                    )
                  }
                  type="checkbox"
                />
                {t("사설망 AI Base URL 허용")}
              </label>
              <label className={styles.fieldLabel}>
                <input
                  checked={operationalSettings.datasetAutoUpdateEnabled}
                  onChange={(event) =>
                    setOperationalSettings((current) =>
                      current
                        ? {
                            ...current,
                            datasetAutoUpdateEnabled: event.target.checked,
                          }
                        : current,
                    )
                  }
                  type="checkbox"
                />
                {t("데이터셋 자동 갱신")}
              </label>
              <label className={styles.fieldLabel}>
                {t("기본 지도 제공자")}
                <select
                  className={styles.textInput}
                  onChange={(event) =>
                    setOperationalSettings((current) =>
                      current
                        ? {
                            ...current,
                            mapProvider: event.target.value as "osm" | "vworld",
                          }
                        : current,
                    )
                  }
                  value={operationalSettings.mapProvider}
                >
                  <option value="osm">{t("OSM")}</option>
                  <option value="vworld">{t("브이월드")}</option>
                </select>
              </label>
              <label className={styles.fieldLabel}>
                {t("지도 타일 방식")}
                <select
                  className={styles.textInput}
                  onChange={(event) =>
                    setOperationalSettings((current) =>
                      current
                        ? {
                            ...current,
                            mapTileMode: event.target.value as
                              | "raster"
                              | "vector",
                          }
                        : current,
                    )
                  }
                  value={operationalSettings.mapTileMode}
                >
                  <option value="vector">{t("벡터")}</option>
                  <option value="raster">{t("레스터")}</option>
                </select>
              </label>
              <label className={styles.fieldLabel}>
                {t("OSM 타일 소스")}
                <select
                  className={styles.textInput}
                  onChange={(event) =>
                    setOperationalSettings((current) =>
                      current
                        ? {
                            ...current,
                            osmTileSource: event.target.value as
                              | "official"
                              | "openfreemap",
                          }
                        : current,
                    )
                  }
                  value={operationalSettings.osmTileSource}
                >
                  <option value="openfreemap">{t("OpenFreeMap")}</option>
                  <option value="official">{t("OSM 공식")}</option>
                </select>
              </label>
              <label className={styles.fieldLabel}>
                {t("지진 API 폴링 간격(ms)")}
                <input
                  className={styles.textInput}
                  min={60000}
                  onChange={(event) =>
                    setOperationalSettings((current) =>
                      current
                        ? {
                            ...current,
                            kmaEarthquakePollIntervalMs: Number(
                              event.target.value,
                            ),
                          }
                        : current,
                    )
                  }
                  type="number"
                  value={operationalSettings.kmaEarthquakePollIntervalMs}
                />
              </label>
              <label className={styles.fieldLabel}>
                {t("Overpass API URL")}
                <input
                  className={styles.textInput}
                  onChange={(event) =>
                    setOperationalSettings((current) =>
                      current
                        ? { ...current, overpassApiUrl: event.target.value }
                        : current,
                    )
                  }
                  value={operationalSettings.overpassApiUrl}
                />
              </label>
            </div>
          </section>
        ) : null}

        {mode === "sudo" && activeTab === "updates" && schedules ? (
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <span className={styles.cardTitle}>
                <Clock3 aria-hidden="true" size={18} strokeWidth={2.4} />
                {t("자동 갱신 주기")}
              </span>
              <button
                className={styles.actionButton}
                disabled={savingSchedules}
                onClick={saveSchedules}
                type="button"
              >
                <Save aria-hidden="true" size={16} strokeWidth={2.4} />
                {t("주기 저장")}
              </button>
            </div>
            <div className={styles.scheduleGrid}>
              {datasets.map((dataset) => {
                const schedule = schedules[dataset.id];

                return (
                  <div className={styles.scheduleRow} key={dataset.id}>
                    <label className={styles.scheduleEnabled}>
                      <input
                        checked={schedule.enabled}
                        onChange={(event) =>
                          setSchedules((current) =>
                            current
                              ? {
                                  ...current,
                                  [dataset.id]: {
                                    ...current[dataset.id],
                                    enabled: event.target.checked,
                                  },
                                }
                              : current,
                          )
                        }
                        type="checkbox"
                      />
                      <span>{dataset.label}</span>
                    </label>
                    <label className={styles.scheduleInterval}>
                      <input
                        className={`${styles.textInput} ${styles.scheduleInput}`}
                        max={365}
                        min={1}
                        onChange={(event) =>
                          setSchedules((current) =>
                            current
                              ? {
                                  ...current,
                                  [dataset.id]: {
                                    ...current[dataset.id],
                                    intervalDays: Number(event.target.value),
                                  },
                                }
                              : current,
                          )
                        }
                        type="number"
                        value={schedule.intervalDays}
                      />
                      <span>{t("일마다")}</span>
                    </label>
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}

        {mode === "sudo" && activeTab === "updates" ? (
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <span className={styles.cardTitle}>{t("데이터 갱신")}</span>
            </div>
            <div className={styles.actions}>
              <button
                className={styles.actionButton}
                disabled={isUpdating || Boolean(allDatasetCooldown)}
                onClick={() => updateDataset("all")}
                title={actionUnavailableLabel(allDatasetCooldown)}
                type="button"
              >
                <RefreshCw
                  aria-hidden="true"
                  className={
                    activeUpdate === "all" ? styles.spinning : undefined
                  }
                  size={16}
                  strokeWidth={2.4}
                />
                {t("전체")}
                {allDatasetCooldown ? (
                  <span className={styles.buttonMeta}>
                    {formatDuration(allDatasetCooldown.remainingMs)}
                  </span>
                ) : null}
              </button>
              {datasets.map((dataset) => {
                const cooldown = datasetCooldown(dataset.id);

                return (
                  <button
                    className={styles.actionButton}
                    disabled={
                      isUpdating || Boolean(cooldown && !cooldown.available)
                    }
                    key={dataset.id}
                    onClick={() => updateDataset(dataset.id)}
                    title={actionUnavailableLabel(cooldown)}
                    type="button"
                  >
                    {activeUpdate === dataset.id ? (
                      <RefreshCw
                        aria-hidden="true"
                        className={styles.spinning}
                        size={16}
                        strokeWidth={2.4}
                      />
                    ) : (
                      datasetIcon(dataset.id)
                    )}
                    {dataset.label}
                    {cooldown && !cooldown.available ? (
                      <span className={styles.buttonMeta}>
                        {formatDuration(cooldown.remainingMs)}
                      </span>
                    ) : null}
                  </button>
                );
              })}
              {pausedDatasets.map((dataset) => {
                const cooldown = datasetCooldown(dataset.id);
                const disabled =
                  isUpdating || Boolean(cooldown && !cooldown.available);

                return (
                  <div
                    className={styles.resumeGroup}
                    key={`${dataset.id}-resume`}
                  >
                    <span>{dataset.label}</span>
                    <button
                      className={styles.actionButton}
                      disabled={disabled}
                      onClick={() => updateDataset(dataset.id, "restart")}
                      title={actionUnavailableLabel(cooldown)}
                      type="button"
                    >
                      <RefreshCw
                        aria-hidden="true"
                        size={16}
                        strokeWidth={2.4}
                      />
                      {t("처음부터 다시 하기")}
                    </button>
                    <button
                      className={styles.actionButton}
                      disabled={disabled}
                      onClick={() => updateDataset(dataset.id, "resume")}
                      title={actionUnavailableLabel(cooldown)}
                      type="button"
                    >
                      <RefreshCw
                        aria-hidden="true"
                        size={16}
                        strokeWidth={2.4}
                      />
                      {t("이어서 하기")}
                    </button>
                  </div>
                );
              })}
              <button
                className={styles.actionButton}
                disabled={
                  isUpdating ||
                  Boolean(hazardsCooldown && !hazardsCooldown.available)
                }
                onClick={updateHazards}
                title={actionUnavailableLabel(hazardsCooldown)}
                type="button"
              >
                <AlertTriangle aria-hidden="true" size={16} strokeWidth={2.4} />
                {t("지진/지진해일")}
                {hazardsCooldown && !hazardsCooldown.available ? (
                  <span className={styles.buttonMeta}>
                    {formatDuration(hazardsCooldown.remainingMs)}
                  </span>
                ) : null}
              </button>
            </div>
          </section>
        ) : null}

        {mode === "sudo" && activeTab === "settings" ? (
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <span className={styles.cardTitle}>
                <Clock3 aria-hidden="true" size={18} strokeWidth={2.4} />
                {t("NTP 시간 기준")}
              </span>
            </div>
            <div className={styles.settingsGrid}>
              <label className={styles.fieldLabel}>
                {t("서버 목록")}
                <textarea
                  className={styles.textarea}
                  onChange={(event) => setNtpServersDraft(event.target.value)}
                  spellCheck={false}
                  value={ntpServersDraft}
                />
              </label>
              <div className={styles.statusPanel}>
                <dl className={styles.compactDetails}>
                  <div>
                    <dt>{t("선택 서버")}</dt>
                    <dd>{timeStatus?.ntp.selected?.host ?? "-"}</dd>
                  </div>
                  <div>
                    <dt>{t("서버-NTP 오차")}</dt>
                    <dd>
                      {formatSignedSeconds(
                        timeStatus?.ntp.selected?.offsetMs ?? null,
                        dictionary.formatLocale,
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>{t("왕복 지연")}</dt>
                    <dd>
                      {timeStatus?.ntp.selected?.roundTripDelayMs === null ||
                      timeStatus?.ntp.selected?.roundTripDelayMs === undefined
                        ? "-"
                        : `${Math.round(
                            timeStatus.ntp.selected.roundTripDelayMs,
                          )}ms`}
                    </dd>
                  </div>
                  <div>
                    <dt>{t("경고 기준")}</dt>
                    <dd>
                      {formatSignedSeconds(
                        timeStatus?.thresholdMs ?? 3000,
                        dictionary.formatLocale,
                      )}
                    </dd>
                  </div>
                </dl>
                <button
                  className={styles.actionButton}
                  disabled={savingNtpServers}
                  onClick={saveNtpServers}
                  type="button"
                >
                  <Save aria-hidden="true" size={16} strokeWidth={2.4} />
                  {t("저장")}
                </button>
              </div>
            </div>
          </section>
        ) : null}

        {activeTab === "status" ? (
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <span className={styles.cardTitle}>{t("데이터셋 상태")}</span>
            </div>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>{t("데이터셋")}</th>
                    <th>{t("기록")}</th>
                    <th>{t("좌표")}</th>
                    <th>{t("실패")}</th>
                    <th>{t("진행")}</th>
                    <th>{t("가져온 시각")}</th>
                    {mode === "sudo" ? <th>{t("오류")}</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {datasets.map((dataset) => (
                    <tr key={dataset.id}>
                      <td>{dataset.label}</td>
                      <td>
                        {dataset.recordCount.toLocaleString(
                          dictionary.formatLocale,
                        )}
                      </td>
                      <td>
                        {dataset.geocodedCount.toLocaleString(
                          dictionary.formatLocale,
                        )}
                      </td>
                      <td>
                        {dataset.failedCount.toLocaleString(
                          dictionary.formatLocale,
                        )}
                      </td>
                      <td>
                        {formatImportProgress(
                          dataset.importProgress,
                          dictionary,
                        )}
                      </td>
                      <td>
                        {formatDateTime(
                          dataset.fetchedAt,
                          dictionary.formatLocale,
                        )}
                      </td>
                      {mode === "sudo" ? <td>{dataset.error ?? "-"}</td> : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {mode === "sudo" && activeTab === "logs" ? (
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <span className={styles.cardTitle}>{t("최근 로그")}</span>
              <Link className={styles.navLink} href="/logs">
                {t("전체 보기")}
              </Link>
            </div>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>{t("시각")}</th>
                    <th>{t("상태")}</th>
                    <th>{t("분류")}</th>
                    <th>{t("작업")}</th>
                    <th>{t("메시지")}</th>
                    {mode === "sudo" ? <th>{t("상세")}</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id}>
                      <td>
                        {formatDateTime(log.eventAt, dictionary.formatLocale)}
                      </td>
                      <td className={statusClassName(log.status)}>
                        {log.status}
                      </td>
                      <td>{log.category}</td>
                      <td>{log.action}</td>
                      <td>{log.message}</td>
                      {mode === "sudo" ? (
                        <td>
                          <pre className={styles.metadata}>
                            {JSON.stringify(log.metadata, null, 2)}
                          </pre>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}
      </main>
      {visibleProgress ? (
        <div className={styles.progressBackdrop} role="presentation">
          <section
            aria-labelledby={progressTitleId}
            aria-modal="true"
            className={styles.progressModal}
            role="dialog"
          >
            <div className={styles.progressHeader}>
              <h2 id={progressTitleId}>{visibleProgress.title}</h2>
              <span>
                {uiText(dictionary, "format.percent", {
                  value: visibleProgress.percent,
                })}
              </span>
            </div>
            <div
              aria-label={t("갱신 진행률")}
              aria-valuemax={100}
              aria-valuemin={0}
              aria-valuenow={visibleProgress.percent}
              className={styles.progressTrack}
              role="progressbar"
            >
              <span style={{ width: `${visibleProgress.percent}%` }} />
            </div>
            <p>{visibleProgress.currentStep}</p>
          </section>
        </div>
      ) : null}
    </div>
  );
}
