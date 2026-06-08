import { noStoreJson } from "@/lib/http";
import { getNaverGeocodingUsage } from "@/lib/points-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const quota = await getNaverGeocodingUsage();

  return noStoreJson({ quota });
}
