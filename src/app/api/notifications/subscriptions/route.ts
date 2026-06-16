import {
  deletePushSubscription,
  normalizePushSubscription,
  savePushSubscription,
} from "@/lib/disaster-response/push-subscriptions";
import { noStoreJson } from "@/lib/http";
import { enforceSharedRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const limited = await enforceSharedRateLimit(request, {
    bucket: "push-subscriptions",
    limit: 20,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const payload = (await request.json().catch(() => null)) as {
    locale?: unknown;
    subscription?: unknown;
  } | null;
  const subscription = normalizePushSubscription(
    payload?.subscription,
    payload?.locale,
  );

  if (!subscription) {
    return noStoreJson({ error: "invalid-subscription" }, { status: 400 });
  }

  await savePushSubscription(subscription);
  return noStoreJson({ saved: true }, { status: 201 });
}

export async function DELETE(request: Request) {
  const limited = await enforceSharedRateLimit(request, {
    bucket: "push-subscriptions",
    limit: 20,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const payload = (await request.json().catch(() => null)) as {
    endpoint?: unknown;
  } | null;

  if (typeof payload?.endpoint !== "string") {
    return noStoreJson({ error: "invalid-subscription" }, { status: 400 });
  }

  await deletePushSubscription(payload.endpoint);
  return noStoreJson({ deleted: true });
}
