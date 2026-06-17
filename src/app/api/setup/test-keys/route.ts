import { noStoreJson } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ApiKeyCheck = {
  id: string;
  message: string;
  ok: boolean;
  skipped: boolean;
  title: string;
};

const TEST_TIMEOUT_MS = 4_000;

function present(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

function urlOk(value: unknown) {
  if (!present(value)) {
    return true;
  }

  try {
    const url = new URL(String(value));
    return url.protocol === "https:";
  } catch {
    return false;
  }
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function skipped(id: string, title: string, message = "No key provided.") {
  return { id, message, ok: true, skipped: true, title } satisfies ApiKeyCheck;
}

function failed(id: string, title: string, message: string) {
  return {
    id,
    message,
    ok: false,
    skipped: false,
    title,
  } satisfies ApiKeyCheck;
}

function passed(id: string, title: string) {
  return {
    id,
    message: "Connection test passed.",
    ok: true,
    skipped: false,
    title,
  } satisfies ApiKeyCheck;
}

async function fetchWithTimeout(input: URL | string, init: RequestInit = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TEST_TIMEOUT_MS);

  try {
    return await fetch(input, {
      ...init,
      cache: "no-store",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function modelsUrl(baseUrl: string) {
  return new URL("models", baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);
}

async function checkOpenAi(payload: Record<string, unknown>) {
  const title = "OpenAI-compatible API";
  const apiKey = stringValue(payload.openaiApiKey);
  const baseUrl =
    stringValue(payload.openaiBaseUrl) || "https://api.openai.com/v1";

  if (!apiKey) return skipped("openai", title);

  if (!urlOk(baseUrl)) {
    return failed("openai", title, "Base URL must be a valid HTTPS URL.");
  }

  try {
    const response = await fetchWithTimeout(modelsUrl(baseUrl), {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
    });

    return response.ok
      ? passed("openai", title)
      : failed("openai", title, `Provider returned HTTP ${response.status}.`);
  } catch (error) {
    return failed(
      "openai",
      title,
      error instanceof Error ? error.message : String(error),
    );
  }
}

async function checkKakaoLocal(payload: Record<string, unknown>) {
  const title = "Kakao Local API";
  const apiKey = stringValue(payload.kakaoRestApiKey);

  if (!apiKey) return skipped("kakao", title);

  const url = new URL("https://dapi.kakao.com/v2/local/search/keyword.json");
  url.searchParams.set("query", "서울시청");
  url.searchParams.set("size", "1");

  try {
    const response = await fetchWithTimeout(url, {
      headers: {
        Accept: "application/json",
        Authorization: `KakaoAK ${apiKey}`,
      },
    });

    return response.ok
      ? passed("kakao", title)
      : failed("kakao", title, `Provider returned HTTP ${response.status}.`);
  } catch (error) {
    return failed(
      "kakao",
      title,
      error instanceof Error ? error.message : String(error),
    );
  }
}

async function checkVworld(payload: Record<string, unknown>) {
  const title = "VWorld API";
  const apiKey = stringValue(payload.vworldApiKey);

  if (!apiKey) return skipped("vworld", title, "OSM fallback will be used.");

  const url = new URL("https://api.vworld.kr/req/address");
  url.searchParams.set("service", "address");
  url.searchParams.set("request", "getCoord");
  url.searchParams.set("version", "2.0");
  url.searchParams.set("crs", "EPSG:4326");
  url.searchParams.set("format", "json");
  url.searchParams.set("errorformat", "json");
  url.searchParams.set("type", "road");
  url.searchParams.set("address", "서울특별시 중구 세종대로 110");
  url.searchParams.set("key", apiKey);

  try {
    const response = await fetchWithTimeout(url, {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      return failed(
        "vworld",
        title,
        `Provider returned HTTP ${response.status}.`,
      );
    }

    const responsePayload = (await response.json().catch(() => null)) as {
      response?: { status?: string };
    } | null;

    return responsePayload?.response?.status === "OK"
      ? passed("vworld", title)
      : failed("vworld", title, "Provider did not return an OK status.");
  } catch (error) {
    return failed(
      "vworld",
      title,
      error instanceof Error ? error.message : String(error),
    );
  }
}

async function checkKakaoMobility(payload: Record<string, unknown>) {
  const title = "Kakao Mobility API";
  const apiKey = stringValue(payload.kakaoMobilityRestApiKey);

  if (!apiKey) return skipped("kakao-mobility", title);

  const url = new URL("https://apis-navi.kakaomobility.com/v1/directions");
  url.searchParams.set("origin", "126.9786,37.5665");
  url.searchParams.set("destination", "126.9768,37.5728");
  url.searchParams.set("priority", "TIME");

  try {
    const response = await fetchWithTimeout(url, {
      headers: {
        Authorization: `KakaoAK ${apiKey}`,
      },
    });

    return response.ok
      ? passed("kakao-mobility", title)
      : failed(
          "kakao-mobility",
          title,
          `Provider returned HTTP ${response.status}.`,
        );
  } catch (error) {
    return failed(
      "kakao-mobility",
      title,
      error instanceof Error ? error.message : String(error),
    );
  }
}

async function checkPublicData(payload: Record<string, unknown>) {
  const title = "Public Data Portal API";
  const apiKey = stringValue(payload.publicDataApiKey);

  if (!apiKey) return skipped("public-data", title);

  const url = new URL(
    "http://apis.data.go.kr/1360000/EqkInfoService/getEqkMsg",
  );
  url.searchParams.set("serviceKey", apiKey);
  url.searchParams.set("numOfRows", "1");
  url.searchParams.set("pageNo", "1");
  url.searchParams.set("dataType", "JSON");
  url.searchParams.set("fromTmFc", "20260610");
  url.searchParams.set("toTmFc", "20260617");

  try {
    const response = await fetchWithTimeout(url);

    return response.ok
      ? passed("public-data", title)
      : failed(
          "public-data",
          title,
          `Provider returned HTTP ${response.status}.`,
        );
  } catch (error) {
    return failed(
      "public-data",
      title,
      error instanceof Error ? error.message : String(error),
    );
  }
}

async function checkSeoulOpen(payload: Record<string, unknown>) {
  const title = "Seoul Open API";
  const apiKey = stringValue(payload.seoulOpenApiKey);

  if (!apiKey) return skipped("seoul", title);

  const url = new URL(
    `https://openapi.seoul.go.kr:8088/${encodeURIComponent(apiKey)}/json/citydata_ppltn/1/5/광화문·덕수궁`,
  );

  try {
    const response = await fetchWithTimeout(url);

    return response.ok
      ? passed("seoul", title)
      : failed("seoul", title, `Provider returned HTTP ${response.status}.`);
  } catch (error) {
    return failed(
      "seoul",
      title,
      error instanceof Error ? error.message : String(error),
    );
  }
}

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;

  if (!payload) {
    return noStoreJson({ errorKey: "api.failed", ok: false }, { status: 400 });
  }

  const checks = [
    await checkOpenAi(payload),
    await checkKakaoLocal(payload),
    await checkKakaoMobility(payload),
    await checkVworld(payload),
    await checkPublicData(payload),
    await checkSeoulOpen(payload),
  ];

  return noStoreJson({
    checks,
    ok: checks.every((check) => check.ok),
  });
}
