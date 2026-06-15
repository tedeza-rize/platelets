import { getWebPushConfig } from "@/lib/disaster-response/incident-alerts";
import { noStoreJson } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const config = await getWebPushConfig();

  return noStoreJson({
    enabled: config.enabled,
    publicKey: config.enabled ? config.publicKey : "",
  });
}
