import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { setDataDirectoryPathForTests } from "@/lib/data-paths";

setDataDirectoryPathForTests(
  mkdtempSync(path.join(tmpdir(), "platelets-integrations-")),
);

const pointsDb = await import("@/lib/points-db");
const integrationSettings = await import("@/lib/integration-settings");
const runtimeConfig = await import("@/lib/runtime-config");
const setupState = await import("@/lib/setup-state");

await setupState.completeSetup({
  admin: {
    email: "admin@example.com",
    fullName: "Test Admin",
    password: "StrongAdminPass1!",
  },
  apiKeys: {},
  licenseAccepted: true,
  sudo: {
    email: "sudo@example.com",
    fullName: "Test Sudo",
    password: "StrongSudoPass1!",
  },
});

test("runtime API keys come only from encrypted setup settings", async () => {
  process.env.KAKAO_REST_API_KEY = "ignored-environment-key";

  try {
    assert.equal((await runtimeConfig.getRuntimeApiKeys()).kakaoRestApiKey, "");

    await setupState.saveConfiguredApiKeys({
      kakaoRestApiKey: "stored-kakao-key",
    });

    assert.equal(
      (await runtimeConfig.getRuntimeApiKeys()).kakaoRestApiKey,
      "stored-kakao-key",
    );
  } finally {
    delete process.env.KAKAO_REST_API_KEY;
  }
});

test("integration secrets are encrypted and support explicit clearing", async () => {
  await integrationSettings.saveIntegrationSettings({
    fireSafetyApiKey: "stored-fire-safety-key",
    incidentWebhookUrls: "https://hooks.example.com/secret-token",
    itsOpenApiKey: "stored-its-key",
    webPushContact: "mailto:operations@example.com",
    webPushPrivateKey: "private-key",
    webPushPublicKey: "public-key",
  });

  const configured = await integrationSettings.getIntegrationSettings();
  const stored = await pointsDb.getAppSetting<unknown>(
    "integration-settings",
    null,
  );

  assert.equal(configured.fireSafetyApiKey, "stored-fire-safety-key");
  assert.equal(configured.itsOpenApiKey, "stored-its-key");
  assert.equal(configured.incidentWebhookUrls.length, 1);
  assert.equal(
    JSON.stringify(stored).includes("stored-fire-safety-key"),
    false,
  );
  assert.equal(JSON.stringify(stored).includes("stored-its-key"), false);
  assert.equal(JSON.stringify(stored).includes("secret-token"), false);

  const summary = await integrationSettings.saveIntegrationSettings({
    clear: ["fireSafetyApiKey", "incidentWebhookUrls", "itsOpenApiKey"],
  });

  assert.equal(summary.fireSafetyApiKeyConfigured, false);
  assert.equal(summary.incidentWebhookCount, 0);
  assert.equal(summary.itsOpenApiKeyConfigured, false);
});

test("integration secrets can be seeded from temporary environment aliases", async () => {
  process.env["FIRE-SAFTY-API-KEY"] = "env-fire-key";
  process.env["ITS-API-KEY"] = "env-its-key";

  try {
    const settings = await integrationSettings.getIntegrationSettings();
    const stored = await pointsDb.getAppSetting<unknown>(
      "integration-settings",
      null,
    );

    assert.equal(settings.fireSafetyApiKey, "env-fire-key");
    assert.equal(settings.itsOpenApiKey, "env-its-key");
    assert.equal(JSON.stringify(stored).includes("env-fire-key"), false);
    assert.equal(JSON.stringify(stored).includes("env-its-key"), false);
  } finally {
    process.env["FIRE-SAFTY-API-KEY"] = undefined;
    process.env["ITS-API-KEY"] = undefined;
    await integrationSettings.saveIntegrationSettings({
      clear: ["fireSafetyApiKey", "itsOpenApiKey"],
    });
  }
});

test.after(async () => {
  await pointsDb.closeDatabase();
});
