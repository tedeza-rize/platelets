"use client";

import { useEffect, useState } from "react";
import styles from "./time-skew-guard.module.css";

const TIME_SKEW_THRESHOLD_MS = 60_000;

function formatDateTime(value: string | number) {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(new Date(value));
}

export function TimeSkewGuard() {
  const [warning, setWarning] = useState<{
    clientTime: number;
    diffMs: number;
    serverTime: string;
  } | null>(null);

  useEffect(() => {
    let isDisposed = false;

    async function checkTimeSkew() {
      const startedAt = Date.now();
      const response = await fetch("/api/server-time", { cache: "no-store" });
      const receivedAt = Date.now();

      if (!response.ok) {
        return;
      }

      const payload = (await response.json()) as { serverTime: string };
      const serverTime = new Date(payload.serverTime).getTime();
      const estimatedClientTime = startedAt + (receivedAt - startedAt) / 2;
      const diffMs = estimatedClientTime - serverTime;

      if (!isDisposed && Math.abs(diffMs) >= TIME_SKEW_THRESHOLD_MS) {
        setWarning({
          clientTime: estimatedClientTime,
          diffMs,
          serverTime: payload.serverTime,
        });
      }
    }

    checkTimeSkew().catch(() => {});

    return () => {
      isDisposed = true;
    };
  }, []);

  if (!warning) {
    return null;
  }

  return (
    <div className={styles.backdrop} role="presentation">
      <section
        aria-labelledby="time-skew-title"
        aria-modal="true"
        className={styles.modal}
        role="dialog"
      >
        <div className={styles.header}>
          <h2 id="time-skew-title">시간 동기화 경고</h2>
          <button
            aria-label="시간 경고 닫기"
            className={styles.closeButton}
            onClick={() => setWarning(null)}
            type="button"
          >
            ×
          </button>
        </div>
        <p>
          서버 시간과 이 브라우저 시간이{" "}
          {Math.round(Math.abs(warning.diffMs) / 1000).toLocaleString("ko-KR")}
          초 차이납니다. 이벤트 발생 시각과 갱신 기록이 다르게 보일 수 있습니다.
        </p>
        <dl className={styles.details}>
          <div>
            <dt>서버</dt>
            <dd>{formatDateTime(warning.serverTime)}</dd>
          </div>
          <div>
            <dt>클라이언트</dt>
            <dd>{formatDateTime(warning.clientTime)}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
