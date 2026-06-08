import { updateHazardEvents } from "@/lib/hazard-events";
import { noStoreJson } from "@/lib/http";
import {
  AdminUpdateCooldownError,
  assertAdminUpdateAvailable,
  recordAdminUpdateUsed,
} from "@/lib/points-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    await assertAdminUpdateAvailable("hazards");
    const result = await updateHazardEvents();
    await recordAdminUpdateUsed("hazards");

    return noStoreJson({ result });
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
