import { updateAllDatasets } from "@/lib/dataset-import";
import { DATASET_SOURCES } from "@/lib/dataset-sources";
import { noStoreJson } from "@/lib/http";
import {
  AdminUpdateCooldownError,
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

export async function POST() {
  const actions = Object.keys(DATASET_SOURCES).map(
    (source) => `dataset:${source}`,
  );

  try {
    for (const action of actions) {
      await assertAdminUpdateAvailable(action);
    }

    const datasets = await updateAllDatasets();

    for (const action of actions) {
      await recordAdminUpdateUsed(action);
    }

    return noStoreJson({ datasets });
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
