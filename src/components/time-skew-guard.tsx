"use client";

import { useEffect, useState } from "react";
import styles from "./time-skew-guard.module.css";

const DISMISS_STORAGE_KEY = "platelets:hide-time-skew-warning";

type ServerTimePayload = {
  ntp?: {
    error: string | null;
    selected: {
      host: string;
      offsetMs: number | null;
      roundTripDelayMs: number | null;
    } | null;
  };
  serverReceivedAt?: string;
  serverRespondedAt?: string;
  serverTime: string;
  thresholdMs?: number;
};

type WarningState = {
  clientServerDiffMs: number;
  clientServerRoundTripMs: number;
  clientServerUncertaintyMs: number;
  clientTime: number;
  ntpError: string | null;
  ntpRoundTripDelayMs: number | null;
  ntpServer: string | null;
  serverNtpOffsetMs: number | null;
  serverProcessingMs: number;
  showDiagnostics: boolean;
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

function formatMilliseconds(value: number) {
  return Math.round(value).toLocaleString("ko-KR");
}

function getTimestamp(value: string | undefined, fallback: number) {
  const timestamp = value ? new Date(value).getTime() : Number.NaN;

  return Number.isFinite(timestamp) ? timestamp : fallback;
}

function isOutsideThreshold(
  offsetMs: number,
  thresholdMs: number,
  uncertaintyMs = 0,
) {
  return Math.max(0, Math.abs(offsetMs) - uncertaintyMs) >= thresholdMs;
}

function isDismissed() {
  try {
    return window.localStorage.getItem(DISMISS_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function saveDismissed() {
  try {
    window.localStorage.setItem(DISMISS_STORAGE_KEY, "1");
  } catch {}
}

export function TimeSkewGuard() {
  const [warning, setWarning] = useState<WarningState | null>(null);
  const [suppressFutureWarnings, setSuppressFutureWarnings] = useState(false);

  function closeWarning() {
    if (suppressFutureWarnings) {
      saveDismissed();
    }

    setWarning(null);
  }

  useEffect(() => {
    let isDisposed = false;

    async function checkTimeSkew() {
      if (isDismissed()) {
        return;
      }

      const startedAt = Date.now();
      const response = await fetch("/api/server-time", { cache: "no-store" });

      if (!response.ok) {
        return;
      }

      const payload = (await response.json()) as ServerTimePayload;
      const receivedAt = Date.now();
      const thresholdMs = payload.thresholdMs ?? 3000;
      const serverTime = new Date(payload.serverTime).getTime();
      const serverReceivedAt = getTimestamp(
        payload.serverReceivedAt,
        serverTime,
      );
      const serverRespondedAt = getTimestamp(
        payload.serverRespondedAt,
        serverTime,
      );
      const serverProcessingMs = Math.max(
        0,
        serverRespondedAt - serverReceivedAt,
      );
      const clientServerRoundTripMs = Math.max(0, receivedAt - startedAt);
      const clientServerNetworkDelayMs = Math.max(
        0,
        clientServerRoundTripMs - serverProcessingMs,
      );
      const clientServerUncertaintyMs = clientServerNetworkDelayMs / 2;
      const serverClientOffsetMs =
        (serverReceivedAt - startedAt + serverRespondedAt - receivedAt) / 2;
      const clientServerDiffMs = -serverClientOffsetMs;
      const serverNtpOffsetMs = payload.ntp?.selected?.offsetMs ?? null;
      const ntpRoundTripDelayMs =
        payload.ntp?.selected?.roundTripDelayMs ?? null;
      const showDiagnostics =
        window.location.pathname.startsWith("/admin") ||
        window.location.pathname.startsWith("/sudo");
      const clientServerShouldWarn = isOutsideThreshold(
        clientServerDiffMs,
        thresholdMs,
        clientServerUncertaintyMs,
      );
      const serverNtpShouldWarn =
        showDiagnostics &&
        serverNtpOffsetMs !== null &&
        isOutsideThreshold(
          serverNtpOffsetMs,
          thresholdMs,
          ntpRoundTripDelayMs === null ? 0 : ntpRoundTripDelayMs / 2,
        );
      const shouldWarn = clientServerShouldWarn || serverNtpShouldWarn;

      if (!isDisposed && shouldWarn) {
        setWarning({
          clientServerDiffMs,
          clientServerRoundTripMs,
          clientServerUncertaintyMs,
          clientTime: startedAt + clientServerRoundTripMs / 2,
          ntpError: payload.ntp?.error ?? null,
          ntpRoundTripDelayMs,
          ntpServer: payload.ntp?.selected?.host ?? null,
          serverNtpOffsetMs,
          serverProcessingMs,
          showDiagnostics,
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
            onClick={closeWarning}
            type="button"
          >
            x
          </button>
        </div>
        <p>
          {warning.showDiagnostics
            ? "클라이언트-서버 또는 서버-NTP 시간 오차가"
            : "클라이언트-서버 시간 오차가"}{" "}
          {formatSeconds(warning.thresholdMs)}초 기준을 넘었습니다. 요청/응답
          지연을 반영해 계산했으며, 이벤트 발생 시각과 갱신 기록이 다르게 보일
          수 있습니다.
        </p>
        <dl className={styles.details}>
          <div>
            <dt>클라이언트-서버</dt>
            <dd>
              {formatSeconds(warning.clientServerDiffMs)}초
              {warning.clientServerUncertaintyMs >= 1
                ? ` (지연 여유 ±${formatMilliseconds(
                    warning.clientServerUncertaintyMs,
                  )}ms)`
                : ""}
            </dd>
          </div>
          {warning.showDiagnostics ? (
            <>
              <div>
                <dt>서버</dt>
                <dd>{formatDateTime(warning.serverTime)}</dd>
              </div>
              <div>
                <dt>클라이언트</dt>
                <dd>{formatDateTime(warning.clientTime)}</dd>
              </div>
              <div>
                <dt>요청 왕복</dt>
                <dd>
                  {formatMilliseconds(warning.clientServerRoundTripMs)}ms
                  {warning.serverProcessingMs >= 1
                    ? `, 서버 처리 ${formatMilliseconds(
                        warning.serverProcessingMs,
                      )}ms`
                    : ""}
                </dd>
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
            </>
          ) : null}
        </dl>
        <div className={styles.footer}>
          <label className={styles.checkboxLabel}>
            <input
              checked={suppressFutureWarnings}
              onChange={(event) =>
                setSuppressFutureWarnings(event.currentTarget.checked)
              }
              type="checkbox"
            />
            다시 보지 않기
          </label>
          <button
            className={styles.actionButton}
            onClick={closeWarning}
            type="button"
          >
            확인
          </button>
        </div>
      </section>
    </div>
  );
}
