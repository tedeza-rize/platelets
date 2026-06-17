import { requireAccessRole } from "@/lib/access-control";
import { DatasetImportPausedError, updateDataset } from "@/lib/dataset-import";
import { isDatasetSourceId } from "@/lib/dataset-sources";
import { noStoreJson } from "@/lib/http";
import {
  AdminUpdateCooldownError,
  assertAdminUpdateAvailable,
  getDatasetStatus,
  recordAdminUpdateUsed,
} from "@/lib/points-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function readUpdateMode(request: Request) {
  const payload = (await request.json().catch(() => null)) as {
    mode?: unknown;
  } | null;

  return payload?.mode === "resume" ? "resume" : "restart";
}

export async function POST(
  request: Request,
  context: { params: Promise<{ source: string }> },
) {
  const [, accessError] = await requireAccessRole(request, "sudo");
  if (accessError !== null) {
    return noStoreJson(
      { error: accessError.message },
      { status: accessError.code === "unauthorized" ? 401 : 403 },
    );
  }

  const { source } = await context.params;

  if (!isDatasetSourceId(source)) {
    return noStoreJson({ error: "Unknown source" }, { status: 404 });
  }

  const action = `dataset:${source}`;
  const mode = await readUpdateMode(request);

  try {
    await assertAdminUpdateAvailable(action);
    const dataset = await updateDataset(source, { mode });
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

    if (error instanceof DatasetImportPausedError) {
      const dataset = await getDatasetStatus(source);
      await recordAdminUpdateUsed(action);

      return noStoreJson(
        {
          dataset,
          error: error.message,
          paused: true,
        },
        { status: 202 },
      );
    }

    throw error;
  }
}
