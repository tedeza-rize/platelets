import { requireAccessRole } from "@/lib/access-control";
import { noStoreJson } from "@/lib/http";
import { getKmaEarthquakeUsage } from "@/lib/points-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const forbidden = requireAccessRole(request, "sudo");

  if (forbidden) {
    return forbidden;
  }

  const quota = await getKmaEarthquakeUsage();

  return noStoreJson({ quota });
}
