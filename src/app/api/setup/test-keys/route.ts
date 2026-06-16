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
    await checkVworld(payload),
    skipped("public-data", "Public data service key"),
    skipped("kakao-mobility", "Kakao Mobility API"),
    skipped("seoul", "Seoul Open API"),
  ];

  return noStoreJson({
    checks,
    ok: checks.every((check) => check.ok),
  });
}
