import { requireAccessRole } from "@/lib/access-control";
import { updateAllDatasets } from "@/lib/dataset-import";
import { DATASET_SOURCES } from "@/lib/dataset-sources";
import { noStoreJson } from "@/lib/http";
import {
  assertAdminUpdateAvailable,
  listDatasetStatuses,
  recordAdminUpdateUsed,
} from "@/lib/points-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const datasets = await listDatasetStatuses();

  return noStoreJson({ datasets });
}

export async function POST(request: Request) {
  const [, accessError] = await requireAccessRole(request, "sudo");

  if (accessError !== null) {
    return noStoreJson(
      { error: accessError.message },
      { status: accessError.code === "unauthorized" ? 401 : 403 },
    );
  }

  const actions = Object.keys(DATASET_SOURCES).map(
    (source) => `dataset:${source}`,
  );

  for (const action of actions) {
    const [, error] = await assertAdminUpdateAvailable(action);
    if (error !== null) {
      return noStoreJson(
        {
          cooldown: error.cooldown,
          error: "Update cooldown is active.",
        },
        { status: 429 },
      );
    }
  }

  const datasets = await updateAllDatasets();

  for (const action of actions) {
    await recordAdminUpdateUsed(action);
  }

  return noStoreJson({ datasets });
}
