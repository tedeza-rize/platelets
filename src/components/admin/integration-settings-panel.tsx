"use client";

import { KeyRound, LoaderCircle, RefreshCw, Save } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  API_KEY_FIELDS,
  type ApiKeyField,
  INTEGRATION_FIELDS,
  type IntegrationField,
  type SecretField,
  SecretInput,
} from "@/components/settings/secret-input";
import { type AppDictionary, uiText } from "@/lib/i18n";
import styles from "./management-console.module.scss";

export type IntegrationSettingsSection = "ai" | "data" | "map" | "notification";

type SettingsSummary = {
  apiKeys: {
    configured: Record<ApiKeyField, boolean>;
    raw?: Record<ApiKeyField, string>;
  };
  integrations: {
    fireSafetyApiKeyConfigured: boolean;
    incidentWebhookCount: number;
    itsOpenApiKeyConfigured: boolean;
    webPushConfigured: boolean;
    raw?: Record<IntegrationField, string>;
  };
};

function emptyDraft() {
  return Object.fromEntries(
    [...API_KEY_FIELDS, ...INTEGRATION_FIELDS].map((field) => [field, ""]),
  ) as Record<SecretField, string>;
}

function initDraft(summary: SettingsSummary | null) {
  if (!summary) return emptyDraft();
  return Object.fromEntries(
    [...API_KEY_FIELDS, ...INTEGRATION_FIELDS].map((field) => [
      field,
      (summary.apiKeys.raw?.[field as ApiKeyField] ??
        summary.integrations.raw?.[field as IntegrationField]) ||
        "",
    ]),
  ) as Record<SecretField, string>;
}

type SettingsGridProps = {
  panelTab: IntegrationSettingsSection;
  configured: (field: SecretField) => boolean;
  dictionary: AppDictionary;
  draft: Record<SecretField, string>;
  setDraft: React.Dispatch<React.SetStateAction<Record<SecretField, string>>>;
};

function SettingsGrid({
  panelTab,
  configured,
  dictionary,
  draft,
  setDraft,
}: SettingsGridProps) {
  const setField = (field: SecretField, value: string) => {
    setDraft((current) => ({ ...current, [field]: value }));
  };

  if (panelTab === "map") {
    return (
      <>
        <SecretInput
          configured={configured("vworldApiKey")}
          dictionary={dictionary}
          field="vworldApiKey"
          onValue={(val) => setField("vworldApiKey", val)}
          value={draft.vworldApiKey}
        />
        <SecretInput
          configured={configured("kakaoRestApiKey")}
          dictionary={dictionary}
          field="kakaoRestApiKey"
          onValue={(val) => setField("kakaoRestApiKey", val)}
          value={draft.kakaoRestApiKey}
        />
        <SecretInput
          configured={configured("kakaoMobilityRestApiKey")}
          dictionary={dictionary}
          field="kakaoMobilityRestApiKey"
          onValue={(val) => setField("kakaoMobilityRestApiKey", val)}
          value={draft.kakaoMobilityRestApiKey}
        />
      </>
    );
  }

  if (panelTab === "data") {
    return (
      <>
        <SecretInput
          configured={configured("publicDataApiKey")}
          dictionary={dictionary}
          field="publicDataApiKey"
          onValue={(val) => setField("publicDataApiKey", val)}
          value={draft.publicDataApiKey}
        />
        <SecretInput
          configured={configured("seoulOpenApiKey")}
          dictionary={dictionary}
          field="seoulOpenApiKey"
          onValue={(val) => setField("seoulOpenApiKey", val)}
          value={draft.seoulOpenApiKey}
        />
        <SecretInput
          configured={configured("itsOpenApiKey")}
          dictionary={dictionary}
          field="itsOpenApiKey"
          onValue={(val) => setField("itsOpenApiKey", val)}
          value={draft.itsOpenApiKey}
        />
        <SecretInput
          configured={configured("fireSafetyApiKey")}
          dictionary={dictionary}
          field="fireSafetyApiKey"
          onValue={(val) => setField("fireSafetyApiKey", val)}
          value={draft.fireSafetyApiKey}
        />
      </>
    );
  }

  if (panelTab === "ai") {
    return (
      <SecretInput
        configured={configured("openaiApiKey")}
        dictionary={dictionary}
        field="openaiApiKey"
        onValue={(val) => setField("openaiApiKey", val)}
        value={draft.openaiApiKey}
      />
    );
  }

  if (panelTab === "notification") {
    return (
      <>
        <SecretInput
          configured={configured("incidentWebhookUrls")}
          dictionary={dictionary}
          field="incidentWebhookUrls"
          multiline={true}
          onValue={(val) => setField("incidentWebhookUrls", val)}
          value={draft.incidentWebhookUrls}
        />
        <SecretInput
          configured={configured("webPushPublicKey")}
          dictionary={dictionary}
          field="webPushPublicKey"
          onValue={(val) => setField("webPushPublicKey", val)}
          value={draft.webPushPublicKey}
        />
        <SecretInput
          configured={configured("webPushPrivateKey")}
          dictionary={dictionary}
          field="webPushPrivateKey"
          onValue={(val) => setField("webPushPrivateKey", val)}
          value={draft.webPushPrivateKey}
        />
        <SecretInput
          configured={configured("webPushContact")}
          dictionary={dictionary}
          field="webPushContact"
          onValue={(val) => setField("webPushContact", val)}
          value={draft.webPushContact}
        />
      </>
    );
  }

  return null;
}

export function IntegrationSettingsPanel({
  dictionary,
  ensureSudoSession,
  isSudoActive,
  section,
}: {
  dictionary: AppDictionary;
  ensureSudoSession: () => Promise<void>;
  isSudoActive?: boolean;
  section: IntegrationSettingsSection;
}) {
  const t = useCallback((key: string) => uiText(dictionary, key), [dictionary]);
  const [summary, setSummary] = useState<SettingsSummary | null>(null);
  const [draft, setDraft] = useState(emptyDraft);
  const [busy, setBusy] = useState<"load" | "save" | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const configured = useCallback(
    (field: SecretField) => {
      if (!summary) return false;
      if (field === "itsOpenApiKey") {
        return summary.integrations.itsOpenApiKeyConfigured;
      }
      if (field === "fireSafetyApiKey") {
        return summary.integrations.fireSafetyApiKeyConfigured;
      }
      if (field === "incidentWebhookUrls") {
        return summary.integrations.incidentWebhookCount > 0;
      }
      if (field.startsWith("webPush")) {
        return summary.integrations.webPushConfigured;
      }
      return summary.apiKeys.configured[field as ApiKeyField];
    },
    [summary],
  );

  const loadSettings = useCallback(async () => {
    setBusy("load");
    setNotice("");
    setError("");

    try {
      await ensureSudoSession();
      const response = await fetch("/api/admin/integrations", {
        cache: "no-store",
        method: "GET",
      });
      const payload = (await response
        .json()
        .catch(() => null)) as SettingsSummary | null;

      if (!(response.ok && payload?.apiKeys && payload.integrations)) {
        throw new Error(t("integrationSettings.loadFailed"));
      }

      setSummary(payload);
      setDraft(initDraft(payload));
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : t("integrationSettings.loadFailed"),
      );
    } finally {
      setBusy(null);
    }
  }, [ensureSudoSession, t]);

  const saveSettings = useCallback(async () => {
    setBusy("save");
    setNotice("");
    setError("");

    const keysToClear = API_KEY_FIELDS.filter(
      (field) => configured(field) && !draft[field].trim(),
    );
    const integrationsToClear = INTEGRATION_FIELDS.filter(
      (field) => configured(field) && !draft[field].trim(),
    );

    const apiKeysToSend = Object.fromEntries(
      API_KEY_FIELDS.map((field) => [field, draft[field]]),
    );
    const integrationsToSend = Object.fromEntries(
      INTEGRATION_FIELDS.map((field) => [field, draft[field]]),
    );

    try {
      await ensureSudoSession();
      const response = await fetch("/api/admin/integrations", {
        body: JSON.stringify({
          apiKeys: apiKeysToSend,
          clearApiKeys: keysToClear,
          integrations: {
            ...integrationsToSend,
            clear: integrationsToClear,
          },
        }),
        headers: { "Content-Type": "application/json" },
        method: "PUT",
      });
      const payload = (await response.json().catch(() => null)) as
        | (SettingsSummary & { errorKey?: string })
        | null;

      if (!(response.ok && payload?.apiKeys && payload.integrations)) {
        throw new Error(
          payload?.errorKey
            ? t(payload.errorKey)
            : t("integrationSettings.saveFailed"),
        );
      }

      setSummary(payload);
      setDraft(initDraft(payload));
      setNotice(t("integrationSettings.saved"));
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : t("integrationSettings.saveFailed"),
      );
    } finally {
      setBusy(null);
    }
  }, [ensureSudoSession, draft, configured, t]);

  useEffect(() => {
    if (isSudoActive) {
      void loadSettings();
    }
  }, [isSudoActive, loadSettings]);

  const panelTabs = [
    { id: "map", label: t("integrationSettings.section.map") },
    { id: "data", label: t("integrationSettings.section.data") },
    { id: "ai", label: t("AI 설정") },
    {
      id: "notification",
      label: t("integrationSettings.section.notification"),
    },
  ] as const;

  return (
    <section className={styles.card}>
      <div className={styles.cardHeader}>
        <span className={styles.cardTitle}>
          <KeyRound aria-hidden="true" size={18} strokeWidth={2.4} />
          {t("integrationSettings.title")}
        </span>
        {Boolean(isSudoActive) && summary && (
          <button
            className={styles.actionButton}
            disabled={Boolean(busy)}
            onClick={() => void loadSettings()}
            type="button"
          >
            {busy === "load" ? (
              <LoaderCircle className={styles.spinning} size={16} />
            ) : (
              <RefreshCw aria-hidden="true" size={16} />
            )}
            {t("새로고침")}
          </button>
        )}
      </div>
      <p className={styles.muted}>{t("integrationSettings.description")}</p>

      {summary ? (
        <>
          <div className={styles.tabList} role="tablist">
            {panelTabs.map((tab) => (
              <Link
                aria-selected={section === tab.id}
                className={styles.tabButton}
                href={`/sudo?tab=integrations&section=${tab.id}`}
                key={tab.id}
                role="tab"
              >
                {tab.label}
              </Link>
            ))}
          </div>

          <div className={styles.settingsGridSingle}>
            <SettingsGrid
              panelTab={section}
              configured={configured}
              dictionary={dictionary}
              draft={draft}
              setDraft={setDraft}
            />
          </div>

          <button
            className={styles.actionButton}
            disabled={Boolean(busy)}
            onClick={() => void saveSettings()}
            type="button"
            style={{ marginTop: "16px" }}
          >
            {busy === "save" ? (
              <LoaderCircle className={styles.spinning} size={16} />
            ) : (
              <Save aria-hidden="true" size={16} />
            )}
            {t("integrationSettings.save")}
          </button>
        </>
      ) : null}
      {notice ? <output className={styles.notice}>{notice}</output> : null}
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
