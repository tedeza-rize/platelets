import { noStoreJson } from "@/lib/http";
import { withDatabaseWriteTransaction } from "@/lib/points-db-modules/connection";

type Bucket = {
  count: number;
  expiresAt: number;
};

const buckets = new Map<string, Bucket>();
let lastCleanupAt = 0;

function clientKey(request: Request) {
  const forwarded = request.headers
    .get("x-forwarded-for")
    ?.split(",")[0]
    ?.trim();
  return forwarded || request.headers.get("x-real-ip")?.trim() || "local";
}

function rateLimitResponse(retryAfterSeconds: number) {
  return noStoreJson(
    { errorCode: "rate_limited" },
    {
      headers: {
        "Retry-After": String(retryAfterSeconds),
      },
      status: 429,
    },
  );
}

export function enforceRateLimit(
  request: Request,
  options: { bucket: string; limit: number; windowMs: number },
) {
  const now = Date.now();

  if (now - lastCleanupAt > 60_000) {
    lastCleanupAt = now;
    for (const [key, value] of buckets) {
      if (value.expiresAt <= now) buckets.delete(key);
    }
  }

  const key = `${options.bucket}:${clientKey(request)}`;
  const current = buckets.get(key);
  const bucket =
    current && current.expiresAt > now
      ? current
      : { count: 0, expiresAt: now + options.windowMs };
  bucket.count += 1;
  buckets.set(key, bucket);

  if (bucket.count <= options.limit) {
    return null;
  }

  return rateLimitResponse(
    Math.max(1, Math.ceil((bucket.expiresAt - now) / 1000)),
  );
}

export async function enforceSharedRateLimit(
  request: Request,
  options: { bucket: string; limit: number; windowMs: number },
) {
  const now = Date.now();
  const key = `${options.bucket}:${clientKey(request)}`;
  const nowIso = new Date(now).toISOString();
  const nextExpiresAt = new Date(now + options.windowMs).toISOString();

  try {
    return await enforceSharedRateLimitTransaction({
      key,
      nextExpiresAt,
      now,
      nowIso,
      options,
    });
  } catch {
    // Fail open: a transient database error must not lock operators out of
    // critical endpoints (e.g. login). The in-memory limiter never threw, and
    // matching that behaviour is safer than turning a DB hiccup into a 500.
    return null;
  }
}

function enforceSharedRateLimitTransaction({
  key,
  nextExpiresAt,
  now,
  nowIso,
  options,
}: {
  key: string;
  nextExpiresAt: string;
  now: number;
  nowIso: string;
  options: { bucket: string; limit: number; windowMs: number };
}) {
  return withDatabaseWriteTransaction(async (db) => {
    const row = await db.get<{ count: number; expires_at: string }>(
      "SELECT count, expires_at FROM rate_limit_buckets WHERE bucket_key = ?",
      [key],
    );
    const expiresAt = row ? Date.parse(row.expires_at) : 0;

    if (!row) {
      await db.run(
        `INSERT INTO rate_limit_buckets
          (bucket_key, count, expires_at, updated_at)
          VALUES (?, ?, ?, ?)`,
        [key, 1, nextExpiresAt, nowIso],
      );
      return null;
    }

    if (Number.isNaN(expiresAt) || expiresAt <= now) {
      await db.run(
        `UPDATE rate_limit_buckets
          SET count = ?,
              expires_at = ?,
              updated_at = ?
          WHERE bucket_key = ?`,
        [1, nextExpiresAt, nowIso, key],
      );
      return null;
    }

    const nextCount = row.count + 1;
    await db.run(
      `UPDATE rate_limit_buckets
        SET count = ?,
            updated_at = ?
        WHERE bucket_key = ?`,
      [nextCount, nowIso, key],
    );

    if (nextCount <= options.limit) {
      return null;
    }

    return rateLimitResponse(Math.max(1, Math.ceil((expiresAt - now) / 1000)));
  });
}
