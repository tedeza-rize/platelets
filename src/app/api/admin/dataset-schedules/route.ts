import { requireAccessRole } from "@/lib/access-control";
import {
  getDatasetScheduleSettings,
  saveDatasetScheduleSettings,
} from "@/lib/dataset-scheduler";
import { noStoreJson } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return noStoreJson({ schedules: await getDatasetScheduleSettings() });
}

export async function PUT(request: Request) {
  const [, accessError] = await requireAccessRole(request, "sudo");
  if (accessError !== null) {
    return noStoreJson(
      { error: accessError.message },
      { status: accessError.code === "unauthorized" ? 401 : 403 },
    );
  }

  const payload = (await request.json().catch(() => null)) as {
    schedules?: unknown;
  } | null;

  if (!payload?.schedules) {
    return noStoreJson({ error: "schedules is required." }, { status: 400 });
  }

  return noStoreJson({
    schedules: await saveDatasetScheduleSettings(payload.schedules),
  });
}
