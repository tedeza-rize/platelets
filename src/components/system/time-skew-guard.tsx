"use client";

import { X } from "lucide-react";
import Image from "next/image";
import { useEffect, useId, useState } from "react";
import { type AppDictionary, uiText } from "@/lib/i18n";
import styles from "./time-skew-guard.module.scss";

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

function formatDateTime(value: string | number, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeZone: "Asia/Seoul",
    timeStyle: "medium",
  }).format(new Date(value));
}

function formatSeconds(value: number, locale: string) {
  return (Math.abs(value) / 1000).toLocaleString(locale, {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  });
}

function formatMilliseconds(value: number, locale: string) {
  return Math.round(value).toLocaleString(locale);
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
  } catch {
    // Storage can be unavailable in privacy modes; dismissal remains in memory.
  }
}

export function TimeSkewGuard({ dictionary }: { dictionary: AppDictionary }) {
  const titleId = useId();
  const t = (key: string) => uiText(dictionary, key);
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

    checkTimeSkew().catch(() => undefined);

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
        aria-labelledby={titleId}
        aria-modal="true"
        className={styles.modal}
        role="dialog"
      >
        <div className={styles.header}>
          <h2 id={titleId}>{t("timeSkew.title")}</h2>
          <button
            aria-label={t("시간 경고 닫기")}
            className={styles.closeButton}
            onClick={closeWarning}
            type="button"
          >
            <X aria-hidden="true" size={18} />
          </button>
        </div>
        <div className={styles.intro}>
          <Image
            alt={t("timeSkew.imageAlt")}
            height={132}
            sizes="132px"
            src="/error-illustrations/time-sync.png"
            unoptimized
            width={132}
          />
          <p>
            {uiText(
              dictionary,
              warning.showDiagnostics
                ? "timeSkew.summaryWithNtp"
                : "timeSkew.summary",
              {
                seconds: formatSeconds(
                  warning.thresholdMs,
                  dictionary.formatLocale,
                ),
              },
            )}
          </p>
        </div>
        <dl className={styles.details}>
          <div>
            <dt>{t("클라이언트-서버")}</dt>
            <dd>
              {formatSeconds(
                warning.clientServerDiffMs,
                dictionary.formatLocale,
              )}
              {t("초")}
              {warning.clientServerUncertaintyMs >= 1
                ? ` (${t("지연 여유")} ±${formatMilliseconds(
                    warning.clientServerUncertaintyMs,
                    dictionary.formatLocale,
                  )}ms)`
                : ""}
            </dd>
          </div>
          {warning.showDiagnostics ? (
            <>
              <div>
                <dt>{t("서버")}</dt>
                <dd>
                  {formatDateTime(warning.serverTime, dictionary.formatLocale)}
                </dd>
              </div>
              <div>
                <dt>{t("클라이언트")}</dt>
                <dd>
                  {formatDateTime(warning.clientTime, dictionary.formatLocale)}
                </dd>
              </div>
              <div>
                <dt>{t("요청 왕복")}</dt>
                <dd>
                  {uiText(dictionary, "format.milliseconds", {
                    value: formatMilliseconds(
                      warning.clientServerRoundTripMs,
                      dictionary.formatLocale,
                    ),
                  })}
                  {warning.serverProcessingMs >= 1
                    ? `, ${t("서버 처리")} ${formatMilliseconds(
                        warning.serverProcessingMs,
                        dictionary.formatLocale,
                      )}ms`
                    : ""}
                </dd>
              </div>
              <div>
                <dt>{t("서버-NTP")}</dt>
                <dd>
                  {warning.serverNtpOffsetMs === null
                    ? t("확인 불가")
                    : `${formatSeconds(
                        warning.serverNtpOffsetMs,
                        dictionary.formatLocale,
                      )}${t("초")}`}
                </dd>
              </div>
              <div>
                <dt>{t("NTP")}</dt>
                <dd>
                  {warning.ntpServer ?? warning.ntpError ?? t("응답 없음")}
                  {warning.ntpRoundTripDelayMs === null
                    ? ""
                    : `, RTT ${Math.round(warning.ntpRoundTripDelayMs)}ms`}
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
            {t("다시 보지 않기")}
          </label>
          <button
            className={styles.actionButton}
            onClick={closeWarning}
            type="button"
          >
            {t("확인")}
          </button>
        </div>
      </section>
    </div>
  );
}
