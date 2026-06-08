"use client";

import {
  ClipboardList,
  Database,
  Flame,
  RefreshCw,
  Shield,
  TerminalSquare,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import styles from "./management-console.module.css";

type DatasetSourceId = "fire-stations" | "police-stations";

type DatasetStatus = {
  error: string | null;
  failedCount: number;
  fetchedAt: string | null;
  geocodedCount: number;
  id: DatasetSourceId;
  label: string;
  recordCount: number;
  skippedCount: number;
  updatedAt: string | null;
};

type ApiUsageWindow = {
  monthlyLimit: number;
  provider: "naver-geocoding";
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

type ManagementConsoleProps = {
  mode: "admin" | "sudo";
};

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
    timeStyle: "short",
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

export function ManagementConsole({ mode }: ManagementConsoleProps) {
  const [datasets, setDatasets] = useState<DatasetStatus[]>([]);
  const [quota, setQuota] = useState<ApiUsageWindow | null>(null);
  const [logs, setLogs] = useState<ApiLogEntry[]>([]);
  const [activeUpdate, setActiveUpdate] = useState<DatasetSourceId | "all">();
  const [notice, setNotice] = useState<string>("");

  const title = mode === "sudo" ? "개발자 총 권한 페이지" : "관리자 페이지";
  const quotaPercent = useMemo(() => {
    if (!quota || quota.monthlyLimit === 0) {
      return 0;
    }

    return Math.round((quota.usedCount / quota.monthlyLimit) * 1000) / 10;
  }, [quota]);

  const refresh = useCallback(async () => {
    const [datasetsResponse, quotaResponse, logsResponse] = await Promise.all([
      fetch("/api/datasets", { cache: "no-store" }),
      fetch("/api/geocoding/quota", { cache: "no-store" }),
      fetch("/api/logs?limit=12", { cache: "no-store" }),
    ]);

    if (!datasetsResponse.ok || !quotaResponse.ok || !logsResponse.ok) {
      throw new Error("관리 데이터를 불러오지 못했습니다.");
    }

    setDatasets((await datasetsResponse.json()).datasets);
    setQuota((await quotaResponse.json()).quota);
    setLogs((await logsResponse.json()).logs);
  }, []);

  async function updateDataset(source: DatasetSourceId | "all") {
    setActiveUpdate(source);
    setNotice("업데이트 중");

    try {
      const response = await fetch(
        source === "all" ? "/api/datasets" : `/api/datasets/${source}/update`,
        { method: "POST" },
      );

      if (!response.ok) {
        throw new Error("업데이트 실패");
      }

      await refresh();
      setNotice("업데이트 완료");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setActiveUpdate(undefined);
    }
  }

  useEffect(() => {
    refresh().catch((error) => {
      setNotice(error instanceof Error ? error.message : String(error));
    });
  }, [refresh]);

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
          <Link className={styles.navLink} href="/sudo">
            개발자
          </Link>
          <Link className={styles.navLink} href="/logs">
            로그
          </Link>
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

          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <span className={styles.cardTitle}>
                <TerminalSquare
                  aria-hidden="true"
                  size={18}
                  strokeWidth={2.4}
                />
                네이버 지오코딩
              </span>
            </div>
            <strong className={styles.metric}>
              {(quota?.usedCount ?? 0).toLocaleString("ko-KR")} /{" "}
              {(quota?.monthlyLimit ?? 300000).toLocaleString("ko-KR")}
            </strong>
            <span className={styles.muted}>
              {quotaPercent}% 사용, 만료{" "}
              {formatDateTime(quota?.windowEndsAt ?? null)}
            </span>
          </div>

          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <span className={styles.cardTitle}>
                <ClipboardList aria-hidden="true" size={18} strokeWidth={2.4} />
                최근 로그
              </span>
            </div>
            <strong className={styles.metric}>{logs.length}</strong>
            <span className={styles.muted}>최근 12건</span>
          </div>
        </section>

        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <span className={styles.cardTitle}>데이터 갱신</span>
          </div>
          <div className={styles.actions}>
            <button
              className={styles.actionButton}
              disabled={Boolean(activeUpdate)}
              onClick={() => updateDataset("all")}
              type="button"
            >
              <RefreshCw
                aria-hidden="true"
                className={activeUpdate === "all" ? styles.spinning : undefined}
                size={16}
                strokeWidth={2.4}
              />
              전체
            </button>
            <button
              className={styles.actionButton}
              disabled={Boolean(activeUpdate)}
              onClick={() => updateDataset("fire-stations")}
              type="button"
            >
              <Flame aria-hidden="true" size={16} strokeWidth={2.4} />
              소방
            </button>
            <button
              className={styles.actionButton}
              disabled={Boolean(activeUpdate)}
              onClick={() => updateDataset("police-stations")}
              type="button"
            >
              <Shield aria-hidden="true" size={16} strokeWidth={2.4} />
              경찰
            </button>
          </div>
          <output className={styles.notice}>{notice}</output>
        </section>

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
                    <td>{formatDateTime(dataset.fetchedAt)}</td>
                    {mode === "sudo" ? <td>{dataset.error ?? "-"}</td> : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

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
      </main>
    </div>
  );
}
