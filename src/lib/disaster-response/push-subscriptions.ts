import type { PushSubscription } from "web-push";
import { getDatabase, withDatabaseWriteTransaction } from "@/lib/points-db";
import { allSqlite, runSqlite } from "@/lib/sqlite";

export type PushSubscriptionLocale = "en" | "ko";

export type StoredPushSubscription = PushSubscription & {
  locale: PushSubscriptionLocale;
};

type PushSubscriptionRow = {
  locale: string;
  subscription_json: string;
};

function isValidKey(value: unknown) {
  return typeof value === "string" && value.length >= 16 && value.length <= 512;
}

export function normalizePushSubscription(
  value: unknown,
  locale: unknown,
): StoredPushSubscription | null {
  if (!value || typeof value !== "object") return null;

  const candidate = value as Partial<PushSubscription>;
  const endpoint = candidate.endpoint?.trim();
  const keys = candidate.keys;

  if (!endpoint || endpoint.length > 2_048 || !keys) return null;

  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return null;
  }

  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    !isValidKey(keys.auth) ||
    !isValidKey(keys.p256dh)
  ) {
    return null;
  }

  return {
    endpoint: url.toString(),
    expirationTime:
      typeof candidate.expirationTime === "number"
        ? candidate.expirationTime
        : null,
    keys: {
      auth: keys.auth,
      p256dh: keys.p256dh,
    },
    locale: locale === "en" ? "en" : "ko",
  };
}

export async function listPushSubscriptions() {
  const db = await getDatabase();
  const rows = await allSqlite<PushSubscriptionRow>(
    db,
    `SELECT subscription_json, locale
      FROM incident_push_subscriptions
      ORDER BY created_at`,
  );

  return rows.flatMap((row) => {
    try {
      const subscription = normalizePushSubscription(
        JSON.parse(row.subscription_json),
        row.locale,
      );
      return subscription ? [subscription] : [];
    } catch {
      return [];
    }
  });
}

export async function savePushSubscription(
  subscription: StoredPushSubscription,
) {
  await withDatabaseWriteTransaction((db) =>
    runSqlite(
      db,
      `INSERT INTO incident_push_subscriptions (
        endpoint,
        subscription_json,
        locale,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT(endpoint) DO UPDATE SET
        subscription_json = excluded.subscription_json,
        locale = excluded.locale,
        updated_at = CURRENT_TIMESTAMP`,
      [
        subscription.endpoint,
        JSON.stringify({
          endpoint: subscription.endpoint,
          expirationTime: subscription.expirationTime,
          keys: subscription.keys,
        }),
        subscription.locale,
      ],
    ),
  );
}

export async function deletePushSubscription(endpoint: string) {
  if (!endpoint || endpoint.length > 2_048) return;

  await withDatabaseWriteTransaction(async (db) => {
    await runSqlite(
      db,
      "DELETE FROM incident_push_subscriptions WHERE endpoint = ?",
      [endpoint],
    );
  });
}
