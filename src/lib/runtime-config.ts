import { getConfiguredApiKeys } from "@/lib/setup-state";

function clean(value: string | null | undefined) {
  return value?.trim() || "";
}

export async function getRuntimeApiKeys() {
  const stored = await getConfiguredApiKeys();

  return {
    kakaoMobilityRestApiKey: clean(stored.kakaoMobilityRestApiKey),
    kakaoRestApiKey: clean(stored.kakaoRestApiKey),
    openaiApiKey: clean(stored.openaiApiKey),
    openaiBaseUrl: clean(stored.openaiBaseUrl) || "https://api.openai.com/v1",
    publicDataApiKey: clean(stored.publicDataApiKey),
    seoulOpenApiKey: clean(stored.seoulOpenApiKey),
    vworldApiKey: clean(stored.vworldApiKey),
  };
}
