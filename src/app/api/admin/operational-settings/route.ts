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
  const forbidden = await requireAccessRole(request, "sudo");

  if (forbidden) {
    return forbidden;
  }

  const payload = (await request.json().catch(() => null)) as {
    settings?: unknown;
  } | null;

  return noStoreJson({
    settings: await saveOperationalSettings(
      (payload?.settings ?? {}) as Record<string, unknown>,
    ),
  });
}
