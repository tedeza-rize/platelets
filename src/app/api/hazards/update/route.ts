import { updateHazardEvents } from "@/lib/hazard-events";
import { noStoreJson } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const result = await updateHazardEvents();

  return noStoreJson({ result });
}
