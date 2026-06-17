import { requireAccessRole } from "@/lib/access-control";
import { noStoreJson } from "@/lib/http";
import {
  getOperationalSettings,
  saveOperationalSettings,
} from "@/lib/operational-settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return noStoreJson({ settings: await getOperationalSettings() });
}

export async function PUT(request: Request) {
  const [, accessError] = await requireAccessRole(request, "sudo");
  if (accessError !== null) {
    return noStoreJson(
      { error: accessError.message },
      { status: accessError.code === "unauthorized" ? 401 : 403 },
    );
  }

  const payload = (await request.json().catch(() => null)) as {
    settings?: unknown;
  } | null;

  try {
    return noStoreJson({
      settings: await saveOperationalSettings(
        (payload?.settings ?? {}) as Record<string, unknown>,
      ),
    });
  } catch (error) {
    return noStoreJson(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 400 },
    );
  }
}
