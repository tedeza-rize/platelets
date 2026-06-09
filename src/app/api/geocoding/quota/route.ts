import { noStoreJson } from "@/lib/http";
import { getKakaoLocalUsage } from "@/lib/points-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const quota = await getKakaoLocalUsage();

  return noStoreJson({ quota });
}
