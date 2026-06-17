"use client";

import { Save } from "lucide-react";
import { useCallback, useState } from "react";
import styles from "@/components/admin/management-console.module.scss";
import { type AppDictionary, uiText } from "@/lib/i18n";
import type { OperationalSettings } from "@/lib/operational-settings";

export function OperationalSettingsForm({
  dictionary,
  initialSettings,
  ensureSudoSession,
}: {
  dictionary: AppDictionary;
  initialSettings: OperationalSettings;
  ensureSudoSession: () => Promise<void>;
}) {
  const t = useCallback((key: string) => uiText(dictionary, key), [dictionary]);
  const [operationalSettings, setOperationalSettings] =
    useState<OperationalSettings>(initialSettings);
  const [savingOperationalSettings, setSavingOperationalSettings] =
    useState(false);
  const [notice, setNotice] = useState("");

  async function saveOperationalSettingsForm() {
    setSavingOperationalSettings(true);
    setNotice("");

    try {
      await ensureSudoSession();
      const response = await fetch("/api/admin/operational-settings", {
        body: JSON.stringify({ settings: operationalSettings }),
        headers: { "Content-Type": "application/json" },
        method: "PUT",
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        settings?: OperationalSettings;
      } | null;

      if (!(response.ok && payload?.settings)) {
        throw new Error(payload?.error ?? t("운영 설정 저장 실패"));
      }

      setOperationalSettings(payload.settings);
      setNotice(t("운영 설정을 저장했습니다."));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setSavingOperationalSettings(false);
    }
  }

  return (
    <section className={styles.card}>
      <div className={styles.cardHeader}>
        <span className={styles.cardTitle}>{t("운영 설정")}</span>
        <button
          className={styles.actionButton}
          disabled={savingOperationalSettings}
          onClick={saveOperationalSettingsForm}
          type="button"
        >
          <Save aria-hidden="true" size={16} strokeWidth={2.4} />
          {t("저장")}
        </button>
      </div>
      <div className={styles.settingsGrid}>
        <label className={styles.fieldLabel}>
          <input
            checked={operationalSettings.aiAllowPrivateBaseUrl}
            onChange={(event) =>
              setOperationalSettings((current) => ({
                ...current,
                aiAllowPrivateBaseUrl: event.target.checked,
              }))
            }
            type="checkbox"
          />
          {t("사설망 AI Base URL 허용")}
        </label>
        <label className={styles.fieldLabel}>
          <input
            checked={operationalSettings.datasetAutoUpdateEnabled}
            onChange={(event) =>
              setOperationalSettings((current) => ({
                ...current,
                datasetAutoUpdateEnabled: event.target.checked,
              }))
            }
            type="checkbox"
          />
          {t("데이터셋 자동 갱신")}
        </label>
        <label className={styles.fieldLabel}>
          {t("기본 지도 제공자")}
          <select
            className={styles.textInput}
            onChange={(event) =>
              setOperationalSettings((current) => ({
                ...current,
                mapProvider: event.target.value as "osm" | "vworld",
              }))
            }
            value={operationalSettings.mapProvider}
          >
            <option value="osm">{t("OSM")}</option>
            <option value="vworld">{t("브이월드")}</option>
          </select>
        </label>
        <label className={styles.fieldLabel}>
          {t("지도 타일 방식")}
          <select
            className={styles.textInput}
            onChange={(event) =>
              setOperationalSettings((current) => ({
                ...current,
                mapTileMode: event.target.value as "raster" | "vector",
              }))
            }
            value={operationalSettings.mapTileMode}
          >
            <option value="vector">{t("벡터")}</option>
            <option value="raster">{t("레스터")}</option>
          </select>
        </label>
        <label className={styles.fieldLabel}>
          {t("OSM 타일 소스")}
          <select
            className={styles.textInput}
            onChange={(event) =>
              setOperationalSettings((current) => ({
                ...current,
                osmTileSource: event.target.value as "official" | "openfreemap",
              }))
            }
            value={operationalSettings.osmTileSource}
          >
            <option value="openfreemap">{t("OpenFreeMap")}</option>
            <option value="official">{t("OSM 공식")}</option>
          </select>
        </label>
        <label className={styles.fieldLabel}>
          {t("지진 API 폴링 간격(ms)")}
          <input
            className={styles.textInput}
            min={60000}
            onChange={(event) =>
              setOperationalSettings((current) => ({
                ...current,
                kmaEarthquakePollIntervalMs: Number(event.target.value),
              }))
            }
            type="number"
            value={operationalSettings.kmaEarthquakePollIntervalMs}
          />
        </label>
        <label className={styles.fieldLabel}>
          {t("Overpass API URL")}
          <input
            className={styles.textInput}
            onChange={(event) =>
              setOperationalSettings((current) => ({
                ...current,
                overpassApiUrl: event.target.value,
              }))
            }
            value={operationalSettings.overpassApiUrl}
          />
        </label>
      </div>
      {notice ? <output className={styles.notice}>{notice}</output> : null}
    </section>
  );
}
