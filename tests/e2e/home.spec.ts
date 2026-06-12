import { expect, test } from "@playwright/test";

test.describe.configure({ mode: "serial" });

async function ensureSetupComplete(
  request: import("@playwright/test").APIRequestContext,
) {
  const status = await request.get("/api/setup/status");
  const statusPayload = (await status.json()) as { installed?: boolean };

  if (statusPayload.installed) {
    return;
  }

  const completed = await request.post("/api/setup/complete", {
    data: {
      admin: {
        email: "admin@example.com",
        fullName: "Setup Admin",
        password: "StrongAdminPass1!",
      },
      apiKeys: {
        openaiApiKey: "sk-test",
        openaiBaseUrl: "https://api.openai.com/v1",
      },
      licenseAccepted: true,
      sudo: {
        email: "sudo@example.com",
        fullName: "Setup Sudo",
        password: "StrongSudoPass1!",
      },
    },
  });

  expect(completed.ok()).toBeTruthy();
}

test("redirects protected pages to setup before installation", async ({
  browserName,
  page,
}) => {
  test.skip(
    browserName === "firefox",
    "first-run setup is verified once because CI browser projects share the same test server",
  );

  await page.goto("/admin", { waitUntil: "domcontentloaded" });

  await expect(page).toHaveURL(/\/setup$/);
  await expect(page.getByLabel("Platelets setup wizard")).toBeVisible();
});

test("redirects first-run deployments to the setup wizard", async ({
  browserName,
  page,
}) => {
  test.skip(
    browserName === "firefox",
    "first-run setup is verified once because CI browser projects share the same test server",
  );

  await page.goto("/", { waitUntil: "domcontentloaded" });

  await expect(page).toHaveURL(/\/setup$/);
  await expect(page.getByLabel("Platelets setup wizard")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Welcome to Platelets" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(
    page.getByRole("heading", { name: "License agreement" }),
  ).toBeVisible();
  await page
    .getByLabel("I have read and accept the Platelets setup terms.")
    .check();
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(
    page.getByRole("heading", { name: "Server environment check" }),
  ).toBeVisible();
  await expect(
    page.getByText("SQLite database", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(
    page.getByRole("heading", { name: "Create the sudo account" }),
  ).toBeVisible();
  await page.getByLabel("Full name").fill("Setup Sudo");
  await page.getByLabel("Email address").fill("sudo@example.com");
  await page.getByLabel("Password", { exact: true }).fill("StrongSudoPass1!");
  await page.getByLabel("Confirm password").fill("StrongSudoPass1!");
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(
    page.getByRole("heading", { name: "Create the admin account" }),
  ).toBeVisible();
  await page.getByLabel("Full name").fill("Setup Admin");
  await page.getByLabel("Email address").fill("admin@example.com");
  await page.getByLabel("Password", { exact: true }).fill("StrongAdminPass1!");
  await page.getByLabel("Confirm password").fill("StrongAdminPass1!");
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByRole("heading", { name: "API keys" })).toBeVisible();
  await page.getByLabel("OpenAI API key").fill("sk-test");
  await page.getByRole("button", { name: "Test API keys" }).click();
  await expect(
    page.getByText("API key configuration is ready to save."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(
    page.getByRole("heading", { name: "Create database" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Install" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText("Platelets 통합 재난 지도")).toBeVisible();
});

test("loads the integrated disaster response map", async ({
  page,
  request,
}) => {
  await ensureSetupComplete(request);
  await page.goto("/", { waitUntil: "domcontentloaded" });

  await expect(page.getByText("Platelets 통합 재난 지도")).toBeVisible();
  await expect(page.getByRole("button", { name: "대시보드" })).toBeVisible();
  await expect(page.getByRole("button", { name: "3D" })).toBeVisible();
  await expect(page.locator("canvas.maplibregl-canvas")).toBeVisible();
});

test("shows BigData119 operational evidence and resource recommendations", async ({
  page,
  request,
}) => {
  await ensureSetupComplete(request);
  await page.goto("/", { waitUntil: "domcontentloaded" });

  await expect(page.getByText("119 신고·출동 데이터")).toBeVisible({
    timeout: 15_000,
  });
  await expect(
    page.getByText("소방안전 빅데이터: 전북 119신고접수"),
  ).toBeVisible();

  await page.getByRole("button", { name: "자원배치" }).click();

  await expect(page.getByText("자원 배치 지원")).toBeVisible();
  await expect
    .poll(() => page.getByText(/위험도 \d+점/).count())
    .toBeGreaterThan(0);
  await expect
    .poll(() => page.getByText(/구조차 \d+대/).count())
    .toBeGreaterThan(0);
  await expect
    .poll(() => page.getByText(/119 신고·출동 운영 부하/).count())
    .toBeGreaterThan(0);
});

test("renders a dispatch road route when the route API succeeds", async ({
  page,
  request,
}) => {
  await ensureSetupComplete(request);
  await page.route("**/api/routing/route", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      json: {
        route: {
          coordinates: [
            [127.015, 37.5646],
            [127.001, 37.5655],
            [126.978, 37.5665],
          ],
          distanceMeters: 1234,
          durationSeconds: 180,
          provider: "astar",
        },
      },
      status: 200,
    });
  });

  await page.goto("/", { waitUntil: "domcontentloaded" });

  await expect(page.getByText("소방서 추천")).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText("자체 A* 도로 경로 1.2km · 3분")).toBeVisible({
    timeout: 15_000,
  });
});

test("incident API records create, edit, and status history", async ({
  request,
}) => {
  await ensureSetupComplete(request);
  const created = await request.post("/api/disaster/incidents", {
    data: {
      address: "서울특별시 중구 세종대로 110",
      description: "E2E 테스트용 사고입니다.",
      latitude: 37.5665,
      longitude: 126.978,
      occurredAt: new Date().toISOString(),
      riskLevel: "medium",
      title: "E2E 테스트 사고",
      type: "fire",
    },
  });
  expect(created.ok()).toBeTruthy();
  const createdPayload = (await created.json()) as {
    incident: { id: string; title: string };
  };
  const incidentId = createdPayload.incident.id;

  try {
    const edited = await request.patch(
      `/api/disaster/incidents/${incidentId}`,
      {
        data: {
          description: "수정된 E2E 테스트 사고입니다.",
          riskLevel: "high",
          title: "E2E 테스트 사고 수정",
        },
      },
    );
    expect(edited.ok()).toBeTruthy();

    const dispatched = await request.patch(
      `/api/disaster/incidents/${incidentId}`,
      { data: { status: "dispatched" } },
    );
    expect(dispatched.ok()).toBeTruthy();
    const dispatchedPayload = (await dispatched.json()) as {
      events: Array<{ type: string }>;
      incident: { status: string; title: string };
    };

    expect(dispatchedPayload.incident.title).toBe("E2E 테스트 사고 수정");
    expect(dispatchedPayload.incident.status).toBe("dispatched");
    expect(dispatchedPayload.events.map((event) => event.type)).toEqual(
      expect.arrayContaining(["created", "updated", "status"]),
    );
  } finally {
    const deleted = await request.delete(
      `/api/disaster/incidents/${incidentId}`,
    );

    expect(deleted.ok()).toBeTruthy();
  }
});
