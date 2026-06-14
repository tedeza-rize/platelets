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
      apiKeys: {},
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

async function signInAsStaff(
  request: import("@playwright/test").APIRequestContext,
  username: "admin" | "sudo",
) {
  const response = await request.post("/api/auth/login", {
    data: {
      password: username === "sudo" ? "StrongSudoPass1!" : "StrongAdminPass1!",
      username,
    },
  });

  expect(response.ok()).toBeTruthy();
}

async function showEnglishSetup(page: import("@playwright/test").Page) {
  if (
    (await page
      .getByRole("heading", { name: "Platelets에 오신 것을 환영합니다" })
      .count()) > 0
  ) {
    await page.getByRole("button", { name: "EN" }).click();
  }

  await expect(
    page.getByRole("heading", { name: "Welcome to Platelets" }),
  ).toBeVisible();
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
  await showEnglishSetup(page);
  await expect(page.getByRole("button", { name: "Continue" })).toBeEnabled();
  await page.getByRole("button", { name: "KO" }).click();
  await expect(
    page.getByRole("heading", {
      name: "Platelets에 오신 것을 환영합니다",
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "EN" }).click();
  await showEnglishSetup(page);
  await page.getByRole("button", { name: "Dark" }).click();
  await expect(page.locator("main")).toHaveAttribute("data-theme", "dark");
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
    page.getByText("SQLite database file", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Time synchronization", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Server and browser time are synchronized."),
  ).toBeVisible({
    timeout: 15_000,
  });
  await expect(
    page
      .getByText("The SQLite DB file can be created during installation.")
      .or(page.getByText(/A SQLite DB file already exists:/)),
  ).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(
    page.getByRole("heading", { name: "Create the administrator account" }),
  ).toBeVisible();
  await page.getByLabel("Full name").fill("Setup Sudo");
  await page.getByLabel("Email address").fill("sudo@example.com");
  await page.getByLabel("Password", { exact: true }).fill("StrongSudoPass1!");
  await page.getByLabel("Confirm password").fill("StrongSudoPass1!");
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(
    page.getByRole("heading", { name: "Create the operator account" }),
  ).toBeVisible();
  await page.getByLabel("Full name").fill("Setup Admin");
  await page.getByLabel("Email address").fill("admin@example.com");
  await page.getByLabel("Password", { exact: true }).fill("StrongAdminPass1!");
  await page.getByLabel("Confirm password").fill("StrongAdminPass1!");
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByRole("heading", { name: "API keys" })).toBeVisible();
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

test("routes staff login to admin and field workspaces", async ({
  browserName,
  page,
  request,
}) => {
  await ensureSetupComplete(request);
  const fieldUsername = `field.${browserName}.${Date.now().toString(36)}`;

  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.getByLabel("Username", { exact: true }).fill("admin");
  await page.getByLabel("Password", { exact: true }).fill("StrongAdminPass1!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin\/users$/);
  await expect(
    page.getByRole("heading", { name: "Staff accounts" }),
  ).toBeVisible();

  const created = await page.evaluate(async (username) => {
    const response = await fetch("/api/admin/users", {
      body: JSON.stringify({
        department: "Jongno",
        email: `${username}@example.com`,
        name: "Field E2E",
        password: "StrongFieldPass1!",
        phone: "010-0000-0000",
        role: "field_worker",
        username,
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });

    return response.ok;
  }, fieldUsername);
  expect(created).toBeTruthy();

  await page.evaluate(() =>
    fetch("/api/auth/logout", { method: "POST" }).then(() => undefined),
  );
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.getByLabel("Username", { exact: true }).fill(fieldUsername);
  await page.getByLabel("Password", { exact: true }).fill("StrongFieldPass1!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/field$/);
  await expect(
    page.getByRole("heading", { name: "Field response" }),
  ).toBeVisible();
});

test("shows a mobile bottom sheet for map selections", async ({
  page,
  request,
}) => {
  await ensureSetupComplete(request);
  await page.setViewportSize({ height: 780, width: 390 });
  await page.context().grantPermissions(["geolocation"]);
  await page.context().setGeolocation({
    accuracy: 25,
    latitude: 37.5665,
    longitude: 126.978,
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });

  const canvas = page.locator("canvas.maplibregl-canvas");
  await expect(canvas).toBeVisible();
  const locateButton = page.getByTestId("locate-user-button");
  await expect(locateButton).toBeVisible();
  await locateButton.click();

  const sheet = page.getByTestId("mobile-bottom-sheet");
  await expect(sheet).toBeVisible({ timeout: 15_000 });
  await expect(sheet.getByText(/Coordinates|좌표/)).toBeVisible();
  await sheet.getByTestId("mobile-bottom-sheet-close").click();
  await expect(sheet).toBeHidden();
});

test("registers the push service worker when notifications are configured", async ({
  page,
  request,
}) => {
  await ensureSetupComplete(request);
  await page.goto("/", { waitUntil: "domcontentloaded" });

  await expect(page.getByTestId("notification-control")).toBeVisible({
    timeout: 10_000,
  });
  await expect
    .poll(() =>
      page.evaluate(async () =>
        Boolean(await navigator.serviceWorker.getRegistration("/")),
      ),
    )
    .toBe(true);
});

test("exposes a PWA manifest and offline navigation fallback", async ({
  page,
  request,
}) => {
  await ensureSetupComplete(request);
  const manifest = await request.get("/manifest.webmanifest");
  expect(manifest.ok()).toBeTruthy();
  const manifestPayload = (await manifest.json()) as {
    display?: string;
    icons?: Array<{ src: string }>;
    start_url?: string;
  };
  expect(manifestPayload.display).toBe("standalone");
  expect(manifestPayload.start_url).toBe("/");
  expect(manifestPayload.icons?.some((icon) => icon.src === "/icon.svg")).toBe(
    true,
  );

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect
    .poll(() =>
      page.evaluate(async () => {
        await navigator.serviceWorker.ready;
        return Boolean(await navigator.serviceWorker.getRegistration("/"));
      }),
    )
    .toBe(true);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect
    .poll(() =>
      page.evaluate(() => Boolean(navigator.serviceWorker.controller)),
    )
    .toBe(true);

  await page.context().setOffline(true);
  try {
    await page.goto("/offline-probe", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { name: "You are offline" }),
    ).toBeVisible({ timeout: 10_000 });
  } finally {
    await page.context().setOffline(false);
  }
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
  const denied = await request.post("/api/disaster/incidents", {
    data: {
      latitude: 37.5665,
      longitude: 126.978,
      riskLevel: "medium",
      title: "Anonymous E2E incident",
      type: "fire",
    },
  });
  expect(denied.status()).toBe(401);

  await signInAsStaff(request, "admin");
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

test("disaster report export returns an Excel-compatible workbook", async ({
  request,
}) => {
  await ensureSetupComplete(request);

  const response = await request.get("/api/disaster/reports?format=excel", {
    headers: {
      "Accept-Language": "en-US,en;q=0.9",
    },
  });

  expect(response.ok()).toBeTruthy();
  expect(response.headers()["content-type"]).toContain(
    "application/vnd.ms-excel",
  );
  expect(response.headers()["content-disposition"]).toContain(
    "platelets-disaster-report-",
  );

  const body = await response.text();
  expect(body).toContain('<Worksheet ss:Name="Overview">');
  expect(body).toContain('<Worksheet ss:Name="Incident history">');
  expect(body).toContain('<Worksheet ss:Name="Resource placement">');
});

test("incident updates reach an open dashboard without a reload", async ({
  page,
  request,
}) => {
  await ensureSetupComplete(request);
  await signInAsStaff(request, "sudo");
  const observer = await page.context().newPage();
  const eventStream = observer.waitForResponse(
    (response) =>
      response.url().endsWith("/api/disaster/events") &&
      response.status() === 200,
  );
  await observer.goto("/incidents", { waitUntil: "domcontentloaded" });
  await eventStream;

  const title = `E2E real-time incident ${Date.now()}`;
  const created = await request.post("/api/disaster/incidents", {
    data: {
      address: "Seoul City Hall",
      description: "SSE synchronization test",
      latitude: 37.5665,
      longitude: 126.978,
      occurredAt: new Date().toISOString(),
      riskLevel: "medium",
      title,
      type: "fire",
    },
  });
  expect(created.ok()).toBeTruthy();
  const createdPayload = (await created.json()) as {
    incident: { id: string };
  };

  try {
    await expect(observer.getByText(title, { exact: true })).toBeVisible({
      timeout: 10_000,
    });
  } finally {
    const deleted = await request.delete(
      `/api/disaster/incidents/${createdPayload.incident.id}`,
    );
    expect(deleted.ok()).toBeTruthy();
    await expect(observer.getByText(title, { exact: true })).toBeHidden({
      timeout: 10_000,
    });
    await observer.close();
  }
});
