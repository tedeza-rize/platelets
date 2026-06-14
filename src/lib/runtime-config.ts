import { getConfiguredApiKeys } from "@/lib/setup-state";

function clean(value: string | null | undefined) {
  return value?.trim() || "";
}

function configuredOrEnv(configured: string, ...envNames: string[]) {
  if (configured) return configured;

  for (const envName of envNames) {
    const envValue = clean(process.env[envName]);
    if (envValue) return envValue;
  }

  return "";
}

export async function getRuntimeApiKeys() {
  const stored = await getConfiguredApiKeys();
  const openaiBaseUrl =
    clean(stored.openaiBaseUrl) ||
    clean(process.env.OPENAI_BASE_URL) ||
    "https://api.openai.com/v1";

  return {
    kakaoMobilityRestApiKey: configuredOrEnv(
      clean(stored.kakaoMobilityRestApiKey),
      "KAKAO_MOBILITY_REST_API_KEY",
    ),
    kakaoRestApiKey: configuredOrEnv(
      clean(stored.kakaoRestApiKey),
      "KAKAO_REST_API_KEY",
      "KAKAO_LOCAL_REST_API_KEY",
    ),
    openaiApiKey: configuredOrEnv(clean(stored.openaiApiKey), "OPENAI_API_KEY"),
    openaiBaseUrl,
    publicDataApiKey: configuredOrEnv(
      clean(stored.publicDataApiKey),
      "PUBLIC_DATA_API_KEY",
    ),
    seoulOpenApiKey: configuredOrEnv(
      clean(stored.seoulOpenApiKey),
      "SEOUL_OPEN_API_KEY",
    ),
    vworldApiKey: configuredOrEnv(
      clean(stored.vworldApiKey),
      "VWORLD_API_KEY",
      "NEXT_PUBLIC_VWORLD_API_KEY",
    ),
  };
}
