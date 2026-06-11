import { noStoreJson } from "@/lib/http";
import { completeSetup, isSetupComplete } from "@/lib/setup-state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (await isSetupComplete()) {
    return noStoreJson(
      { error: "Setup is already complete." },
      { status: 409 },
    );
  }

  const payload = await request.json().catch(() => null);

  try {
    const state = await completeSetup(payload);
    return noStoreJson({
      completedAt: state.completedAt,
      ok: true,
    });
  } catch (error) {
    return noStoreJson(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 400 },
    );
  }
}
