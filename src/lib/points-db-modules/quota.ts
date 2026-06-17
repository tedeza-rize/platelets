import {
  getDatabaseRow as get,
  runDatabase as run,
} from "@/lib/database/query";
import type { DatabaseClient } from "@/lib/database/types";
import {
  getDatabase,
  withDatabaseWriteTransaction,
} from "@/lib/points-db-modules/connection";
import { nextKstMidnight } from "@/lib/points-db-modules/sql-utils";
import type { ApiUsageWindow } from "@/lib/points-db-types";

const KMA_EARTHQUAKE_DAILY_LIMIT = 5_000;
const KAKAO_LOCAL_DAILY_LIMIT = 100_000;

type ApiUsageWindowRow = {
  monthly_limit: number;
  provider: ApiUsageWindow["provider"];
  registered_at: string | null;
  updated_at: string | null;
  used_count: number;
  window_ends_at: string | null;
  window_started_at: string | null;
};

function emptyKakaoLocalUsageWindow(): ApiUsageWindow {
  return {
    monthlyLimit: KAKAO_LOCAL_DAILY_LIMIT,
    provider: "kakao-local",
    registeredAt: null,
    updatedAt: null,
    usedCount: 0,
    windowEndsAt: null,
    windowStartedAt: null,
  };
}

function emptyKmaEarthquakeUsageWindow(): ApiUsageWindow {
  return {
    monthlyLimit: KMA_EARTHQUAKE_DAILY_LIMIT,
    provider: "kma-earthquake",
    registeredAt: null,
    updatedAt: null,
    usedCount: 0,
    windowEndsAt: null,
    windowStartedAt: null,
  };
}

function mapUsageWindowRow(row: ApiUsageWindowRow): ApiUsageWindow {
  return {
    monthlyLimit: row.monthly_limit,
    provider: row.provider,
    registeredAt: row.registered_at,
    updatedAt: row.updated_at,
    usedCount: row.used_count,
    windowEndsAt: row.window_ends_at,
    windowStartedAt: row.window_started_at,
  };
}

async function getKakaoLocalUsageWindowRow(db: DatabaseClient) {
  return get<ApiUsageWindowRow>(
    db,
    "SELECT * FROM api_usage_windows WHERE provider = ?",
    ["kakao-local"],
  );
}

async function getKmaEarthquakeUsageWindowRow(db: DatabaseClient) {
  return get<ApiUsageWindowRow>(
    db,
    "SELECT * FROM api_usage_windows WHERE provider = ?",
    ["kma-earthquake"],
  );
}

export async function getKakaoLocalUsage() {
  const db = await getDatabase();
  const row = await getKakaoLocalUsageWindowRow(db);

  return row ? mapUsageWindowRow(row) : emptyKakaoLocalUsageWindow();
}

export async function getKmaEarthquakeUsage() {
  const db = await getDatabase();
  const row = await getKmaEarthquakeUsageWindowRow(db);

  return row ? mapUsageWindowRow(row) : emptyKmaEarthquakeUsageWindow();
}

export async function consumeKakaoLocalQuota() {
  const now = new Date();
  const nowIso = now.toISOString();
  await withDatabaseWriteTransaction(async (db) => {
    const existing = await getKakaoLocalUsageWindowRow(db);
    const shouldReset =
      existing?.window_ends_at && now >= new Date(existing.window_ends_at);
    const windowStartedAt =
      existing && !shouldReset ? existing.window_started_at : nowIso;
    const registeredAt = existing?.registered_at ?? nowIso;
    const windowEndsAt =
      existing && !shouldReset && existing.window_ends_at
        ? existing.window_ends_at
        : nextKstMidnight(now).toISOString();
    const currentUsedCount = existing && !shouldReset ? existing.used_count : 0;

    if (currentUsedCount >= KAKAO_LOCAL_DAILY_LIMIT) {
      throw new Error("Kakao Local API daily request quota exceeded");
    }

    await run(
      db,
      `INSERT INTO api_usage_windows (
        provider,
        registered_at,
        window_started_at,
        window_ends_at,
        used_count,
        monthly_limit,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(provider) DO UPDATE SET
        registered_at = excluded.registered_at,
        window_started_at = excluded.window_started_at,
        window_ends_at = excluded.window_ends_at,
        used_count = excluded.used_count,
        monthly_limit = excluded.monthly_limit,
        updated_at = CURRENT_TIMESTAMP`,
      [
        "kakao-local",
        registeredAt,
        windowStartedAt,
        windowEndsAt,
        currentUsedCount + 1,
        KAKAO_LOCAL_DAILY_LIMIT,
      ],
    );
  });

  return getKakaoLocalUsage();
}

export async function consumeKmaEarthquakeQuota(requestCount = 1) {
  const now = new Date();
  const nowIso = now.toISOString();
  await withDatabaseWriteTransaction(async (db) => {
    const existing = await getKmaEarthquakeUsageWindowRow(db);
    const shouldReset =
      existing?.window_ends_at && now >= new Date(existing.window_ends_at);
    const windowStartedAt =
      existing && !shouldReset ? existing.window_started_at : nowIso;
    const registeredAt = existing?.registered_at ?? nowIso;
    const windowEndsAt =
      existing && !shouldReset && existing.window_ends_at
        ? existing.window_ends_at
        : nextKstMidnight(now).toISOString();
    const currentUsedCount = existing && !shouldReset ? existing.used_count : 0;

    if (currentUsedCount + requestCount > KMA_EARTHQUAKE_DAILY_LIMIT) {
      throw new Error("KMA earthquake daily request quota exceeded");
    }

    await run(
      db,
      `INSERT INTO api_usage_windows (
        provider,
        registered_at,
        window_started_at,
        window_ends_at,
        used_count,
        monthly_limit,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(provider) DO UPDATE SET
        registered_at = excluded.registered_at,
        window_started_at = excluded.window_started_at,
        window_ends_at = excluded.window_ends_at,
        used_count = excluded.used_count,
        monthly_limit = excluded.monthly_limit,
        updated_at = CURRENT_TIMESTAMP`,
      [
        "kma-earthquake",
        registeredAt,
        windowStartedAt,
        windowEndsAt,
        currentUsedCount + requestCount,
        KMA_EARTHQUAKE_DAILY_LIMIT,
      ],
    );
  });

  return getKmaEarthquakeUsage();
}
