"use client";

import {
  Bot,
  Database,
  LoaderCircle,
  Save,
  Send,
  Settings,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import {
  AI_PROVIDER_PRESETS,
  matchingAiProviderPreset,
} from "@/lib/ai-provider-presets";
import type { AiSettings } from "@/lib/ai-settings";
import { type AppDictionary, uiText } from "@/lib/i18n";
import styles from "./ai-console.module.css";

type AiAnswer = {
  answer: string;
  contextSummary: {
    datasetCount: number;
    matchingFacilityCount: number;
    nearbyFacilityCount: number;
    recentHazardCount: number;
  };
  model: string;
};

type AiConsoleProps = {
  dictionary: AppDictionary;
};

function AccessTokenField({
  dictionary,
  onChange,
  value,
}: {
  dictionary: AppDictionary;
  onChange: (value: string) => void;
  value: string;
}) {
  const t = (key: string) => uiText(dictionary, key);

  return (
    <label className={styles.field}>
      {t("관리자 비밀번호")}
      <input
        autoComplete="current-password"
        onChange={(event) => onChange(event.target.value)}
        placeholder={t("관리자 또는 sudo 비밀번호")}
        type="password"
        value={value}
      />
      <small>{t("비밀번호는 저장되지 않고 세션 쿠키만 발급됩니다.")}</small>
    </label>
  );
}

export function AiQueryConsole({ dictionary }: AiConsoleProps) {
  const t = (key: string) => uiText(dictionary, key);
  const [password, setPassword] = useState("");
  const [question, setQuestion] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [result, setResult] = useState<AiAnswer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function loginIfNeeded() {
    const nextPassword = password.trim();
    if (!nextPassword) return;

    const response = await fetch("/api/auth/login", {
      body: JSON.stringify({ password: nextPassword }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const payload = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;

    if (!response.ok) {
      throw new Error(payload?.error ?? t("로그인에 실패했습니다."));
    }

    setPassword("");
  }

  async function ask(event: React.FormEvent) {
    event.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      await loginIfNeeded();
      const response = await fetch("/api/ai/query", {
        body: JSON.stringify({ latitude, longitude, question }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json()) as AiAnswer & { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? t("AI 질의에 실패했습니다."));
      }

      setResult(payload);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : String(requestError),
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/">{t("지도로 돌아가기")}</Link>
        <span className={styles.icon}>
          <Bot aria-hidden="true" size={22} />
        </span>
        <h1>{t("Platelets AI 분석")}</h1>
        <p>
          {t("저장된 시설·재난·갱신 시각의 요약 데이터를 근거로 답합니다.")}
        </p>
        <Link className={styles.settingsLink} href="/sudo/ai">
          <Settings aria-hidden="true" size={16} /> {t("AI 설정")}
        </Link>
      </header>

      <form className={styles.card} onSubmit={ask}>
        <AccessTokenField
          dictionary={dictionary}
          onChange={setPassword}
          value={password}
        />
        <div className={styles.coordinates}>
          <label className={styles.field}>
            {t("위도 (선택)")}
            <input
              inputMode="decimal"
              onChange={(event) => setLatitude(event.target.value)}
              placeholder="37.5665"
              value={latitude}
            />
          </label>
          <label className={styles.field}>
            {t("경도 (선택)")}
            <input
              inputMode="decimal"
              onChange={(event) => setLongitude(event.target.value)}
              placeholder="126.9780"
              value={longitude}
            />
          </label>
        </div>
        <label className={styles.field}>
          {t("질문")}
          <textarea
            maxLength={4000}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder={t(
              "예: 서울시청 근처에서 이용 가능한 응급의료기관과 데이터 한계를 설명해줘.",
            )}
            required
            rows={6}
            value={question}
          />
        </label>
        <button
          className={styles.primaryButton}
          disabled={isLoading}
          type="submit"
        >
          {isLoading ? (
            <LoaderCircle className={styles.spinner} size={18} />
          ) : (
            <Send size={18} />
          )}
          {isLoading ? t("데이터를 조회하고 분석 중") : t("AI에게 질문")}
        </button>
        {error ? <p className={styles.error}>{error}</p> : null}
      </form>

      {result ? (
        <section className={styles.answerCard} aria-live="polite">
          <div className={styles.answerMeta}>
            <strong>{result.model}</strong>
            <span>
              <Database size={14} /> {t("데이터셋")}{" "}
              {result.contextSummary.datasetCount.toLocaleString(
                dictionary.formatLocale,
              )}
              {t("개")}
            </span>
            <span>
              {t("검색 시설")}{" "}
              {result.contextSummary.matchingFacilityCount.toLocaleString(
                dictionary.formatLocale,
              )}
              {t("개")}
            </span>
            <span>
              {t("주변 시설")}{" "}
              {result.contextSummary.nearbyFacilityCount.toLocaleString(
                dictionary.formatLocale,
              )}
              {t("개")}
            </span>
          </div>
          <div className={styles.answer}>{result.answer}</div>
        </section>
      ) : null}
    </main>
  );
}

export function AiSettingsConsole({ dictionary }: AiConsoleProps) {
  const t = (key: string) => uiText(dictionary, key);
  const [password, setPassword] = useState("");
  const [settings, setSettings] = useState<AiSettings | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const selectedProviderPreset = settings
    ? (matchingAiProviderPreset(settings.baseUrl, settings.model)?.id ??
      "custom")
    : "custom";

  async function loginIfNeeded() {
    const nextPassword = password.trim();
    if (!nextPassword) return;

    const response = await fetch("/api/auth/login", {
      body: JSON.stringify({ password: nextPassword }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const payload = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;

    if (!response.ok) {
      throw new Error(payload?.error ?? t("로그인에 실패했습니다."));
    }

    setPassword("");
  }

  async function loadSettings() {
    setIsLoading(true);
    setError(null);
    try {
      await loginIfNeeded();
      const response = await fetch("/api/admin/ai-settings", {
        cache: "no-store",
      });
      const payload = (await response.json()) as {
        error?: string;
        settings?: AiSettings;
      };
      if (!response.ok || !payload.settings) {
        throw new Error(payload.error ?? t("AI 설정을 불러오지 못했습니다."));
      }
      setSettings(payload.settings);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : String(requestError),
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!settings) return;
    setIsLoading(true);
    setError(null);
    setNotice(null);
    try {
      await loginIfNeeded();
      const response = await fetch("/api/admin/ai-settings", {
        body: JSON.stringify(settings),
        headers: { "Content-Type": "application/json" },
        method: "PUT",
      });
      const payload = (await response.json()) as {
        error?: string;
        settings?: AiSettings;
      };
      if (!response.ok || !payload.settings) {
        throw new Error(payload.error ?? t("AI 설정을 저장하지 못했습니다."));
      }
      setSettings(payload.settings);
      setNotice(t("AI 설정을 저장했습니다."));
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : String(requestError),
      );
    } finally {
      setIsLoading(false);
    }
  }

  function update<TKey extends keyof AiSettings>(
    key: TKey,
    value: AiSettings[TKey],
  ) {
    setSettings((current) =>
      current ? { ...current, [key]: value } : current,
    );
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/ai">{t("AI 분석으로 돌아가기")}</Link>
        <span className={styles.icon}>
          <Settings aria-hidden="true" size={22} />
        </span>
        <h1>{t("AI 연결 설정")}</h1>
        <p>
          {t(
            "API 키는 환경변수에만 두고, 여기에는 호출 방식과 프롬프트만 저장합니다.",
          )}
        </p>
      </header>

      <section className={styles.card}>
        <AccessTokenField
          dictionary={dictionary}
          onChange={setPassword}
          value={password}
        />
        <button
          className={styles.secondaryButton}
          disabled={isLoading}
          onClick={loadSettings}
          type="button"
        >
          {t("설정 불러오기")}
        </button>
      </section>

      {settings ? (
        <form className={styles.card} onSubmit={save}>
          <div className={styles.coordinates}>
            <label className={styles.field}>
              {t("API 방식")}
              <select
                value={settings.apiMode}
                onChange={(event) =>
                  update(
                    "apiMode",
                    event.target.value === "chat-completions"
                      ? "chat-completions"
                      : "responses",
                  )
                }
              >
                <option value="responses">Responses API</option>
                <option value="chat-completions">
                  {t("Chat Completions 호환")}
                </option>
              </select>
            </label>
            <label className={styles.field}>
              {t("모델")}
              <input
                value={settings.model}
                onChange={(event) => update("model", event.target.value)}
              />
            </label>
          </div>
          <label className={styles.field}>
            {t("LLM provider preset")}
            <select
              value={selectedProviderPreset}
              onChange={(event) => {
                const preset = AI_PROVIDER_PRESETS.find(
                  (candidate) => candidate.id === event.target.value,
                );

                if (preset) {
                  update("baseUrl", preset.baseUrl);
                  if (preset.model) {
                    update("model", preset.model);
                  }
                }
              }}
            >
              <option value="custom">{t("Custom URL")}</option>
              {AI_PROVIDER_PRESETS.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.label}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            {t("OpenAI 호환 Base URL")}
            <input
              value={settings.baseUrl}
              onChange={(event) => update("baseUrl", event.target.value)}
            />
            <small>
              {t(
                "기본값은 https://api.openai.com/v1이며 사설망 주소는 별도 환경변수로 허용해야 합니다.",
              )}
            </small>
          </label>
          <div className={styles.coordinates}>
            <label className={styles.field}>
              {t("추론 강도")}
              <select
                value={settings.reasoningEffort}
                onChange={(event) =>
                  update(
                    "reasoningEffort",
                    event.target.value as AiSettings["reasoningEffort"],
                  )
                }
              >
                {["none", "minimal", "low", "medium", "high", "xhigh"].map(
                  (value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ),
                )}
              </select>
            </label>
            <label className={styles.field}>
              {t("답변 길이")}
              <select
                value={settings.verbosity}
                onChange={(event) =>
                  update(
                    "verbosity",
                    event.target.value as AiSettings["verbosity"],
                  )
                }
              >
                <option value="low">low</option>
                <option value="medium">medium</option>
                <option value="high">high</option>
              </select>
            </label>
          </div>
          <label className={styles.field}>
            {t("시스템 프롬프트")}
            <textarea
              maxLength={12000}
              rows={12}
              value={settings.systemPrompt}
              onChange={(event) => update("systemPrompt", event.target.value)}
            />
          </label>
          <button
            className={styles.primaryButton}
            disabled={isLoading}
            type="submit"
          >
            <Save size={18} /> {isLoading ? t("저장 중") : t("설정 저장")}
          </button>
        </form>
      ) : null}
      {notice ? <p className={styles.notice}>{notice}</p> : null}
      {error ? <p className={styles.error}>{error}</p> : null}
    </main>
  );
}
