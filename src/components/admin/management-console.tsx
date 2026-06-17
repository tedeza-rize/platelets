import {
  AlertTriangle,
  BookOpen,
  Building2,
  ClipboardList,
  Database,
  Droplets,
  Flame,
  GraduationCap,
  HeartPulse,
  Shield,
  TerminalSquare,
} from "lucide-react";
import Link from "next/link";
import { DatabaseMigrationPanel } from "@/components/admin/database-migration-panel";
import { DatasetUpdateConsole } from "@/components/admin/dataset-update-console";
import type { DatasetStatus } from "@/components/admin/dataset-update-helpers";
import { IntegrationSettingsPanel } from "@/components/admin/integration-settings-panel";
import { SudoLoginForm } from "@/components/auth/sudo-login-form";
import { NtpSettingsForm } from "@/components/settings/ntp-settings-form";
import { OperationalSettingsForm } from "@/components/settings/operational-settings-form";
import { UpdateSchedulesForm } from "@/components/settings/update-schedules-form";
import { listApiLogPage } from "@/lib/api-log-repository";
import { getDatabaseConfig } from "@/lib/database/config";
import { getDatasetScheduleSettings } from "@/lib/dataset-scheduler";
import type { DatasetSourceId } from "@/lib/dataset-sources";
import { type AppDictionary, uiText } from "@/lib/i18n";
import { getOperationalSettings } from "@/lib/operational-settings";
import {
  getAdminUpdateCooldowns,
  getKakaoLocalUsage,
  getKmaEarthquakeUsage,
  listDatasetStatuses,
} from "@/lib/points-db";
import { getServerTimeStatus } from "@/lib/time-sync";
import styles from "./management-console.module.scss";
import {
  type ApiLogEntry,
  DatasetStatusPanel,
  formatDateTime,
  LogsPanel,
} from "./management-panels";

type ManagementConsoleProps = {
  dictionary: AppDictionary;
  mode: "admin" | "sudo";
  hasSudoSession: boolean;
  tab?: string;
};

type ManagementTab =
  | "integrations"
  | "logs"
  | "overview"
  | "settings"
  | "status"
  | "updates";

function _formatSignedSeconds(value: number | null, locale: string) {
  if (value === null) {
    return "-";
  }

  const sign = value > 0 ? "+" : "";

  return `${sign}${(value / 1000).toLocaleString(locale, {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  })}s`;
}

function _datasetIcon(source: DatasetSourceId) {
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

export async function ManagementConsole({
  dictionary,
  mode,
  hasSudoSession,
  tab = "overview",
}: ManagementConsoleProps) {
  const t = (key: string, values?: Record<string, string | number>) =>
    uiText(dictionary, key, values);

  const activeTab = tab as ManagementTab;
  const datasets = (await listDatasetStatuses()) as DatasetStatus[];

  const managementTabs = [
    { id: "overview", label: t("adminTabs.overview") },
    mode === "sudo" && hasSudoSession
      ? { id: "integrations", label: t("adminTabs.integrations") }
      : null,
    mode === "sudo" && hasSudoSession
      ? { id: "settings", label: t("adminTabs.settings") }
      : null,
    mode === "sudo" && hasSudoSession
      ? { id: "updates", label: t("adminTabs.updates") }
      : null,
    { id: "status", label: t("adminTabs.status") },
    mode === "sudo" && hasSudoSession
      ? { id: "logs", label: t("adminTabs.logs") }
      : null,
  ].filter((tabItem): tabItem is { id: ManagementTab; label: string } =>
    Boolean(tabItem),
  );

  const validTab = managementTabs.some((tabItem) => tabItem.id === activeTab)
    ? activeTab
    : (managementTabs[0]?.id ?? "overview");

  let quota: Awaited<ReturnType<typeof getKakaoLocalUsage>> | null = null;
  let kmaQuota: Awaited<ReturnType<typeof getKmaEarthquakeUsage>> | null = null;
  let logs: ApiLogEntry[] = [];
  let timeStatus: Awaited<ReturnType<typeof getServerTimeStatus>> | null = null;
  let schedules: Awaited<ReturnType<typeof getDatasetScheduleSettings>> | null =
    null;
  let operationalSettings: Awaited<
    ReturnType<typeof getOperationalSettings>
  > | null = null;
  let cooldowns: Awaited<ReturnType<typeof getAdminUpdateCooldowns>> | null =
    null;

  if (mode === "sudo" && hasSudoSession) {
    if (validTab === "overview") {
      quota = await getKakaoLocalUsage();
      kmaQuota = await getKmaEarthquakeUsage();
      const logsData = await listApiLogPage({ limit: 12 });
      logs = logsData.logs as ApiLogEntry[];
    } else if (validTab === "settings") {
      operationalSettings = await getOperationalSettings();
      timeStatus = await getServerTimeStatus({ serverReceivedAt: new Date() });
    } else if (validTab === "updates") {
      schedules = await getDatasetScheduleSettings();
      cooldowns = await getAdminUpdateCooldowns(
        datasets.map((dataset) => `dataset:${dataset.id}`).concat("hazards"),
      );
    } else if (validTab === "logs") {
      const logsData = await listApiLogPage({ limit: 12 });
      logs = logsData.logs as ApiLogEntry[];
    }
  }

  const ntpStatus = timeStatus;

  const quotaPercent =
    quota && quota.monthlyLimit > 0
      ? Math.round((quota.usedCount / quota.monthlyLimit) * 1000) / 10
      : 0;

  const kmaQuotaPercent =
    kmaQuota && kmaQuota.monthlyLimit > 0
      ? Math.round((kmaQuota.usedCount / kmaQuota.monthlyLimit) * 1000) / 10
      : 0;

  const title =
    mode === "sudo" ? t("개발자 총 권한 페이지") : t("관리자 페이지");
  const currentDatabaseEngine = getDatabaseConfig().engine;
  const noopEnsureSession = async () => {
    "use server";
  };

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
          {managementTabs.map((tabItem) => (
            <Link
              aria-selected={validTab === tabItem.id}
              className={styles.tabButton}
              key={tabItem.id}
              href={`/${mode}?tab=${tabItem.id}`}
              role="tab"
            >
              {tabItem.label}
            </Link>
          ))}
        </div>

        {validTab === "overview" && (
          <>
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

              {mode === "sudo" && hasSudoSession && (
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
                      {t("format.quota", {
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
                      {t("format.quota", {
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
              )}
            </section>

            {mode === "sudo" && !hasSudoSession && (
              <SudoLoginForm dictionary={dictionary} />
            )}
          </>
        )}

        {mode === "sudo" && hasSudoSession && validTab === "integrations" && (
          <IntegrationSettingsPanel
            dictionary={dictionary}
            ensureSudoSession={noopEnsureSession}
            isSudoActive={hasSudoSession}
          />
        )}

        {mode === "sudo" &&
          hasSudoSession &&
          validTab === "settings" &&
          operationalSettings && (
            <>
              {Boolean(currentDatabaseEngine) && (
                <DatabaseMigrationPanel
                  currentEngine={currentDatabaseEngine}
                  dictionary={dictionary}
                  ensureSudoSession={noopEnsureSession}
                />
              )}
              <OperationalSettingsForm
                dictionary={dictionary}
                initialSettings={operationalSettings}
                ensureSudoSession={noopEnsureSession}
              />
              {ntpStatus !== null && (
                <NtpSettingsForm
                  dictionary={dictionary}
                  initialTimeStatus={ntpStatus}
                  ensureSudoSession={noopEnsureSession}
                  onRefresh={async () => {
                    "use server";
                  }}
                />
              )}
            </>
          )}

        {mode === "sudo" &&
          hasSudoSession &&
          validTab === "updates" &&
          schedules &&
          cooldowns && (
            <>
              <UpdateSchedulesForm
                dictionary={dictionary}
                initialSchedules={schedules}
                datasets={datasets}
                ensureSudoSession={noopEnsureSession}
              />
              <DatasetUpdateConsole
                dictionary={dictionary}
                initialDatasets={datasets}
                initialCooldowns={cooldowns}
                ensureSudoSession={noopEnsureSession}
              />
            </>
          )}

        {validTab === "status" && (
          <DatasetStatusPanel
            dictionary={dictionary}
            datasets={datasets}
            mode={mode}
          />
        )}

        {mode === "sudo" && hasSudoSession && validTab === "logs" && (
          <LogsPanel dictionary={dictionary} logs={logs} mode={mode} />
        )}
      </main>
    </div>
  );
}
