import { getNaverGeocodingUsage } from "@/lib/points-db";

export const runtime = "nodejs";

export async function GET() {
  const quota = await getNaverGeocodingUsage();

  return Response.json({ quota });
}
