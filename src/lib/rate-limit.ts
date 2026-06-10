import { noStoreJson } from "@/lib/http";

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

  return noStoreJson(
    { error: "요청이 너무 많습니다. 잠시 후 다시 시도하세요." },
    {
      headers: {
        "Retry-After": String(
          Math.max(1, Math.ceil((bucket.expiresAt - now) / 1000)),
        ),
      },
      status: 429,
    },
  );
}
