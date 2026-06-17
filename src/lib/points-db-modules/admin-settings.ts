import {
  allDatabase as all,
  getDatabaseRow as get,
  runDatabase as run,
} from "@/lib/database/query";
import type { DatasetUpdateProgress } from "@/lib/dataset-progress";
import type { DatasetSourceId } from "@/lib/dataset-sources";
import { getDatabase } from "@/lib/points-db-modules/connection";
import { buildSqlPlaceholders } from "@/lib/points-db-modules/sql-utils";
import type { AdminUpdateCooldown } from "@/lib/points-db-types";
import { fail, type GoResult, ok } from "@/shared/result";

export const ADMIN_UPDATE_COOLDOWN_MS = 5 * 60 * 1000;
const DATASET_PROGRESS_SETTING_PREFIX = "dataset-update-progress:";

type AdminUpdateCooldownRow = {
  action: string;
  last_used_at: string;
  updated_at: string;
};

type AppSettingRow = {
  key: string;
  updated_at: string;
  value_json: string;
};

function mapAdminUpdateCooldownRow(
  action: string,
  row: AdminUpdateCooldownRow | undefined,
  cooldownMs: number,
): AdminUpdateCooldown {
  const lastUsedAt = row?.last_used_at ?? null;
  const nextAvailableAt = lastUsedAt
    ? new Date(new Date(lastUsedAt).getTime() + cooldownMs).toISOString()
    : null;
  const remainingMs = nextAvailableAt
    ? Math.max(0, new Date(nextAvailableAt).getTime() - Date.now())
    : 0;

  return {
    action,
    available: remainingMs === 0,
    cooldownMs,
    lastUsedAt,
    nextAvailableAt,
    remainingMs,
  };
}

export class AdminUpdateCooldownError extends Error {
  cooldown: AdminUpdateCooldown;

  constructor(cooldown: AdminUpdateCooldown) {
    super("Admin update cooldown is active");
    this.cooldown = cooldown;
  }
}

export async function getAdminUpdateCooldowns(
  actions: string[],
  cooldownMs = ADMIN_UPDATE_COOLDOWN_MS,
) {
  const db = await getDatabase();

  if (actions.length === 0) {
    const rows = await all<AdminUpdateCooldownRow>(
      db,
      "SELECT * FROM admin_update_cooldowns ORDER BY action",
    );

    return rows.map((row) =>
      mapAdminUpdateCooldownRow(row.action, row, cooldownMs),
    );
  }

  const rows = await all<AdminUpdateCooldownRow>(
    db,
    `SELECT * FROM admin_update_cooldowns
      WHERE action IN (${buildSqlPlaceholders(actions.length)})`,
    actions,
  );
  const byAction = new Map(rows.map((row) => [row.action, row]));

  return actions.map((action) =>
    mapAdminUpdateCooldownRow(action, byAction.get(action), cooldownMs),
  );
}

export async function assertAdminUpdateAvailable(
  action: string,
): Promise<GoResult<void, AdminUpdateCooldownError>> {
  const [cooldown] = await getAdminUpdateCooldowns([action]);

  if (cooldown && !cooldown.available) {
    return fail(new AdminUpdateCooldownError(cooldown));
  }

  return ok(undefined);
}

export async function recordAdminUpdateUsed(action: string) {
  const db = await getDatabase();

  await run(
    db,
    `INSERT INTO admin_update_cooldowns (
      action,
      last_used_at,
      updated_at
    ) VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(action) DO UPDATE SET
      last_used_at = excluded.last_used_at,
      updated_at = CURRENT_TIMESTAMP`,
    [action, new Date().toISOString()],
  );
}

export async function getAppSetting<TValue>(
  key: string,
  fallback: TValue,
): Promise<TValue> {
  const db = await getDatabase();
  const row = await get<AppSettingRow>(
    db,
    "SELECT * FROM app_settings WHERE key = ?",
    [key],
  );

  if (!row) {
    return fallback;
  }

  try {
    return JSON.parse(row.value_json) as TValue;
  } catch {
    return fallback;
  }
}

export async function setAppSetting(key: string, value: unknown) {
  const db = await getDatabase();

  await run(
    db,
    `INSERT INTO app_settings (
      key,
      value_json,
      updated_at
    ) VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET
      value_json = excluded.value_json,
      updated_at = CURRENT_TIMESTAMP`,
    [key, JSON.stringify(value)],
  );
}

export async function setDatasetUpdateProgress(
  progress: Omit<DatasetUpdateProgress, "updatedAt">,
) {
  const value: DatasetUpdateProgress = {
    ...progress,
    percent: Math.min(100, Math.max(0, Math.round(progress.percent))),
    updatedAt: new Date().toISOString(),
  };

  await setAppSetting(
    `${DATASET_PROGRESS_SETTING_PREFIX}${progress.source}`,
    value,
  );

  return value;
}

export async function getDatasetUpdateProgress(source: DatasetSourceId) {
  return getAppSetting<DatasetUpdateProgress | null>(
    `${DATASET_PROGRESS_SETTING_PREFIX}${source}`,
    null,
  );
}
