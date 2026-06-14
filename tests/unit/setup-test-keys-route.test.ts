import assert from "node:assert/strict";
import test from "node:test";
import { POST } from "@/app/api/setup/test-keys/route";

async function postSetupKeys(payload: Record<string, unknown>) {
  const response = await POST(
    new Request("http://platelets.local/api/setup/test-keys", {
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    }),
  );

  return (await response.json()) as {
    checks: Array<{
      id: string;
      message: string;
      ok: boolean;
      skipped: boolean;
      title: string;
    }>;
    ok: boolean;
  };
}

test("setup API validation skips empty optional keys", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    throw new Error("empty key validation should not call fetch");
  }) as typeof fetch;

  try {
    const payload = await postSetupKeys({
      openaiBaseUrl: "https://api.openai.com/v1",
    });
    const vworld = payload.checks.find((check) => check.id === "vworld");

    assert.equal(payload.ok, true);
    assert.equal(vworld?.ok, true);
    assert.equal(vworld?.skipped, true);
    assert.equal(vworld?.message, "OSM fallback will be used.");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("setup API validation rejects non-HTTPS OpenAI-compatible URLs", async () => {
  const payload = await postSetupKeys({
    openaiApiKey: "sk-test",
    openaiBaseUrl: "http://example.com/v1",
  });
  const openai = payload.checks.find((check) => check.id === "openai");

  assert.equal(payload.ok, false);
  assert.equal(openai?.ok, false);
  assert.equal(openai?.message, "Base URL must be a valid HTTPS URL.");
});

test("setup API validation checks VWorld keys against the provider", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input) => {
    const url = String(input);

    assert.match(url, /api\.vworld\.kr\/req\/address/);
    assert.match(url, /key=vworld-test-key/);

    return Response.json({ response: { status: "OK" } });
  }) as typeof fetch;

  try {
    const payload = await postSetupKeys({ vworldApiKey: "vworld-test-key" });
    const vworld = payload.checks.find((check) => check.id === "vworld");

    assert.equal(payload.ok, true);
    assert.equal(vworld?.ok, true);
    assert.equal(vworld?.skipped, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
