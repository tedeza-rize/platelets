import OpenAI from "openai";
import { assertAiBaseUrlSafe, getAiSettings } from "@/lib/ai-settings";
import { getRuntimeApiKeys } from "@/lib/runtime-config";

export type DisasterSimulationInput = {
  buildingContext: string;
  incidentContext: string;
  locationContext: string;
  riskContext: string;
  weatherContext: string;
};

export type DisasterSimulationScenario = {
  generatedAt: string;
  model: string;
  scenario: string;
};

function bounded(value: unknown, fallback: string, maxLength = 1200) {
  return String(value ?? fallback)
    .trim()
    .slice(0, maxLength);
}

function simulationPrompt(input: DisasterSimulationInput) {
  return [
    "Create a realistic disaster drill scenario for a Korean public-safety operations dashboard.",
    "Use plain Korean. This is simulation content only and must not claim a real incident happened.",
    "Include likely incident progression, people at risk, needed resources, first 15 minute actions, and operator watch points.",
    "Keep it concise enough for a command-center panel.",
    "",
    `Location: ${bounded(input.locationContext, "unknown")}`,
    `Building or facility: ${bounded(input.buildingContext, "not selected")}`,
    `Weather: ${bounded(input.weatherContext, "not provided")}`,
    `Nearby or active incident context: ${bounded(input.incidentContext, "none")}`,
    `Risk context: ${bounded(input.riskContext, "none")}`,
  ].join("\n");
}

export async function generateDisasterSimulation(
  input: DisasterSimulationInput,
): Promise<DisasterSimulationScenario | null> {
  const { openaiApiKey } = await getRuntimeApiKeys();

  if (!openaiApiKey) {
    return null;
  }

  const settings = await getAiSettings();
  const client = new OpenAI({
    apiKey: openaiApiKey,
    baseURL: await assertAiBaseUrlSafe(settings.baseUrl),
    maxRetries: 1,
    timeout: 45_000,
  });
  const prompt = simulationPrompt(input);
  let scenario = "";

  if (settings.apiMode === "chat-completions") {
    const completion = await client.chat.completions.create({
      messages: [
        {
          role: "developer",
          content:
            "You write drill-only disaster scenarios for public-safety operators.",
        },
        { role: "user", content: prompt },
      ],
      model: settings.model,
      reasoning_effort: settings.reasoningEffort,
      store: false,
    });
    scenario = completion.choices[0]?.message.content ?? "";
  } else {
    const response = await client.responses.create({
      input: prompt,
      instructions:
        "You write drill-only disaster scenarios for public-safety operators.",
      model: settings.model,
      reasoning: { effort: settings.reasoningEffort },
      store: false,
      text: { verbosity: settings.verbosity },
    });
    scenario = response.output_text;
  }

  return {
    generatedAt: new Date().toISOString(),
    model: settings.model,
    scenario: scenario.trim().slice(0, 6_000),
  };
}
