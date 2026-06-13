import { noStoreJson } from "@/lib/http";
import {
  deleteSetupDatabaseFile,
  getSetupEnvironmentStatus,
  isSetupCompleteFromDatabaseFile,
} from "@/lib/setup-state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const serverReceivedAt = new Date();

  return noStoreJson({
    environment: await getSetupEnvironmentStatus({ serverReceivedAt }),
    installed: await isSetupCompleteFromDatabaseFile(),
  });
}

export async function DELETE() {
  try {
    await deleteSetupDatabaseFile();
  } catch {
    return noStoreJson(
      { errorKey: "environment.sqlite.deleteFailed", ok: false },
      { status: 400 },
    );
  }

  const serverReceivedAt = new Date();

  return noStoreJson({
    environment: await getSetupEnvironmentStatus({ serverReceivedAt }),
    installed: await isSetupCompleteFromDatabaseFile(),
    ok: true,
  });
}
