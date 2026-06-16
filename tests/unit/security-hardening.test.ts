import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { setDataDirectoryPathForTests } from "@/lib/data-paths";
import nextConfig from "../../next.config.ts";

const dataDirectory = mkdtempSync(path.join(tmpdir(), "platelets-security-"));
setDataDirectoryPathForTests(dataDirectory);

const pointsDb = await import("@/lib/points-db");
const setupState = await import("@/lib/setup-state");
const authSessions = await import("@/lib/auth-sessions");
const loginRoute = await import("@/app/api/auth/login/route");
const aiRoute = await import("@/app/api/ai/query/route");

test.after(async () => {
  await pointsDb.closeDatabase();
});

const adminPassword = "StrongAdminPass1!";
const sudoPassword = "StrongSudoPass1!";

async function ensureSetup() {
  if (await setupState.isSetupComplete()) return;

  await setupState.completeSetup({
    admin: {
      email: "admin@example.com",
      fullName: "Setup Admin",
      password: adminPassword,
    },
    apiKeys: {
      openaiApiKey: "sk-test",
    },
    licenseAccepted: true,
    sudo: {
      email: "sudo@example.com",
      fullName: "Setup Sudo",
      password: sudoPassword,
    },
  });
}

function loginRequest(url: string, headers: Record<string, string> = {}) {
  return new Request(url, {
    body: JSON.stringify({ password: adminPassword, username: "admin" }),
    headers: {
      "content-type": "application/json",
      ...headers,
    },
    method: "POST",
  });
}

test("access sessions use indexed rows without losing concurrent logins", async () => {
  await ensureSetup();
  const [adminSession, sudoSession] = await Promise.all([
    authSessions.createAccessSession(adminPassword, "admin"),
    authSessions.createAccessSession(sudoPassword, "sudo"),
  ]);

  assert.ok(adminSession);
  assert.ok(sudoSession);
  assert.equal(
    (await authSessions.getAccessSession(adminSession.token))?.username,
    "admin",
  );
  assert.equal(
    (await authSessions.getAccessSession(sudoSession.token))?.username,
    "sudo",
  );
});

test("login cookies add Secure for HTTPS deployments", async () => {
  await ensureSetup();
  const secureResponse = await loginRoute.POST(
    loginRequest("http://platelets.local/api/auth/login", {
      "x-forwarded-proto": "https",
    }),
  );
  const localResponse = await loginRoute.POST(
    loginRequest("http://platelets.local/api/auth/login"),
  );

  assert.match(secureResponse.headers.get("set-cookie") ?? "", /Secure/);
  assert.doesNotMatch(localResponse.headers.get("set-cookie") ?? "", /Secure/);
});

test("next config applies baseline security headers globally", async () => {
  const headerRules = await nextConfig.headers?.();
  const globalRule = headerRules?.find((rule) => rule.source === "/:path*");
  const headers = new Map(
    globalRule?.headers.map((header) => [header.key, header.value]),
  );

  assert.match(
    headers.get("Content-Security-Policy") ?? "",
    /frame-ancestors 'none'/,
  );
  assert.equal(
    headers.get("Referrer-Policy"),
    "strict-origin-when-cross-origin",
  );
  assert.match(headers.get("Permissions-Policy") ?? "", /geolocation=\(self\)/);
  assert.equal(headers.get("X-Content-Type-Options"), "nosniff");
  assert.equal(headers.get("X-Frame-Options"), "DENY");
});

test("AI provider failures return stable public errors", async () => {
  await ensureSetup();
  await pointsDb.setAppSetting("ai-settings", {
    baseUrl: "https://127.0.0.1/v1",
    model: "gpt-test",
  });
  const session = await authSessions.createAccessSession(
    adminPassword,
    "admin",
  );
  assert.ok(session);
  const originalError = console.error;
  console.error = () => undefined;

  try {
    const response = await aiRoute.POST(
      new Request("http://platelets.local/api/ai/query", {
        body: JSON.stringify({ question: "Summarize current response data." }),
        headers: {
          "content-type": "application/json",
          cookie: `${authSessions.SESSION_COOKIE_NAME}=${session.token}`,
        },
        method: "POST",
      }),
    );
    const payload = (await response.json()) as {
      error?: string;
      errorCode?: string;
    };

    assert.equal(response.status, 502);
    assert.equal(payload.errorCode, "ai_provider_unavailable");
    assert.equal(payload.error, undefined);
  } finally {
    console.error = originalError;
  }
});
