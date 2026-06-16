import { noStoreJson } from "@/lib/http";
import {
  completeSetup,
  getSetupStateErrorKey,
  isSetupComplete,
} from "@/lib/setup-state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (await isSetupComplete()) {
    return noStoreJson(
      { errorKey: "database.alreadyInstalled", ok: false },
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
    const errorKey = getSetupStateErrorKey(error) ?? "install.failed";

    return noStoreJson({ errorKey, ok: false }, { status: 400 });
  }
}
