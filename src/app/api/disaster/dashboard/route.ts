import { mapService } from "@/lib/disaster-response/map-service";
import { noStoreJson } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return noStoreJson(await mapService.getDashboardSnapshot());
}
