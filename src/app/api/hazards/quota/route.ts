import { noStoreJson } from "@/lib/http";
import { getKmaEarthquakeUsage } from "@/lib/points-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const quota = await getKmaEarthquakeUsage();

  return noStoreJson({ quota });
}
