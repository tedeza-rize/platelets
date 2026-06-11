import { getConfiguredApiKeys } from "@/lib/setup-state";

function clean(value: string | null | undefined) {
  return value?.trim() || "";
}

export async function getRuntimeApiKeys() {
  const stored = await getConfiguredApiKeys();

  return {
    kakaoMobilityRestApiKey:
      clean(stored.kakaoMobilityRestApiKey) ||
      clean(process.env.KAKAO_MOBILITY_REST_API_KEY),
    kakaoRestApiKey:
      clean(stored.kakaoRestApiKey) ||
      clean(process.env.KAKAO_REST_API_KEY) ||
      clean(process.env.KAKAO_LOCAL_REST_API_KEY),
    openaiApiKey:
      clean(stored.openaiApiKey) || clean(process.env.OPENAI_API_KEY),
    openaiBaseUrl:
      clean(stored.openaiBaseUrl) ||
      clean(process.env.OPENAI_BASE_URL) ||
      "https://api.openai.com/v1",
    publicDataApiKey:
      clean(stored.publicDataApiKey) ||
      clean(process.env.PUBLIC_DATA_API_KEY) ||
      clean(process.env.DATA_GO_KR_API_KEY) ||
      clean(process.env.DATA_GO_KR_SERVICE_KEY),
    seoulOpenApiKey:
      clean(stored.seoulOpenApiKey) ||
      clean(process.env.SEOUL_OPEN_API_KEY) ||
      clean(process.env.SEOUL_CITYDATA_API_KEY),
    vworldApiKey:
      clean(stored.vworldApiKey) ||
      clean(process.env.NEXT_PUBLIC_VWORLD_API_KEY),
  };
}
