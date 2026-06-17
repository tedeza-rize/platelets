"use client";

import { Clock3, Save } from "lucide-react";
import { useCallback, useState } from "react";
import styles from "@/components/admin/management-console.module.scss";
import type { DatasetSourceId } from "@/lib/dataset-sources";
import { type AppDictionary, uiText } from "@/lib/i18n";

type DatasetScheduleSettings = Record<
  DatasetSourceId,
  { enabled: boolean; intervalDays: number }
>;

export function UpdateSchedulesForm({
  dictionary,
  initialSchedules,
  datasets,
  ensureSudoSession,
}: {
  dictionary: AppDictionary;
  initialSchedules: DatasetScheduleSettings;
  datasets: Array<{ id: DatasetSourceId; label: string }>;
  ensureSudoSession: () => Promise<void>;
}) {
  const t = useCallback((key: string) => uiText(dictionary, key), [dictionary]);
  const [schedules, setSchedules] =
    useState<DatasetScheduleSettings>(initialSchedules);
  const [savingSchedules, setSavingSchedules] = useState(false);
  const [notice, setNotice] = useState("");

  async function saveSchedules() {
    setSavingSchedules(true);
    setNotice("");

    try {
      await ensureSudoSession();
      const response = await fetch("/api/admin/dataset-schedules", {
        body: JSON.stringify({ schedules }),
        headers: { "Content-Type": "application/json" },
        method: "PUT",
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(payload?.error ?? t("갱신 주기 저장 실패"));
      }

      setSchedules((await response.json()).schedules);
      setNotice(t("데이터셋 갱신 주기를 저장했습니다."));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setSavingSchedules(false);
    }
  }

  return (
    <section className={styles.card}>
      <div className={styles.cardHeader}>
        <span className={styles.cardTitle}>
          <Clock3 aria-hidden="true" size={18} strokeWidth={2.4} />
          {t("자동 갱신 주기")}
        </span>
        <button
          className={styles.actionButton}
          disabled={savingSchedules}
          onClick={saveSchedules}
          type="button"
        >
          <Save aria-hidden="true" size={16} strokeWidth={2.4} />
          {t("주기 저장")}
        </button>
      </div>
      <div className={styles.scheduleGrid}>
        {datasets.map((dataset) => {
          const schedule = schedules[dataset.id];
          if (!schedule) return null;

          return (
            <div className={styles.scheduleRow} key={dataset.id}>
              <label className={styles.scheduleEnabled}>
                <input
                  checked={schedule.enabled}
                  onChange={(event) =>
                    setSchedules((current) => ({
                      ...current,
                      [dataset.id]: {
                        ...current[dataset.id],
                        enabled: event.target.checked,
                      },
                    }))
                  }
                  type="checkbox"
                />
                <span>{dataset.label}</span>
              </label>
              <label className={styles.scheduleInterval}>
                <input
                  className={`${styles.textInput}`}
                  max={365}
                  min={1}
                  onChange={(event) =>
                    setSchedules((current) => ({
                      ...current,
                      [dataset.id]: {
                        ...current[dataset.id],
                        intervalDays: Number(event.target.value),
                      },
                    }))
                  }
                  style={{ width: "72px" }}
                  type="number"
                  value={schedule.intervalDays}
                />
                <span>{t("일마다")}</span>
              </label>
            </div>
          );
        })}
      </div>
      {notice ? <output className={styles.notice}>{notice}</output> : null}
    </section>
  );
}
