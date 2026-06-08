"use client";

import { useEffect, useState } from "react";
import styles from "./time-skew-guard.module.css";

type ServerTimePayload = {
  ntp?: {
    error: string | null;
    selected: {
      host: string;
      offsetMs: number | null;
      roundTripDelayMs: number | null;
    } | null;
  };
  serverTime: string;
  thresholdMs?: number;
};

type WarningState = {
  clientServerDiffMs: number;
  clientTime: number;
  ntpError: string | null;
  ntpRoundTripDelayMs: number | null;
  ntpServer: string | null;
  serverNtpOffsetMs: number | null;
  serverTime: string;
  thresholdMs: number;
};

function formatDateTime(value: string | number) {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(new Date(value));
}

function formatSeconds(value: number) {
  return (Math.abs(value) / 1000).toLocaleString("ko-KR", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  });
}

export function TimeSkewGuard() {
  const [warning, setWarning] = useState<WarningState | null>(null);

  useEffect(() => {
    let isDisposed = false;

    async function checkTimeSkew() {
      const startedAt = Date.now();
      const response = await fetch("/api/server-time", { cache: "no-store" });
      const receivedAt = Date.now();

      if (!response.ok) {
        return;
      }

      const payload = (await response.json()) as ServerTimePayload;
      const thresholdMs = payload.thresholdMs ?? 3000;
      const serverTime = new Date(payload.serverTime).getTime();
      const estimatedClientTime = startedAt + (receivedAt - startedAt) / 2;
      const clientServerDiffMs = estimatedClientTime - serverTime;
      const serverNtpOffsetMs = payload.ntp?.selected?.offsetMs ?? null;
      const shouldWarn =
        Math.abs(clientServerDiffMs) >= thresholdMs ||
        (serverNtpOffsetMs !== null &&
          Math.abs(serverNtpOffsetMs) >= thresholdMs);

      if (!isDisposed && shouldWarn) {
        setWarning({
          clientServerDiffMs,
          clientTime: estimatedClientTime,
          ntpError: payload.ntp?.error ?? null,
          ntpRoundTripDelayMs: payload.ntp?.selected?.roundTripDelayMs ?? null,
          ntpServer: payload.ntp?.selected?.host ?? null,
          serverNtpOffsetMs,
          serverTime: payload.serverTime,
          thresholdMs,
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
            x
          </button>
        </div>
        <p>
          클라이언트-서버 또는 서버-NTP 시간 오차가{" "}
          {formatSeconds(warning.thresholdMs)}초 기준을 넘었습니다. 이벤트 발생
          시각과 갱신 기록이 다르게 보일 수 있습니다.
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
          <div>
            <dt>클라이언트-서버</dt>
            <dd>{formatSeconds(warning.clientServerDiffMs)}초</dd>
          </div>
          <div>
            <dt>서버-NTP</dt>
            <dd>
              {warning.serverNtpOffsetMs === null
                ? "확인 불가"
                : `${formatSeconds(warning.serverNtpOffsetMs)}초`}
            </dd>
          </div>
          <div>
            <dt>NTP</dt>
            <dd>
              {warning.ntpServer ?? warning.ntpError ?? "응답 없음"}
              {warning.ntpRoundTripDelayMs !== null
                ? `, RTT ${Math.round(warning.ntpRoundTripDelayMs)}ms`
                : ""}
            </dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
