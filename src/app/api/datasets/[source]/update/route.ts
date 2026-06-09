import { requireAccessRole } from "@/lib/access-control";
import { updateDataset } from "@/lib/dataset-import";
import { isDatasetSourceId } from "@/lib/dataset-sources";
import { noStoreJson } from "@/lib/http";
import {
  AdminUpdateCooldownError,
  assertAdminUpdateAvailable,
  recordAdminUpdateUsed,
} from "@/lib/points-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ source: string }> },
) {
  const forbidden = requireAccessRole(request, "sudo");

  if (forbidden) {
    return forbidden;
  }

  const { source } = await context.params;

  if (!isDatasetSourceId(source)) {
    return noStoreJson({ error: "Unknown source" }, { status: 404 });
  }

  const action = `dataset:${source}`;

  try {
    await assertAdminUpdateAvailable(action);
    const dataset = await updateDataset(source);
    await recordAdminUpdateUsed(action);

    return noStoreJson({ dataset });
  } catch (error) {
    if (error instanceof AdminUpdateCooldownError) {
      return noStoreJson(
        {
          cooldown: error.cooldown,
          error: "Update cooldown is active.",
        },
        { status: 429 },
      );
    }

    throw error;
  }
}
