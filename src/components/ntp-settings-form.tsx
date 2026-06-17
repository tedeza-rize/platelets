"use client";

import { Clock3, Save } from "lucide-react";
import { useCallback, useState } from "react";
import { type AppDictionary, uiText } from "@/lib/i18n";
import styles from "./management-console.module.css";

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

function formatSignedSeconds(value: number | null, locale: string) {
  if (value === null) {
    return "-";
  }

  const sign = value > 0 ? "+" : "";

  return `${sign}${(value / 1000).toLocaleString(locale, {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  })}s`;
}

export function NtpSettingsForm({
  dictionary,
  initialTimeStatus,
  ensureSudoSession,
  onRefresh,
}: {
  dictionary: AppDictionary;
  initialTimeStatus: TimeStatus;
  ensureSudoSession: () => Promise<void>;
  onRefresh: () => Promise<void>;
}) {
  const t = useCallback((key: string) => uiText(dictionary, key), [dictionary]);
  const [timeStatus, _setTimeStatus] = useState<TimeStatus>(initialTimeStatus);
  const [ntpServersDraft, setNtpServersDraft] = useState(
    initialTimeStatus.ntpServers.join("\n"),
  );
  const [savingNtpServers, setSavingNtpServers] = useState(false);
  const [notice, setNotice] = useState("");

  async function saveNtpServers() {
    setSavingNtpServers(true);
    setNotice(t("NTP 서버 목록 저장 중"));

    try {
      await ensureSudoSession();
      const servers = ntpServersDraft
        .split(/\r?\n/)
        .map((server) => server.trim())
        .filter(Boolean);
      const response = await fetch("/api/ntp/servers", {
        body: JSON.stringify({ servers }),
        headers: { "Content-Type": "application/json" },
        method: "PUT",
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(payload?.error ?? t("NTP 서버 목록 저장 실패"));
      }

      await onRefresh();
      setNotice(t("NTP 서버 목록 저장 완료"));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setSavingNtpServers(false);
    }
  }

  return (
    <section className={styles.card}>
      <div className={styles.cardHeader}>
        <span className={styles.cardTitle}>
          <Clock3 aria-hidden="true" size={18} strokeWidth={2.4} />
          {t("NTP 시간 기준")}
        </span>
      </div>
      <div className={styles.settingsGrid}>
        <label className={styles.fieldLabel}>
          {t("서버 목록")}
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
              <dt>{t("선택 서버")}</dt>
              <dd>{timeStatus.ntp.selected?.host ?? "-"}</dd>
            </div>
            <div>
              <dt>{t("서버-NTP 오차")}</dt>
              <dd>
                {formatSignedSeconds(
                  timeStatus.ntp.selected?.offsetMs ?? null,
                  dictionary.formatLocale,
                )}
              </dd>
            </div>
            <div>
              <dt>{t("왕복 지연")}</dt>
              <dd>
                {timeStatus.ntp.selected?.roundTripDelayMs === null ||
                timeStatus.ntp.selected?.roundTripDelayMs === undefined
                  ? "-"
                  : `${Math.round(timeStatus.ntp.selected.roundTripDelayMs)}ms`}
              </dd>
            </div>
            <div>
              <dt>{t("경고 기준")}</dt>
              <dd>
                {formatSignedSeconds(
                  timeStatus.thresholdMs,
                  dictionary.formatLocale,
                )}
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
            {t("저장")}
          </button>
        </div>
      </div>
      {notice ? <output className={styles.notice}>{notice}</output> : null}
    </section>
  );
}
