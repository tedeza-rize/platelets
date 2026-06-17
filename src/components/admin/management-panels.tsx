import Link from "next/link";
import type {
  DatasetImportProgress,
  DatasetStatus,
} from "@/components/admin/dataset-update-helpers";
import type { DatasetSourceId } from "@/lib/dataset-sources";
import { type AppDictionary, uiText } from "@/lib/i18n";
import styles from "./management-console.module.scss";

export type ApiLogEntry = {
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

export function formatDateTime(value: string | null, locale: string) {
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

export function statusClassName(status: ApiLogEntry["status"]) {
  if (status === "success") {
    return styles.statusSuccess;
  }

  if (status === "failure") {
    return styles.statusFailure;
  }

  return styles.statusSkipped;
}

export function formatImportProgress(
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

type DatasetStatusPanelProps = {
  dictionary: AppDictionary;
  datasets: DatasetStatus[];
  mode: "admin" | "sudo";
};

export function DatasetStatusPanel({
  dictionary,
  datasets,
  mode,
}: DatasetStatusPanelProps) {
  const t = (key: string) => uiText(dictionary, key);

  return (
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
                  {dataset.recordCount.toLocaleString(dictionary.formatLocale)}
                </td>
                <td>
                  {dataset.geocodedCount.toLocaleString(
                    dictionary.formatLocale,
                  )}
                </td>
                <td>
                  {dataset.failedCount.toLocaleString(dictionary.formatLocale)}
                </td>
                <td>
                  {formatImportProgress(dataset.importProgress, dictionary)}
                </td>
                <td>
                  {formatDateTime(dataset.fetchedAt, dictionary.formatLocale)}
                </td>
                {mode === "sudo" ? <td>{dataset.error ?? "-"}</td> : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

type LogsPanelProps = {
  dictionary: AppDictionary;
  logs: ApiLogEntry[];
  mode: "admin" | "sudo";
};

export function LogsPanel({ dictionary, logs, mode }: LogsPanelProps) {
  const t = (key: string) => uiText(dictionary, key);

  return (
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
                <td>{formatDateTime(log.eventAt, dictionary.formatLocale)}</td>
                <td className={statusClassName(log.status)}>{log.status}</td>
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
  );
}
