import { requireAccessRole } from "@/lib/access-control";
import { getAiSettings, saveAiSettings } from "@/lib/ai-settings";
import { noStoreJson } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const forbidden = await requireAccessRole(request, "sudo");
  if (forbidden) return forbidden;

  return noStoreJson({ settings: await getAiSettings() });
}

export async function PUT(request: Request) {
  const forbidden = await requireAccessRole(request, "sudo");
  if (forbidden) return forbidden;

  const payload = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;

  try {
    return noStoreJson({ settings: await saveAiSettings(payload ?? {}) });
  } catch (error) {
    return noStoreJson(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 400 },
    );
  }
}
