import { noStoreJson } from "@/lib/http";
import { getServerTimeStatus } from "@/lib/time-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const status = await getServerTimeStatus();

  return noStoreJson(status);
}
