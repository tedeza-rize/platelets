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
import { useCallback, useEffect, useMemo, useState } from "react";
import type { DatasetSourceId } from "@/lib/dataset-sources";
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
  mode: "admin" | "sudo";
};

type ProgressState = {
  currentStep: string;
  percent: number;
  title: string;
};

type DatasetScheduleSettings = Record<
  DatasetSourceId,
  { enabled: boolean; intervalDays: number }
>;

const SUDO_TOKEN_STORAGE_KEY = "platelets:sudo-token";
const ACCESS_TOKEN_HEADER = "x-platelets-admin-token";

function formatDateTime(value: string | null) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ko-KR", {
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

function formatSignedSeconds(value: number | null) {
  if (value === null) {
    return "-";
  }

  const sign = value > 0 ? "+" : "";

  return `${sign}${(value / 1000).toLocaleString("ko-KR", {
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

function formatImportProgress(progress: DatasetImportProgress | null) {
  if (!progress) {
    return "-";
  }

  const label = progress.status === "paused" ? "일시중단" : "진행 중";

  return `${label} ${progress.nextIndex.toLocaleString(
    "ko-KR",
  )}/${progress.totalCount.toLocaleString(
    "ko-KR",
  )}, 좌표 ${progress.geocodedCount.toLocaleString("ko-KR")}`;
}

export function ManagementConsole({ mode }: ManagementConsoleProps) {
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
  const [savingSchedules, setSavingSchedules] = useState(false);
  const [savingNtpServers, setSavingNtpServers] = useState(false);
  const [clockTick, setClockTick] = useState(0);
  const [sudoAccessToken, setSudoAccessToken] = useState("");
  const [sudoTokenLoaded, setSudoTokenLoaded] = useState(false);

  const title = mode === "sudo" ? "개발자 총 권한 페이지" : "관리자 페이지";
  const sudoHeaders = useMemo<Record<string, string>>(() => {
    const token = sudoAccessToken.trim();
    const headers: Record<string, string> = {};

    if (token) {
      headers[ACCESS_TOKEN_HEADER] = token;
    }

    return headers;
  }, [sudoAccessToken]);
  const hasSudoToken = mode === "sudo" && sudoAccessToken.trim().length > 0;
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
        currentStep: "업데이트 요청을 서버에 전달하고 있습니다.",
        percent: 1,
        title: activeUpdate === "all" ? "전체 데이터 갱신" : "데이터셋 갱신",
      };
    }

    return {
      currentStep: `${current.label}: ${updateProgress.message}`,
      percent: updateProgress.percent,
      title:
        activeUpdate === "all" ? "전체 데이터 갱신" : `${current.label} 갱신`,
    };
  }, [activeDatasetSource, activeUpdate, datasets]);
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

    return `다시 가능: ${formatDuration(cooldown.remainingMs)}`;
  }

  async function parseUpdateError(response: Response, fallback: string) {
    const payload = (await response.json().catch(() => null)) as {
      cooldown?: UpdateCooldown;
      error?: string;
    } | null;

    if (response.status === 429 && payload?.cooldown) {
      return `5분 갱신 간격 적용 중입니다. ${formatDuration(
        payload.cooldown.remainingMs,
      )} 뒤 다시 시도할 수 있습니다.`;
    }

    return payload?.error ?? fallback;
  }

  const refresh = useCallback(async () => {
    const [datasetsResponse, timeResponse, schedulesResponse] =
      await Promise.all([
        fetch("/api/datasets", { cache: "no-store" }),
        fetch("/api/server-time", { cache: "no-store" }),
        fetch("/api/admin/dataset-schedules", { cache: "no-store" }),
      ]);

    if (!datasetsResponse.ok || !timeResponse.ok || !schedulesResponse.ok) {
      throw new Error("관리 데이터를 불러오지 못했습니다.");
    }

    setDatasets((await datasetsResponse.json()).datasets);
    setSchedules((await schedulesResponse.json()).schedules);
    const nextTimeStatus = (await timeResponse.json()) as TimeStatus;
    setTimeStatus(nextTimeStatus);
    setNtpServersDraft(nextTimeStatus.ntpServers.join("\n"));

    if (mode !== "sudo" || !hasSudoToken) {
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
          headers: sudoHeaders,
        }),
        fetch("/api/hazards/quota", {
          cache: "no-store",
          headers: sudoHeaders,
        }),
        fetch(`/api/logs?limit=12&ts=${Date.now()}`, {
          cache: "no-store",
          headers: sudoHeaders,
        }),
        fetch("/api/admin/update-cooldowns", {
          cache: "no-store",
          headers: sudoHeaders,
        }),
      ]);

    if (
      !quotaResponse.ok ||
      !kmaQuotaResponse.ok ||
      !logsResponse.ok ||
      !cooldownsResponse.ok
    ) {
      throw new Error("개발자 권한 데이터를 불러오지 못했습니다.");
    }

    setQuota((await quotaResponse.json()).quota);
    setKmaQuota((await kmaQuotaResponse.json()).quota);
    setLogs((await logsResponse.json()).logs);
    setCooldowns((await cooldownsResponse.json()).cooldowns);
  }, [hasSudoToken, mode, sudoHeaders]);

  async function requestDatasetUpdate(
    source: DatasetSourceId,
    mode: "restart" | "resume",
  ) {
    const response = await fetch(`/api/datasets/${source}/update`, {
      body: JSON.stringify({ mode }),
      headers: { "Content-Type": "application/json", ...sudoHeaders },
      method: "POST",
    });

    if (!response.ok) {
      throw new Error(await parseUpdateError(response, "업데이트 실패"));
    }

    const payload = (await response.json().catch(() => null)) as {
      error?: string;
      paused?: boolean;
    } | null;

    return payload?.paused
      ? (payload.error ?? "업데이트가 일시중단되었습니다.")
      : null;
  }

  async function updateDataset(
    source: DatasetSourceId | "all",
    updateMode: "restart" | "resume" = "restart",
  ) {
    if (mode !== "sudo" || !hasSudoToken) {
      setNotice("개발자 토큰이 필요합니다.");
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
        `5분 갱신 간격 적용 중입니다. ${formatDuration(
          blockedCooldown.remainingMs,
        )} 뒤 다시 시도할 수 있습니다.`,
      );
      return;
    }

    setActiveUpdate(source);
    setNotice("업데이트 중");

    try {
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
      setNotice(pausedMessage ?? "업데이트 완료");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setActiveUpdate(undefined);
      setActiveDatasetSource(undefined);
    }
  }

  async function saveSchedules() {
    if (mode !== "sudo" || !hasSudoToken || !schedules) {
      setNotice("개발자 토큰이 필요합니다.");
      return;
    }

    setSavingSchedules(true);

    try {
      const response = await fetch("/api/admin/dataset-schedules", {
        body: JSON.stringify({ schedules }),
        headers: { "Content-Type": "application/json", ...sudoHeaders },
        method: "PUT",
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(payload?.error ?? "갱신 주기 저장 실패");
      }

      setSchedules((await response.json()).schedules);
      setNotice("데이터셋 갱신 주기를 저장했습니다.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setSavingSchedules(false);
    }
  }

  async function updateHazards() {
    if (mode !== "sudo" || !hasSudoToken) {
      setNotice("개발자 토큰이 필요합니다.");
      return;
    }

    const blockedCooldown = getCooldown("hazards");

    if (blockedCooldown && !blockedCooldown.available) {
      setNotice(
        `5분 갱신 간격 적용 중입니다. ${formatDuration(
          blockedCooldown.remainingMs,
        )} 뒤 다시 시도할 수 있습니다.`,
      );
      return;
    }

    setNotice("지진/지진해일 업데이트 중");
    setProgress({
      currentStep: "기상청 지진/지진해일 정보 요청 중",
      percent: 35,
      title: "재난 이벤트 갱신",
    });

    try {
      const response = await fetch("/api/hazards/update", {
        headers: sudoHeaders,
        method: "POST",
      });

      if (!response.ok) {
        throw new Error(
          await parseUpdateError(response, "지진/지진해일 업데이트 실패"),
        );
      }

      setProgress({
        currentStep: "갱신 결과 불러오는 중",
        percent: 90,
        title: "재난 이벤트 갱신",
      });
      await refresh();
      setNotice("지진/지진해일 업데이트 완료");
      setProgress({
        currentStep: "완료",
        percent: 100,
        title: "재난 이벤트 갱신",
      });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      window.setTimeout(() => setProgress(null), 500);
    }
  }

  async function saveNtpServers() {
    if (mode !== "sudo" || !hasSudoToken) {
      setNotice("개발자 토큰이 필요합니다.");
      return;
    }

    setSavingNtpServers(true);
    setNotice("NTP 서버 목록 저장 중");

    try {
      const servers = ntpServersDraft
        .split(/\r?\n/)
        .map((server) => server.trim())
        .filter(Boolean);
      const response = await fetch("/api/ntp/servers", {
        body: JSON.stringify({ servers }),
        headers: { "Content-Type": "application/json", ...sudoHeaders },
        method: "PUT",
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(payload?.error ?? "NTP 서버 목록 저장 실패");
      }

      await refresh();
      setNotice("NTP 서버 목록 저장 완료");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setSavingNtpServers(false);
    }
  }

  useEffect(() => {
    if (mode !== "sudo") {
      return;
    }

    setSudoAccessToken(
      window.sessionStorage.getItem(SUDO_TOKEN_STORAGE_KEY) ?? "",
    );
    setSudoTokenLoaded(true);
  }, [mode]);

  useEffect(() => {
    if (mode !== "sudo" || !sudoTokenLoaded) {
      return;
    }

    const token = sudoAccessToken.trim();

    if (token) {
      window.sessionStorage.setItem(SUDO_TOKEN_STORAGE_KEY, token);
    } else {
      window.sessionStorage.removeItem(SUDO_TOKEN_STORAGE_KEY);
    }
  }, [mode, sudoAccessToken, sudoTokenLoaded]);

  useEffect(() => {
    refresh().catch((error) => {
      setNotice(error instanceof Error ? error.message : String(error));
    });
  }, [refresh]);

  useEffect(() => {
    if (!activeUpdate && !progress) {
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

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>{title}</h1>
        <nav className={styles.navLinks} aria-label="관리 메뉴">
          <Link className={styles.navLink} href="/">
            지도
          </Link>
          <Link className={styles.navLink} href="/admin">
            관리자
          </Link>
          {mode === "sudo" ? (
            <>
              <Link className={styles.navLink} href="/sudo">
                개발자
              </Link>
              <Link className={styles.navLink} href="/logs">
                로그
              </Link>
            </>
          ) : null}
        </nav>
      </header>

      <main className={styles.content}>
        <section className={styles.summaryGrid}>
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <span className={styles.cardTitle}>
                <Database aria-hidden="true" size={18} strokeWidth={2.4} />
                데이터셋
              </span>
            </div>
            <strong className={styles.metric}>
              {datasets
                .reduce((total, dataset) => total + dataset.recordCount, 0)
                .toLocaleString("ko-KR")}
            </strong>
            <span className={styles.muted}>저장된 전체 기록</span>
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
                    카카오 로컬 API
                  </span>
                </div>
                <strong className={styles.metric}>
                  {(quota?.usedCount ?? 0).toLocaleString("ko-KR")} /{" "}
                  {(quota?.monthlyLimit ?? 100000).toLocaleString("ko-KR")}
                </strong>
                <span className={styles.muted}>
                  {quotaPercent}% 사용, 리셋{" "}
                  {formatDateTime(quota?.windowEndsAt ?? null)}
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
                    기상청 지진 API
                  </span>
                </div>
                <strong className={styles.metric}>
                  {(kmaQuota?.usedCount ?? 0).toLocaleString("ko-KR")} /{" "}
                  {(kmaQuota?.monthlyLimit ?? 5000).toLocaleString("ko-KR")}
                </strong>
                <span className={styles.muted}>
                  {kmaQuotaPercent}% 사용, 리셋{" "}
                  {formatDateTime(kmaQuota?.windowEndsAt ?? null)}
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
                    최근 로그
                  </span>
                </div>
                <strong className={styles.metric}>{logs.length}</strong>
                <span className={styles.muted}>최근 12건</span>
              </div>
            </>
          ) : null}
        </section>

        {mode === "sudo" ? (
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <span className={styles.cardTitle}>개발자 권한</span>
              <span className={styles.muted}>
                {hasSudoToken ? "토큰 적용됨" : "토큰 필요"}
              </span>
            </div>
            <label className={styles.fieldLabel}>
              접근 토큰
              <input
                autoComplete="current-password"
                className={styles.textInput}
                onChange={(event) => setSudoAccessToken(event.target.value)}
                type="password"
                value={sudoAccessToken}
              />
            </label>
          </section>
        ) : null}

        {mode === "sudo" && schedules ? (
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <span className={styles.cardTitle}>
                <Clock3 aria-hidden="true" size={18} strokeWidth={2.4} />
                자동 갱신 주기
              </span>
              <button
                className={styles.actionButton}
                disabled={savingSchedules}
                onClick={saveSchedules}
                type="button"
              >
                <Save aria-hidden="true" size={16} strokeWidth={2.4} />
                주기 저장
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
                      <span>일마다</span>
                    </label>
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}

        {mode === "sudo" ? (
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <span className={styles.cardTitle}>데이터 갱신</span>
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
                전체
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
                      처음부터 다시 하기
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
                      이어서 하기
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
                지진/지진해일
                {hazardsCooldown && !hazardsCooldown.available ? (
                  <span className={styles.buttonMeta}>
                    {formatDuration(hazardsCooldown.remainingMs)}
                  </span>
                ) : null}
              </button>
            </div>
            <output className={styles.notice}>{notice}</output>
          </section>
        ) : null}

        {mode === "sudo" ? (
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <span className={styles.cardTitle}>
                <Clock3 aria-hidden="true" size={18} strokeWidth={2.4} />
                NTP 시간 기준
              </span>
            </div>
            <div className={styles.settingsGrid}>
              <label className={styles.fieldLabel}>
                서버 목록
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
                    <dt>선택 서버</dt>
                    <dd>{timeStatus?.ntp.selected?.host ?? "-"}</dd>
                  </div>
                  <div>
                    <dt>서버-NTP 오차</dt>
                    <dd>
                      {formatSignedSeconds(
                        timeStatus?.ntp.selected?.offsetMs ?? null,
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>왕복 지연</dt>
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
                    <dt>경고 기준</dt>
                    <dd>
                      {formatSignedSeconds(timeStatus?.thresholdMs ?? 3000)}
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
                  저장
                </button>
              </div>
            </div>
          </section>
        ) : null}

        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <span className={styles.cardTitle}>데이터셋 상태</span>
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>데이터셋</th>
                  <th>기록</th>
                  <th>좌표</th>
                  <th>실패</th>
                  <th>진행</th>
                  <th>가져온 시각</th>
                  {mode === "sudo" ? <th>오류</th> : null}
                </tr>
              </thead>
              <tbody>
                {datasets.map((dataset) => (
                  <tr key={dataset.id}>
                    <td>{dataset.label}</td>
                    <td>{dataset.recordCount.toLocaleString("ko-KR")}</td>
                    <td>{dataset.geocodedCount.toLocaleString("ko-KR")}</td>
                    <td>{dataset.failedCount.toLocaleString("ko-KR")}</td>
                    <td>{formatImportProgress(dataset.importProgress)}</td>
                    <td>{formatDateTime(dataset.fetchedAt)}</td>
                    {mode === "sudo" ? <td>{dataset.error ?? "-"}</td> : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {mode === "sudo" ? (
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <span className={styles.cardTitle}>최근 로그</span>
              <Link className={styles.navLink} href="/logs">
                전체 보기
              </Link>
            </div>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>시각</th>
                    <th>상태</th>
                    <th>분류</th>
                    <th>작업</th>
                    <th>메시지</th>
                    {mode === "sudo" ? <th>상세</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id}>
                      <td>{formatDateTime(log.eventAt)}</td>
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
            aria-labelledby="progress-title"
            aria-modal="true"
            className={styles.progressModal}
            role="dialog"
          >
            <div className={styles.progressHeader}>
              <h2 id="progress-title">{visibleProgress.title}</h2>
              <span>{visibleProgress.percent}%</span>
            </div>
            <div
              aria-label="갱신 진행률"
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
