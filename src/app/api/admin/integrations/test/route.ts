import { requireAccessRole } from "@/lib/access-control";
import { noStoreJson } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TEST_TIMEOUT_MS = 5_000;

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

async function testVWorld(
  keyValue: string,
): Promise<{ ok: boolean; message: string }> {
  const url = new URL("https://api.vworld.kr/req/address");
  url.searchParams.set("service", "address");
  url.searchParams.set("request", "getCoord");
  url.searchParams.set("version", "2.0");
  url.searchParams.set("crs", "EPSG:4326");
  url.searchParams.set("format", "json");
  url.searchParams.set("errorformat", "json");
  url.searchParams.set("type", "road");
  url.searchParams.set("address", "서울특별시 중구 세종대로 110");
  url.searchParams.set("key", keyValue);

  const response = await fetchWithTimeout(url);
  if (!response.ok) {
    return {
      ok: false,
      message: `VWorld API returned HTTP ${response.status}.`,
    };
  }
  const data = (await response.json().catch(() => null)) as {
    response?: { status?: string };
  } | null;

  if (data?.response?.status === "OK") {
    return { ok: true, message: "VWorld API connection test passed." };
  }
  return {
    ok: false,
    message: "VWorld API key is invalid or returned an error status.",
  };
}

async function testKakaoLocal(
  keyValue: string,
): Promise<{ ok: boolean; message: string }> {
  const url = new URL("https://dapi.kakao.com/v2/local/search/keyword.json");
  url.searchParams.set("query", "서울시청");
  url.searchParams.set("size", "1");

  const response = await fetchWithTimeout(url, {
    headers: {
      Accept: "application/json",
      Authorization: `KakaoAK ${keyValue}`,
    },
  });
  if (response.ok) {
    return { ok: true, message: "Kakao Local API connection test passed." };
  }
  return {
    ok: false,
    message: `Kakao Local API returned HTTP ${response.status}.`,
  };
}

async function testOpenAI(
  keyValue: string,
): Promise<{ ok: boolean; message: string }> {
  const url = new URL("https://api.openai.com/v1/models");
  const response = await fetchWithTimeout(url, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${keyValue}`,
    },
  });
  if (response.ok) {
    return { ok: true, message: "OpenAI API connection test passed." };
  }
  return { ok: false, message: `OpenAI API returned HTTP ${response.status}.` };
}

async function testKakaoMobility(
  keyValue: string,
): Promise<{ ok: boolean; message: string }> {
  const url = new URL("https://apis-navi.kakaomobility.com/v1/directions");
  url.searchParams.set("origin", "126.9786,37.5665");
  url.searchParams.set("destination", "126.9768,37.5728");
  url.searchParams.set("priority", "TIME");

  const response = await fetchWithTimeout(url, {
    headers: {
      Authorization: `KakaoAK ${keyValue}`,
    },
  });
  if (response.ok) {
    return { ok: true, message: "Kakao Mobility Directions API test passed." };
  }
  return {
    ok: false,
    message: `Kakao Mobility Directions API returned HTTP ${response.status}.`,
  };
}

async function testIts(
  keyValue: string,
): Promise<{ ok: boolean; message: string }> {
  const url = new URL("https://openapi.its.go.kr:9443/trafficInfo");
  url.searchParams.set("apiKey", keyValue);
  url.searchParams.set("type", "all");
  url.searchParams.set("minX", "126.97");
  url.searchParams.set("maxX", "126.98");
  url.searchParams.set("minY", "37.56");
  url.searchParams.set("maxY", "37.57");
  url.searchParams.set("getType", "json");

  const response = await fetchWithTimeout(url);
  if (response.ok) {
    return {
      ok: true,
      message: "National Traffic Info (ITS) API test passed.",
    };
  }
  return { ok: false, message: `ITS API returned HTTP ${response.status}.` };
}

async function testPublicData(
  keyValue: string,
): Promise<{ ok: boolean; message: string }> {
  const url = new URL(
    "http://apis.data.go.kr/1360000/EqkInfoService/getEqkMsg",
  );
  url.searchParams.set("serviceKey", keyValue);
  url.searchParams.set("numOfRows", "1");
  url.searchParams.set("pageNo", "1");
  url.searchParams.set("dataType", "JSON");
  url.searchParams.set("fromTmFc", "20260610");
  url.searchParams.set("toTmFc", "20260617");

  const response = await fetchWithTimeout(url);
  if (response.ok) {
    return {
      ok: true,
      message: "Public Data Portal EqkInfoService API test passed.",
    };
  }
  return {
    ok: false,
    message: `Public Data Portal API returned HTTP ${response.status}.`,
  };
}

async function testSeoulOpen(
  keyValue: string,
): Promise<{ ok: boolean; message: string }> {
  const url = new URL(
    `https://openapi.seoul.go.kr:8088/${encodeURIComponent(keyValue)}/json/citydata_ppltn/1/5/광화문·덕수궁`,
  );
  const response = await fetchWithTimeout(url);
  if (response.ok) {
    return { ok: true, message: "Seoul Citydata API connection test passed." };
  }
  return {
    ok: false,
    message: `Seoul Citydata API returned HTTP ${response.status}.`,
  };
}

export async function POST(request: Request) {
  const [, accessError] = await requireAccessRole(request, "sudo");
  if (accessError !== null) {
    return noStoreJson(
      { error: accessError.message },
      { status: accessError.code === "unauthorized" ? 401 : 403 },
    );
  }

  const payload = (await request.json().catch(() => null)) as {
    field?: string;
    value?: string;
  } | null;

  if (!payload?.field || typeof payload.value !== "string") {
    return noStoreJson({ error: "Invalid payload." }, { status: 400 });
  }

  const { field, value } = payload;
  const keyValue = value.trim();

  if (!keyValue) {
    return noStoreJson(
      { error: "API key is required for testing." },
      { status: 400 },
    );
  }

  try {
    if (field === "vworldApiKey") {
      return noStoreJson(await testVWorld(keyValue));
    }
    if (field === "kakaoRestApiKey") {
      return noStoreJson(await testKakaoLocal(keyValue));
    }
    if (field === "openaiApiKey") {
      return noStoreJson(await testOpenAI(keyValue));
    }
    if (field === "kakaoMobilityRestApiKey") {
      return noStoreJson(await testKakaoMobility(keyValue));
    }
    if (field === "itsOpenApiKey") {
      return noStoreJson(await testIts(keyValue));
    }
    if (field === "publicDataApiKey") {
      return noStoreJson(await testPublicData(keyValue));
    }
    if (field === "seoulOpenApiKey") {
      return noStoreJson(await testSeoulOpen(keyValue));
    }

    return noStoreJson(
      { error: `Testing for field ${field} is not supported.` },
      { status: 400 },
    );
  } catch (error) {
    return noStoreJson({
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
