"use client";

import { KeyRound, LoaderCircle, RefreshCw, Save } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { type AppDictionary, uiText } from "@/lib/i18n";
import styles from "./management-console.module.css";

const API_KEY_FIELDS = [
  "vworldApiKey",
  "publicDataApiKey",
  "kakaoRestApiKey",
  "kakaoMobilityRestApiKey",
  "seoulOpenApiKey",
  "openaiApiKey",
] as const;
const INTEGRATION_FIELDS = [
  "itsOpenApiKey",
  "incidentWebhookUrls",
  "webPushPublicKey",
  "webPushPrivateKey",
  "webPushContact",
] as const;
type ApiKeyField = (typeof API_KEY_FIELDS)[number];
type IntegrationField = (typeof INTEGRATION_FIELDS)[number];
type SecretField = ApiKeyField | IntegrationField;

type SettingsSummary = {
  apiKeys: {
    configured: Record<ApiKeyField, boolean>;
  };
  integrations: {
    incidentWebhookCount: number;
    itsOpenApiKeyConfigured: boolean;
    webPushConfigured: boolean;
  };
};

function emptyDraft() {
  return Object.fromEntries(
    [...API_KEY_FIELDS, ...INTEGRATION_FIELDS].map((field) => [field, ""]),
  ) as Record<SecretField, string>;
}

function SecretInput({
  clear,
  configured,
  dictionary,
  field,
  multiline = false,
  onClear,
  onValue,
  value,
}: {
  clear: boolean;
  configured: boolean;
  dictionary: AppDictionary;
  field: SecretField;
  multiline?: boolean;
  onClear: (checked: boolean) => void;
  onValue: (value: string) => void;
  value: string;
}) {
  const t = (key: string) => uiText(dictionary, key);
  const inputId = `integration-${field}`;
  const inputProps = {
    autoComplete: "off",
    className: styles.textInput,
    disabled: clear,
    id: inputId,
    onChange: (
      event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    ) => onValue(event.target.value),
    placeholder: configured
      ? t("integrationSettings.configured")
      : t("integrationSettings.notConfigured"),
    value,
  };

  return (
    <div className={styles.secretField}>
      <label className={styles.fieldLabel} htmlFor={inputId}>
        {t(`integrationSettings.field.${field}`)}
        {multiline ? (
          <textarea {...inputProps} rows={3} />
        ) : (
          <input {...inputProps} type="password" />
        )}
      </label>
      <label className={styles.clearRow}>
        <input
          checked={clear}
          onChange={(event) => onClear(event.target.checked)}
          type="checkbox"
        />
        {t("integrationSettings.clear")}
      </label>
    </div>
  );
}

export function IntegrationSettingsPanel({
  dictionary,
  ensureSudoSession,
  isSudoActive,
}: {
  dictionary: AppDictionary;
  ensureSudoSession: () => Promise<void>;
  isSudoActive?: boolean;
}) {
  const t = useCallback((key: string) => uiText(dictionary, key), [dictionary]);
  const [summary, setSummary] = useState<SettingsSummary | null>(null);
  const [draft, setDraft] = useState(emptyDraft);
  const [clearFields, setClearFields] = useState<Set<SecretField>>(new Set());
  const [busy, setBusy] = useState<"load" | "save" | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const request = useCallback(
    async (action: "load" | "save") => {
      setBusy(action);
      setNotice("");
      setError("");

      try {
        await ensureSudoSession();
        const response = await fetch("/api/admin/integrations", {
          body:
            action === "save"
              ? JSON.stringify({
                  apiKeys: {
                    ...Object.fromEntries(
                      API_KEY_FIELDS.map((field) => [field, draft[field]]),
                    ),
                  },
                  clearApiKeys: API_KEY_FIELDS.filter((field) =>
                    clearFields.has(field),
                  ),
                  integrations: {
                    ...Object.fromEntries(
                      INTEGRATION_FIELDS.map((field) => [field, draft[field]]),
                    ),
                    clear: INTEGRATION_FIELDS.filter((field) =>
                      clearFields.has(field),
                    ),
                  },
                })
              : undefined,
          headers: { "Content-Type": "application/json" },
          method: action === "save" ? "PUT" : "GET",
        });
        const payload = (await response.json().catch(() => null)) as
          | (SettingsSummary & { errorKey?: string })
          | null;

        if (!(response.ok && payload?.apiKeys && payload.integrations)) {
          throw new Error(
            payload?.errorKey
              ? t(payload.errorKey)
              : t("integrationSettings.loadFailed"),
          );
        }

        setSummary(payload);
        setDraft(emptyDraft());
        setClearFields(new Set());
        setNotice(
          t(
            action === "save"
              ? "integrationSettings.saved"
              : "integrationSettings.loaded",
          ),
        );
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : t("integrationSettings.loadFailed"),
        );
      } finally {
        setBusy(null);
      }
    },
    [ensureSudoSession, draft, clearFields, t],
  );

  useEffect(() => {
    if (isSudoActive) {
      void request("load");
    }
  }, [isSudoActive, request]);

  function configured(field: SecretField) {
    if (!summary) return false;
    if (field === "itsOpenApiKey") {
      return summary.integrations.itsOpenApiKeyConfigured;
    }
    if (field === "incidentWebhookUrls") {
      return summary.integrations.incidentWebhookCount > 0;
    }
    if (field.startsWith("webPush")) {
      return summary.integrations.webPushConfigured;
    }
    return summary.apiKeys.configured[field as ApiKeyField];
  }

  function updateClear(field: SecretField, checked: boolean) {
    setClearFields((current) => {
      const next = new Set(current);
      if (checked) next.add(field);
      else next.delete(field);
      return next;
    });
  }

  return (
    <section className={styles.card}>
      <div className={styles.cardHeader}>
        <span className={styles.cardTitle}>
          <KeyRound aria-hidden="true" size={18} strokeWidth={2.4} />
          {t("integrationSettings.title")}
        </span>
        {Boolean(isSudoActive) && (
          <button
            className={styles.actionButton}
            disabled={Boolean(busy)}
            onClick={() => void request("load")}
            type="button"
          >
            {busy === "load" ? (
              <LoaderCircle className={styles.spinning} size={16} />
            ) : (
              <RefreshCw aria-hidden="true" size={16} />
            )}
            {summary ? t("새로고침") : t("integrationSettings.load")}
          </button>
        )}
      </div>
      <p className={styles.muted}>{t("integrationSettings.description")}</p>
      {summary ? (
        <>
          <div className={styles.settingsGrid}>
            {API_KEY_FIELDS.map((field) => (
              <SecretInput
                clear={clearFields.has(field)}
                configured={configured(field)}
                dictionary={dictionary}
                field={field}
                key={field}
                onClear={(checked) => updateClear(field, checked)}
                onValue={(value) =>
                  setDraft((current) => ({ ...current, [field]: value }))
                }
                value={draft[field]}
              />
            ))}
            {INTEGRATION_FIELDS.map((field) => (
              <SecretInput
                clear={clearFields.has(field)}
                configured={configured(field)}
                dictionary={dictionary}
                field={field}
                key={field}
                multiline={field === "incidentWebhookUrls"}
                onClear={(checked) => updateClear(field, checked)}
                onValue={(value) =>
                  setDraft((current) => ({ ...current, [field]: value }))
                }
                value={draft[field]}
              />
            ))}
          </div>
          <button
            className={styles.actionButton}
            disabled={Boolean(busy)}
            onClick={() => void request("save")}
            type="button"
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
