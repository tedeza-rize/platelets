import { noStoreJson } from "@/lib/http";
import { getSetupEnvironmentStatus, isSetupComplete } from "@/lib/setup-state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return noStoreJson({
    environment: getSetupEnvironmentStatus(),
    installed: await isSetupComplete(),
  });
}
