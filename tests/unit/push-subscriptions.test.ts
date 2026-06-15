import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { setDataDirectoryPathForTests } from "@/lib/data-paths";

const dataDirectory = mkdtempSync(path.join(tmpdir(), "platelets-push-db-"));
setDataDirectoryPathForTests(dataDirectory);

const subscriptions = await import(
  "@/lib/disaster-response/push-subscriptions"
);

const validSubscription = {
  endpoint: "https://push.example.com/subscription/123",
  expirationTime: null,
  keys: {
    auth: "abcdefghijklmnopqrstuvwxyz",
    p256dh: "abcdefghijklmnopqrstuvwxyz0123456789",
  },
};

test("normalizePushSubscription rejects non-HTTPS endpoints", () => {
  assert.equal(
    subscriptions.normalizePushSubscription(
      { ...validSubscription, endpoint: "http://localhost/push" },
      "en",
    ),
    null,
  );
});

test("push subscriptions can be saved, listed, and deleted", async () => {
  const normalized = subscriptions.normalizePushSubscription(
    validSubscription,
    "en",
  );
  assert.ok(normalized);

  await subscriptions.savePushSubscription(normalized);
  assert.deepEqual(await subscriptions.listPushSubscriptions(), [normalized]);

  await subscriptions.deletePushSubscription(normalized.endpoint);
  assert.deepEqual(await subscriptions.listPushSubscriptions(), []);
});
