import assert from "node:assert/strict";
import test from "node:test";
import {
  assertWebhookUrlSafe,
  sendIncidentWebhooks,
} from "@/lib/disaster-response/incident-alerts";
import type { Incident } from "@/lib/disaster-response/types";

const incident: Incident = {
  address: "Seoul City Hall",
  createdAt: "2026-06-13T00:00:00.000Z",
  description: "Test incident",
  id: "inc-alert-test",
  latitude: 37.5665,
  longitude: 126.978,
  occurredAt: "2026-06-13T00:00:00.000Z",
  riskLevel: "high",
  status: "reported",
  title: "Alert test",
  type: "fire",
};

test("webhook validation rejects private network destinations", async () => {
  await assert.rejects(
    assertWebhookUrlSafe("https://hooks.example.com/path", async () => [
      { address: "127.0.0.1" },
    ]),
    /unsafe-webhook-address/,
  );
  await assert.rejects(
    assertWebhookUrlSafe("https://localhost/path", async () => [
      { address: "203.0.113.10" },
    ]),
    /unsafe-webhook-url/,
  );
});

test("incident webhooks use provider-specific payloads", async () => {
  const requests: Array<{ body: string; url: string }> = [];
  const delivered = await sendIncidentWebhooks(
    incident,
    [
      "https://hooks.slack.com/services/test",
      "https://discord.com/api/webhooks/test",
    ],
    {
      fetcher: async (url, init) => {
        requests.push({ body: String(init.body), url });
        return { ok: true };
      },
      resolveAddresses: async () => [{ address: "203.0.113.10" }],
    },
  );

  assert.equal(delivered, 2);
  assert.equal("text" in JSON.parse(requests[0].body), true);
  assert.equal("content" in JSON.parse(requests[1].body), true);
  assert.equal(requests[0].url.startsWith("https://hooks.slack.com/"), true);
});
