export type AiProviderPreset = {
  baseUrl: string;
  id: string;
  label: string;
  model?: string;
};

export const AI_PROVIDER_PRESETS: readonly AiProviderPreset[] = [
  {
    baseUrl: "https://api.openai.com/v1",
    id: "openai",
    label: "OpenAI",
  },
  {
    baseUrl: "https://openrouter.ai/api/v1",
    id: "openrouter",
    label: "OpenRouter",
  },
  {
    baseUrl: "https://openrouter.ai/api/v1",
    id: "anthropic-openrouter",
    label: "Anthropic via OpenRouter",
    model: "anthropic/claude-sonnet-4",
  },
  {
    baseUrl: "https://openrouter.ai/api/v1",
    id: "google-openrouter",
    label: "Google Gemini via OpenRouter",
    model: "google/gemini-2.5-pro",
  },
  {
    baseUrl: "https://api.groq.com/openai/v1",
    id: "groq",
    label: "Groq",
  },
  {
    baseUrl: "https://api.x.ai/v1",
    id: "xai",
    label: "Grok / xAI",
  },
  {
    baseUrl: "https://api.z.ai/api/paas/v4",
    id: "zai",
    label: "Z.ai",
  },
] as const;

export function matchingAiProviderPreset(baseUrl: string, model = "") {
  const normalized = baseUrl.trim().replace(/\/$/, "");
  return (
    AI_PROVIDER_PRESETS.find(
      (preset) =>
        preset.model &&
        preset.model === model.trim() &&
        preset.baseUrl.replace(/\/$/, "") === normalized,
    ) ??
    AI_PROVIDER_PRESETS.find(
      (preset) =>
        !preset.model && preset.baseUrl.replace(/\/$/, "") === normalized,
    ) ??
    AI_PROVIDER_PRESETS.find(
      (preset) => preset.baseUrl.replace(/\/$/, "") === normalized,
    ) ??
    null
  );
}
