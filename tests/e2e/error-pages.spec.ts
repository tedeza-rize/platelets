import { expect, test } from "@playwright/test";

test.beforeEach(async ({ context }) => {
  await context.addCookies([
    {
      name: "platelets-locale",
      url: "http://127.0.0.1:3100",
      value: "en",
    },
    {
      name: "platelets-theme",
      url: "http://127.0.0.1:3100",
      value: "light",
    },
  ]);
});

test("keeps a not-found response after the service worker takes control", async ({
  page,
}) => {
  await page.goto("/maintenance", { waitUntil: "domcontentloaded" });
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

  const response = await page.goto("/missing-error-page", {
    waitUntil: "domcontentloaded",
  });
  expect(response?.status()).toBe(404);
  await expect(
    page.getByRole("heading", {
      name: "This location stepped beyond the edge of the map.",
    }),
  ).toBeVisible();

  const image = page.getByRole("img", {
    name: "Platelet character inspecting a map upside down",
  });
  await expect(image).toBeVisible();
  await expect
    .poll(() =>
      image.evaluate((element) => (element as HTMLImageElement).naturalWidth),
    )
    .toBeGreaterThan(0);
});

test("persists locale and theme preferences", async ({ page }) => {
  await page.goto("/maintenance", { waitUntil: "domcontentloaded" });
  await page
    .getByRole("button", { name: "Display and language settings" })
    .click();
  await page.getByRole("button", { name: "한국어" }).click();
  await expect(
    page.getByRole("heading", { name: "지도가 잠깐 건강검진을 받고 있어요." }),
  ).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "ko");

  await page.getByRole("button", { name: "화면 및 언어 설정" }).click();
  await page.getByRole("button", { name: "다크" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("html")).toHaveAttribute("lang", "ko");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("keeps the offline error page within a mobile viewport", async ({
  page,
}) => {
  await page.setViewportSize({ height: 844, width: 390 });
  await page.goto("/offline", { waitUntil: "domcontentloaded" });

  await expect(
    page.getByRole("heading", {
      name: "The internet left its post for a moment.",
    }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    )
    .toBe(true);
});
