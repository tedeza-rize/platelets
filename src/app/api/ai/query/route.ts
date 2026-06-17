import OpenAI from "openai";
import { requireAccessRole } from "@/lib/access-control";
import { buildAiGrounding } from "@/lib/ai-grounding";
import { assertAiBaseUrlSafe, getAiSettings } from "@/lib/ai-settings";
import {
  KOREA_COORDINATE_ERROR,
  parseOptionalKoreaCoordinates,
} from "@/lib/coordinates";
import { noStoreJson } from "@/lib/http";
import { enforceSharedRateLimit } from "@/lib/rate-limit";
import { getRuntimeApiKeys } from "@/lib/runtime-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const limited = await enforceSharedRateLimit(request, {
    bucket: "ai-query",
    limit: 10,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const [, accessError] = await requireAccessRole(request, "admin");
  if (accessError !== null) {
    return noStoreJson(
      { error: accessError.message },
      { status: accessError.code === "unauthorized" ? 401 : 403 },
    );
  }

  const payload = (await request.json().catch(() => null)) as {
    latitude?: unknown;
    longitude?: unknown;
    question?: unknown;
  } | null;
  const question = String(payload?.question ?? "")
    .trim()
    .slice(0, 4_000);

  if (!question) {
    return noStoreJson({ error: "질문을 입력하세요." }, { status: 400 });
  }

  const { openaiApiKey } = await getRuntimeApiKeys();
  const apiKey = openaiApiKey;
  if (!apiKey) {
    return noStoreJson({ errorCode: "ai_api_key_missing" }, { status: 503 });
  }

  try {
    const coordinates = parseOptionalKoreaCoordinates({
      latitude: payload?.latitude,
      longitude: payload?.longitude,
    });
    if (coordinates === null) {
      return noStoreJson({ error: KOREA_COORDINATE_ERROR }, { status: 400 });
    }

    const settings = await getAiSettings();
    const safeBaseUrl = await assertAiBaseUrlSafe(settings.baseUrl);
    const grounding = await buildAiGrounding({
      latitude: coordinates?.latitude,
      longitude: coordinates?.longitude,
      question,
    });
    const client = new OpenAI({
      apiKey,
      baseURL: safeBaseUrl,
      maxRetries: 1,
      timeout: 60_000,
    });
    const context = `다음은 Platelets가 조회한 요약 데이터입니다. 원시 레코드는 포함하지 않았습니다.\n${JSON.stringify(grounding)}`;
    let answer: string | null = null;

    if (settings.apiMode === "chat-completions") {
      const completion = await client.chat.completions.create({
        messages: [
          {
            role: "developer",
            content: `${settings.systemPrompt}\n\n${context}`,
          },
          { role: "user", content: question },
        ],
        model: settings.model,
        reasoning_effort: settings.reasoningEffort,
        store: false,
      });
      answer = completion.choices[0]?.message.content ?? null;
    } else {
      const response = await client.responses.create({
        input: question,
        instructions: `${settings.systemPrompt}\n\n${context}`,
        model: settings.model,
        reasoning: { effort: settings.reasoningEffort },
        store: false,
        text: { verbosity: settings.verbosity },
      });
      answer = response.output_text;
    }

    return noStoreJson({
      answer: answer || "모델이 텍스트 응답을 반환하지 않았습니다.",
      contextSummary: {
        datasetCount: grounding.datasets.length,
        locationApplied: coordinates !== undefined,
        matchingFacilityCount: grounding.matchingFacilities.length,
        nearbyFacilityCount: grounding.nearbyFacilities.length,
        recentHazardCount: grounding.recentHazards.length,
      },
      model: settings.model,
    });
  } catch (error) {
    console.error("AI provider query failed", error);
    return noStoreJson(
      { errorCode: "ai_provider_unavailable" },
      { status: 502 },
    );
  }
}
