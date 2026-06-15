import { requireAccessRole } from "@/lib/access-control";
import {
  getDatabaseConfig,
  normalizeDatabaseConfig,
  testDatabaseConfig,
} from "@/lib/database/config";
import { migrateDatabase } from "@/lib/database/migration";
import { noStoreJson } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const forbidden = await requireAccessRole(request, "sudo");

  if (forbidden) {
    return forbidden;
  }

  return noStoreJson({ engine: getDatabaseConfig().engine });
}

export async function POST(request: Request) {
  const forbidden = await requireAccessRole(request, "sudo");

  if (forbidden) {
    return forbidden;
  }

  const payload = await request.json().catch(() => null);

  try {
    const target = normalizeDatabaseConfig(payload?.target ?? payload);
    return noStoreJson({
      ok: true,
      result: await migrateDatabase(target),
    });
  } catch {
    return noStoreJson(
      { errorKey: "databaseMigration.failed", ok: false },
      { status: 400 },
    );
  }
}

export async function PUT(request: Request) {
  const forbidden = await requireAccessRole(request, "sudo");

  if (forbidden) {
    return forbidden;
  }

  const payload = await request.json().catch(() => null);

  try {
    const target = normalizeDatabaseConfig(payload?.target ?? payload);
    await testDatabaseConfig(target);
    return noStoreJson({ ok: true });
  } catch {
    return noStoreJson(
      { errorKey: "databaseMigration.testFailed", ok: false },
      { status: 400 },
    );
  }
}
