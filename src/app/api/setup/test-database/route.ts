import {
  normalizeDatabaseConfig,
  testDatabaseConfig,
} from "@/lib/database/config";
import { noStoreJson } from "@/lib/http";
import { isSetupComplete } from "@/lib/setup-state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (await isSetupComplete()) {
    return noStoreJson(
      { errorKey: "database.alreadyInstalled", ok: false },
      { status: 409 },
    );
  }

  const payload = await request.json().catch(() => null);

  try {
    const database = normalizeDatabaseConfig(payload?.database ?? payload);
    await testDatabaseConfig(database);
    return noStoreJson({ ok: true });
  } catch {
    return noStoreJson(
      { errorKey: "database.failed", ok: false },
      { status: 400 },
    );
  }
}
