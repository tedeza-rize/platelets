import { Check, Eye, EyeOff, LoaderCircle, X } from "lucide-react";
import { useCallback, useState } from "react";
import { type AppDictionary, uiText } from "@/lib/i18n";
import styles from "./management-console.module.css";

export const API_KEY_FIELDS = [
  "vworldApiKey",
  "publicDataApiKey",
  "kakaoRestApiKey",
  "kakaoMobilityRestApiKey",
  "seoulOpenApiKey",
  "openaiApiKey",
] as const;

export const INTEGRATION_FIELDS = [
  "itsOpenApiKey",
  "fireSafetyApiKey",
  "incidentWebhookUrls",
  "webPushPublicKey",
  "webPushPrivateKey",
  "webPushContact",
] as const;

export type ApiKeyField = (typeof API_KEY_FIELDS)[number];
export type IntegrationField = (typeof INTEGRATION_FIELDS)[number];
export type SecretField = ApiKeyField | IntegrationField;

function TestResultDisplay({
  result,
}: {
  result: { ok: boolean; message: string } | null;
}) {
  if (!result) return null;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "6px",
        fontSize: "0.8rem",
        color: result.ok ? "#228738" : "#de3412",
        marginTop: "2px",
        fontWeight: 700,
      }}
    >
      {result.ok ? <Check size={14} /> : <X size={14} />}
      <span>{result.message}</span>
    </div>
  );
}

export function SecretInput({
  configured,
  dictionary,
  field,
  multiline = false,
  onValue,
  value,
}: {
  configured: boolean;
  dictionary: AppDictionary;
  field: SecretField;
  multiline?: boolean;
  onValue: (value: string) => void;
  value: string;
}) {
  const t = useCallback((key: string) => uiText(dictionary, key), [dictionary]);
  const inputId = `integration-${field}`;
  const [showPassword, setShowPassword] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  const isTestable =
    field !== "incidentWebhookUrls" &&
    field !== "webPushPublicKey" &&
    field !== "webPushPrivateKey" &&
    field !== "webPushContact";

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const response = await fetch("/api/admin/integrations/test", {
        body: JSON.stringify({ field, value: value || "" }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const data = await response.json();
      if (response.ok && data.ok !== undefined) {
        setTestResult({
          ok: data.ok,
          message:
            data.message || (data.ok ? t("테스트 성공") : t("테스트 실패")),
        });
      } else {
        setTestResult({ ok: false, message: data.error || t("테스트 실패") });
      }
    } catch (error) {
      setTestResult({
        ok: false,
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setTesting(false);
    }
  }

  const inputProps = {
    autoComplete: "off",
    className: styles.textInput,
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
    <div className={styles.secretField} style={{ gap: "4px" }}>
      <label className={styles.fieldLabel} htmlFor={inputId}>
        {t(`integrationSettings.field.${field}`)}
        <div
          style={{
            display: "flex",
            gap: "8px",
            alignItems: "center",
            position: "relative",
            width: "100%",
          }}
        >
          {multiline ? (
            <textarea {...inputProps} rows={3} style={{ flex: 1 }} />
          ) : (
            <div
              style={{
                display: "flex",
                flex: 1,
                position: "relative",
                alignItems: "center",
              }}
            >
              <input
                {...inputProps}
                type={showPassword ? "text" : "password"}
                style={{ flex: 1, paddingRight: "40px" }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: "absolute",
                  right: "8px",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--text-muted)",
                  display: "flex",
                  alignItems: "center",
                  padding: "4px",
                }}
                title={showPassword ? t("숨기기") : t("보기")}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          )}
          {Boolean(isTestable) && (
            <button
              className={styles.actionButton}
              type="button"
              disabled={testing || !(value || configured)}
              onClick={handleTest}
              style={{ minHeight: "38px", flexShrink: 0 }}
            >
              {testing ? (
                <LoaderCircle className={styles.spinning} size={16} />
              ) : (
                t("테스트")
              )}
            </button>
          )}
        </div>
      </label>
      <TestResultDisplay result={testResult} />
    </div>
  );
}
