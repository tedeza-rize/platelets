"use client";

import { RefreshCw } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
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

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
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

export function LogConsole() {
  const [logs, setLogs] = useState<ApiLogEntry[]>([]);
  const [category, setCategory] = useState("");
  const [source, setSource] = useState("");
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async () => {
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
      throw new Error("로그를 불러오지 못했습니다.");
    }

    setLogs((await response.json()).logs);
  }, [category, source]);

  useEffect(() => {
    refresh().catch((error) => {
      setNotice(error instanceof Error ? error.message : String(error));
    });
  }, [refresh]);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>로그</h1>
        <nav className={styles.navLinks} aria-label="관리 메뉴">
          <Link className={styles.navLink} href="/">
            지도
          </Link>
          <Link className={styles.navLink} href="/admin">
            관리자
          </Link>
          <Link className={styles.navLink} href="/sudo">
            개발자
          </Link>
        </nav>
      </header>

      <main className={styles.content}>
        <section className={styles.card}>
          <div className={styles.actions}>
            <select
              className={styles.actionButton}
              onChange={(event) => setCategory(event.target.value)}
              value={category}
            >
              <option value="">전체 분류</option>
              <option value="dataset">dataset</option>
              <option value="geocoding">geocoding</option>
              <option value="system">system</option>
              <option value="ui">ui</option>
            </select>
            <select
              className={styles.actionButton}
              onChange={(event) => setSource(event.target.value)}
              value={source}
            >
              <option value="">전체 데이터셋</option>
              <option value="fire-stations">소방</option>
              <option value="police-stations">경찰</option>
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
              새로고침
            </button>
          </div>
          <output className={styles.notice}>{notice}</output>
        </section>

        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <span className={styles.cardTitle}>상세 로그</span>
            <span className={styles.muted}>
              {logs.length.toLocaleString("ko-KR")}건
            </span>
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>시각</th>
                  <th>레벨</th>
                  <th>상태</th>
                  <th>분류</th>
                  <th>데이터셋</th>
                  <th>작업</th>
                  <th>요청</th>
                  <th>메시지</th>
                  <th>상세</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td>{log.id}</td>
                    <td>{formatDateTime(log.eventAt)}</td>
                    <td>{log.level}</td>
                    <td className={statusClassName(log.status)}>
                      {log.status}
                    </td>
                    <td>{log.category}</td>
                    <td>{log.source ?? "-"}</td>
                    <td>{log.action}</td>
                    <td>{log.requestCount.toLocaleString("ko-KR")}</td>
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
