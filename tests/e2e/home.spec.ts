import { randomUUID } from "node:crypto";
import { expect, type Page, test } from "@playwright/test";
import {
  E2E_VAPID_KEYS,
  ensureSetupComplete,
  SEOUL_COORDINATES,
  showEnglishSetup,
} from "./home-helpers";

const FIRST_RUN_SKIP_REASON =
  "first-run setup is verified once because CI browser projects share the same test server";
const MAP_CANVAS_TIMEOUT_MS = 30_000;
const MAP_UNAVAILABLE_REASON =
  "Firefox runner did not provide browser graphics support for MapLibre";
const MAP_UNAVAILABLE_TEXT =
  /Could not start the map|지도를 시작하지 못했습니다/;

test.describe.configure({ mode: "serial", timeout: 60_000 });

async function expectMapCanvasOrFallback(page: Page) {
  const canvas = page.locator("canvas.maplibregl-canvas");
  const mapUnavailable = page.getByText(MAP_UNAVAILABLE_TEXT);

  await expect(canvas.or(mapUnavailable)).toBeVisible({
    timeout: MAP_CANVAS_TIMEOUT_MS,
  });

  return await canvas.isVisible();
}

test("redirects protected pages to setup before installation", async ({
  browserName,
  page,
}) => {
  test.skip(browserName === "firefox", FIRST_RUN_SKIP_REASON);

  await page.goto("/admin", { waitUntil: "domcontentloaded" });

  await expect(page).toHaveURL(/\/setup$/);
  await expect(page.getByLabel("Platelets setup wizard")).toBeVisible();
});

test("redirects first-run deployments to the setup wizard", async ({
  browserName,
  page,
}) => {
  test.skip(browserName === "firefox", FIRST_RUN_SKIP_REASON);

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
      .getByText("The SQLite database file can be created during installation.")
      .or(page.getByText(/A SQLite database file already exists:/)),
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
    page.getByText("API key settings are ready to save."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(
    page.getByRole("heading", { name: "Create database" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Install" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByRole("link", { name: "Platelets integrated disaster map" }),
  ).toBeVisible();
});

test("loads the integrated disaster response map", async ({
  browserName,
  page,
  request,
}) => {
  await ensureSetupComplete(request);
  await page.goto("/", { waitUntil: "domcontentloaded" });

  await expect(
    page.getByRole("link", { name: "Platelets integrated disaster map" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Dashboard" })).toBeVisible();
  await expect(page.getByRole("button", { name: "3D" })).toBeVisible();
  const hasMapCanvas = await expectMapCanvasOrFallback(page);
  expect(hasMapCanvas || browserName === "firefox").toBe(true);
});

test("routes staff login and updates an account lifecycle", async ({
  browserName,
  page,
  request,
}) => {
  await ensureSetupComplete(request);
  await page.setViewportSize({ height: 800, width: 360 });
  const fieldUsername = `field.${browserName}.${randomUUID().slice(0, 8)}`;

  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.getByLabel("Username", { exact: true }).fill("admin");
  await page.getByLabel("Password", { exact: true }).fill("StrongAdminPass1!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin\/users$/);
  await expect(
    page.getByRole("heading", { name: "Staff accounts" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);

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

  await page.evaluate(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
  });
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.getByLabel("Username", { exact: true }).fill(fieldUsername);
  await page.getByLabel("Password", { exact: true }).fill("StrongFieldPass1!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/field$/);
  await expect(
    page.getByRole("heading", { name: "Field response" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);

  await page.evaluate(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
  });
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.getByLabel("Username", { exact: true }).fill("sudo");
  await page.getByLabel("Password", { exact: true }).fill("StrongSudoPass1!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin\/users$/);

  const integrationsSaved = await page.evaluate(async (keys) => {
    const response = await fetch("/api/admin/integrations", {
      body: JSON.stringify({
        integrations: {
          webPushContact: "mailto:e2e@example.com",
          webPushPrivateKey: keys.privateKey,
          webPushPublicKey: keys.publicKey,
        },
      }),
      headers: { "Content-Type": "application/json" },
      method: "PUT",
    });

    return response.ok;
  }, E2E_VAPID_KEYS);
  expect(integrationsSaved).toBeTruthy();

  await page.getByRole("button", { name: "Refresh" }).click();
  const accountRow = page.getByRole("row").filter({ hasText: fieldUsername });
  await accountRow.getByRole("button", { name: "Edit" }).click();
  await page.getByLabel("Name", { exact: true }).fill("Dispatcher E2E");
  await page.getByLabel("New password (optional)").fill("UpdatedFieldPass1!");
  await page.getByRole("combobox", { name: "Role" }).selectOption("dispatcher");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("User updated.")).toBeVisible();
  await expect(accountRow).toContainText("Dispatcher E2E");
  await expect(accountRow).toContainText("Dispatcher");

  await page.evaluate(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
  });
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.getByLabel("Username", { exact: true }).fill(fieldUsername);
  await page.getByLabel("Password", { exact: true }).fill("UpdatedFieldPass1!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("shows a mobile bottom sheet for map selections", async ({
  browserName,
  page,
  request,
}) => {
  await ensureSetupComplete(request);
  await page.setViewportSize({ height: 780, width: 390 });
  await page.context().grantPermissions(["geolocation"]);
  await page.context().setGeolocation({
    accuracy: 25,
    ...SEOUL_COORDINATES,
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });

  const hasMapCanvas = await expectMapCanvasOrFallback(page);
  if (!hasMapCanvas) {
    test.skip(browserName === "firefox", MAP_UNAVAILABLE_REASON);
  }
  expect(hasMapCanvas).toBe(true);
  const locateButton = page.getByTestId("locate-user-button");
  await expect(locateButton).toBeVisible();
  await locateButton.click();

  const sheet = page.getByTestId("mobile-bottom-sheet");
  await expect(sheet).toBeVisible({ timeout: 15_000 });
  await expect(sheet.getByText(/Coordinates|좌표/)).toBeVisible();
  await sheet.getByTestId("mobile-bottom-sheet-close").click();
  await expect(sheet).toBeHidden();
});

test("opens map context actions from a desktop right click", async ({
  browserName,
  page,
  request,
}) => {
  await ensureSetupComplete(request);
  await page.goto("/", { waitUntil: "domcontentloaded" });

  const hasMapCanvas = await expectMapCanvasOrFallback(page);
  if (!hasMapCanvas) {
    test.skip(browserName === "firefox", MAP_UNAVAILABLE_REASON);
  }

  const canvas = page.locator("canvas.maplibregl-canvas");
  const bounds = await canvas.boundingBox();
  expect(bounds).not.toBeNull();
  await page.mouse.click(
    (bounds?.x ?? 0) + (bounds?.width ?? 0) / 2,
    (bounds?.y ?? 0) + (bounds?.height ?? 0) / 2,
    { button: "right" },
  );

  const menu = page.getByTestId("map-context-menu");
  await expect(menu).toBeVisible();
  await expect(
    menu.getByRole("button", { name: /Copy coordinates|좌표 복사/ }),
  ).toBeVisible();
  await expect(
    menu.getByRole("button", { name: /Find address|주소 찾기/ }),
  ).toBeVisible();
  await expect(
    menu.getByRole("button", { name: /Report here|여기 신고/ }),
  ).toBeVisible();
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
    await expect.poll(() => page.evaluate(() => !navigator.onLine)).toBe(true);
    await page.evaluate(() => window.dispatchEvent(new Event("offline")));
    await expect
      .poll(() =>
        page.evaluate(async () => {
          const cache = await caches.open("platelets-shell-v4");
          const response = await cache.match("/__platelets-network-status");
          return response?.text();
        }),
      )
      .toBe("offline");
    await page.goto("/offline-probe", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", {
        name: "The internet left its post for a moment.",
      }),
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

  await expect(page.getByText("119 call and dispatch data")).toBeVisible({
    timeout: 15_000,
  });
  await expect(
    page.getByText("소방안전 빅데이터: 전북 119신고접수"),
  ).toBeVisible();

  await page.getByRole("button", { name: "Resources" }).click();

  await expect(page.getByText("Resource placement support")).toBeVisible();
  await expect
    .poll(() => page.getByText(/위험도 \d+점/).count())
    .toBeGreaterThan(0);
  await expect
    .poll(() => page.getByText(/Rescue trucks: \d+/).count())
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

  await expect(page.getByText("Fire station recommendation")).toBeVisible({
    timeout: 15_000,
  });
  await expect(
    page.getByText("Internal A* road route 1.2km · 3 min"),
  ).toBeVisible({ timeout: 15_000 });
});
