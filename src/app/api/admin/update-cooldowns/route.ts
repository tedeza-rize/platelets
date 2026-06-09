import { requireAccessRole } from "@/lib/access-control";
import { DATASET_SOURCES } from "@/lib/dataset-sources";
import { noStoreJson } from "@/lib/http";
import {
  ADMIN_UPDATE_COOLDOWN_MS,
  getAdminUpdateCooldowns,
} from "@/lib/points-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const forbidden = requireAccessRole(request, "sudo");

  if (forbidden) {
    return forbidden;
  }

  const url = new URL(request.url);
  const requestedActions = url.searchParams.getAll("action");
  const actions =
    requestedActions.length > 0
      ? requestedActions
      : [
          ...Object.keys(DATASET_SOURCES).map((source) => `dataset:${source}`),
          "hazards",
        ];
  const cooldowns = await getAdminUpdateCooldowns(actions);

  return noStoreJson({
    cooldownMs: ADMIN_UPDATE_COOLDOWN_MS,
    cooldowns,
  });
}
