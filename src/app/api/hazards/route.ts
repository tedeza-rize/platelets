import { noStoreJson } from "@/lib/http";
import { listHazardEvents } from "@/lib/points-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const events = await listHazardEvents();

  return noStoreJson({
    events,
    serverTime: new Date().toISOString(),
  });
}
