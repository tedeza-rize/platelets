"use client";

import { RefreshCw } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { DATASET_SOURCES } from "@/lib/dataset-sources";
import { type AppDictionary, uiText } from "@/lib/i18n";
import styles from "./management-console.module.css";

type ApiLogEntry = {
  action: string;
  category: string;
  eventAt: string;
  id: number;
  level: string;
  message: string;
  metadata: Record<string, unknown>;
  requestCount: number;
  source: string | null;
  status: "failure" | "skipped" | "success";
};

function formatDateTime(value: string, locale: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeZone: "Asia/Seoul",
    timeStyle: "medium",
  }).format(date);
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

export function LogConsole({ dictionary }: { dictionary: AppDictionary }) {
  const t = useCallback((key: string) => uiText(dictionary, key), [dictionary]);
  const [logs, setLogs] = useState<ApiLogEntry[]>([]);
  const [category, setCategory] = useState("");
  const [source, setSource] = useState("");
  const [notice, setNotice] = useState("");
  const [sudoPassword, setSudoPassword] = useState("");

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
  }, [sudoPassword, t]);

  const refresh = useCallback(async () => {
    await loginIfNeeded();

    const params = new URLSearchParams({ limit: "300" });

    if (category) {
      params.set("category", category);
    }

    if (source) {
      params.set("source", source);
    }

    const response = await fetch(`/api/logs?${params.toString()}`, {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(t("개발자 로그를 불러오지 못했습니다."));
    }

    setLogs((await response.json()).logs);
  }, [category, loginIfNeeded, source, t]);

  useEffect(() => {
    refresh().catch((error) => {
      setNotice(error instanceof Error ? error.message : String(error));
    });
  }, [refresh]);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>{t("로그")}</h1>
        <nav className={styles.navLinks} aria-label={t("관리 메뉴")}>
          <Link className={styles.navLink} href="/">
            {t("지도")}
          </Link>
          <Link className={styles.navLink} href="/admin">
            {t("관리자")}
          </Link>
          <Link className={styles.navLink} href="/sudo">
            {t("개발자")}
          </Link>
        </nav>
      </header>

      <main className={styles.content}>
        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <span className={styles.cardTitle}>{t("개발자 권한")}</span>
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
        </section>

        <section className={styles.card}>
          <div className={styles.actions}>
            <select
              className={styles.actionButton}
              onChange={(event) => setCategory(event.target.value)}
              value={category}
            >
              <option value="">{t("전체 분류")}</option>
              <option value="dataset">{t("log.category.dataset")}</option>
              <option value="geocoding">{t("log.category.geocoding")}</option>
              <option value="hazard">{t("log.category.hazard")}</option>
              <option value="system">{t("log.category.system")}</option>
              <option value="ui">{t("log.category.ui")}</option>
            </select>
            <select
              className={styles.actionButton}
              onChange={(event) => setSource(event.target.value)}
              value={source}
            >
              <option value="">{t("전체 데이터셋")}</option>
              {Object.values(DATASET_SOURCES).map((dataset) => (
                <option key={dataset.id} value={dataset.id}>
                  {dataset.label}
                </option>
              ))}
            </select>
            <button
              className={styles.actionButton}
              onClick={() =>
                refresh().catch((error) => {
                  setNotice(
                    error instanceof Error ? error.message : String(error),
                  );
                })
              }
              type="button"
            >
              <RefreshCw aria-hidden="true" size={16} strokeWidth={2.4} />
              {t("새로고침")}
            </button>
          </div>
          <output className={styles.notice}>{notice}</output>
        </section>

        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <span className={styles.cardTitle}>{t("상세 로그")}</span>
            <span className={styles.muted}>
              {logs.length.toLocaleString(dictionary.formatLocale)}
              {t("건")}
            </span>
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>{t("ID")}</th>
                  <th>{t("시각")}</th>
                  <th>{t("레벨")}</th>
                  <th>{t("상태")}</th>
                  <th>{t("분류")}</th>
                  <th>{t("데이터셋")}</th>
                  <th>{t("작업")}</th>
                  <th>{t("요청")}</th>
                  <th>{t("메시지")}</th>
                  <th>{t("상세")}</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td>{log.id}</td>
                    <td>
                      {formatDateTime(log.eventAt, dictionary.formatLocale)}
                    </td>
                    <td>{log.level}</td>
                    <td className={statusClassName(log.status)}>
                      {log.status}
                    </td>
                    <td>{log.category}</td>
                    <td>{log.source ?? "-"}</td>
                    <td>{log.action}</td>
                    <td>
                      {log.requestCount.toLocaleString(dictionary.formatLocale)}
                    </td>
                    <td>{log.message}</td>
                    <td>
                      <pre className={styles.metadata}>
                        {JSON.stringify(log.metadata, null, 2)}
                      </pre>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
