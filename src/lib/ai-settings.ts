import { lookup } from "node:dns/promises";
import { getOperationalSettings } from "@/lib/operational-settings";
import { getAppSetting, setAppSetting } from "@/lib/points-db";

export type AiApiMode = "responses" | "chat-completions";
export type AiReasoningEffort =
  | "none"
  | "minimal"
  | "low"
  | "medium"
  | "high"
  | "xhigh";
export type AiVerbosity = "low" | "medium" | "high";

export type AiSettings = {
  apiMode: AiApiMode;
  baseUrl: string;
  model: string;
  reasoningEffort: AiReasoningEffort;
  systemPrompt: string;
  verbosity: AiVerbosity;
};

const AI_SETTINGS_KEY = "ai-settings";
const DEFAULT_SYSTEM_PROMPT = `당신은 Platelets 재난·응급 대응 분석 보조자입니다.
제공된 데이터 컨텍스트만 사실 근거로 사용하고, 데이터에 없는 값은 추정이라고 명시하세요.
응급의료 답변은 의료진의 판단을 대체하지 않으며 즉시 위험하면 119에 연락하도록 안내하세요.
시설 추천 시 거리만 보지 말고 데이터 시각, 가용성, 진료역량의 한계를 함께 설명하세요.
한국어로 간결하고 실행 가능한 답변을 작성하세요.`;

export const DEFAULT_AI_SETTINGS: AiSettings = {
  apiMode: "responses",
  baseUrl: "https://api.openai.com/v1",
  model: "gpt-5.5",
  reasoningEffort: "medium",
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  verbosity: "low",
};

function isPrivateHostname(hostname: string) {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, "");

  if (
    normalized === "localhost" ||
    normalized === "metadata.google.internal" ||
    normalized === "169.254.169.254" ||
    normalized === "::1"
  ) {
    return true;
  }

  const parts = normalized.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) {
    return false;
  }

  return (
    parts[0] === 10 ||
    parts[0] === 127 ||
    (parts[0] === 169 && parts[1] === 254) ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168)
  );
}

function isPrivateAddress(address: string) {
  const normalized = address.toLowerCase();

  if (
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe80:")
  ) {
    return true;
  }

  return isPrivateHostname(normalized.replace(/^::ffff:/, ""));
}

export function validateAiBaseUrl(value: string, allowPrivateBaseUrl = false) {
  const url = new URL(value.trim());

  if (url.protocol !== "https:") {
    throw new Error("AI 프록시 URL은 HTTPS를 사용해야 합니다.");
  }
  if (url.username || url.password) {
    throw new Error("AI 프록시 URL에 인증정보를 포함할 수 없습니다.");
  }
  if (isPrivateHostname(url.hostname) && !allowPrivateBaseUrl) {
    throw new Error(
      "Private-network AI proxy URLs must be explicitly allowed in operational settings.",
    );
  }

  return url.toString().replace(/\/$/, "");
}

export async function assertAiBaseUrlSafe(value: string) {
  const operationalSettings = await getOperationalSettings();
  const validated = validateAiBaseUrl(
    value,
    operationalSettings.aiAllowPrivateBaseUrl,
  );

  if (operationalSettings.aiAllowPrivateBaseUrl) {
    return validated;
  }

  const addresses = await lookup(new URL(validated).hostname, { all: true });
  if (addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new Error("사설망으로 연결되는 AI 프록시 URL은 허용되지 않습니다.");
  }

  return validated;
}

export async function getAiSettings() {
  const [stored, operationalSettings] = await Promise.all([
    getAppSetting<Partial<AiSettings>>(AI_SETTINGS_KEY, {}),
    getOperationalSettings(),
  ]);

  return {
    apiMode:
      stored.apiMode === "chat-completions" ? "chat-completions" : "responses",
    baseUrl: validateAiBaseUrl(
      stored.baseUrl || DEFAULT_AI_SETTINGS.baseUrl,
      operationalSettings.aiAllowPrivateBaseUrl,
    ),
    model: stored.model?.trim().slice(0, 120) || DEFAULT_AI_SETTINGS.model,
    reasoningEffort: [
      "none",
      "minimal",
      "low",
      "medium",
      "high",
      "xhigh",
    ].includes(stored.reasoningEffort ?? "")
      ? (stored.reasoningEffort as AiReasoningEffort)
      : DEFAULT_AI_SETTINGS.reasoningEffort,
    systemPrompt:
      stored.systemPrompt?.trim().slice(0, 12_000) ||
      DEFAULT_AI_SETTINGS.systemPrompt,
    verbosity: ["low", "medium", "high"].includes(stored.verbosity ?? "")
      ? (stored.verbosity as AiVerbosity)
      : DEFAULT_AI_SETTINGS.verbosity,
  } satisfies AiSettings;
}

export async function saveAiSettings(input: Partial<AiSettings>) {
  const settings: AiSettings = {
    apiMode:
      input.apiMode === "chat-completions" ? "chat-completions" : "responses",
    baseUrl: await assertAiBaseUrlSafe(
      input.baseUrl || DEFAULT_AI_SETTINGS.baseUrl,
    ),
    model: input.model?.trim().slice(0, 120) || DEFAULT_AI_SETTINGS.model,
    reasoningEffort: [
      "none",
      "minimal",
      "low",
      "medium",
      "high",
      "xhigh",
    ].includes(input.reasoningEffort ?? "")
      ? (input.reasoningEffort as AiReasoningEffort)
      : DEFAULT_AI_SETTINGS.reasoningEffort,
    systemPrompt:
      input.systemPrompt?.trim().slice(0, 12_000) ||
      DEFAULT_AI_SETTINGS.systemPrompt,
    verbosity: ["low", "medium", "high"].includes(input.verbosity ?? "")
      ? (input.verbosity as AiVerbosity)
      : DEFAULT_AI_SETTINGS.verbosity,
  };

  await setAppSetting(AI_SETTINGS_KEY, settings);
  return settings;
}
