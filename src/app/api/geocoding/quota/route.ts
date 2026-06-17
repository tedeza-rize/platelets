import { requireAccessRole } from "@/lib/access-control";
import { noStoreJson } from "@/lib/http";
import { getKakaoLocalUsage } from "@/lib/points-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const [, accessError] = await requireAccessRole(request, "admin");

  if (accessError !== null) {
    return noStoreJson(
      { error: accessError.message },
      { status: accessError.code === "unauthorized" ? 401 : 403 },
    );
  }

  const quota = await getKakaoLocalUsage();

  return noStoreJson({ quota });
}
