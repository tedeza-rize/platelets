import { noStoreJson } from "@/lib/http";
import { getServerTimeStatus } from "@/lib/time-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const serverReceivedAt = new Date();
  const status = await getServerTimeStatus({ serverReceivedAt });

  return noStoreJson(status);
}
