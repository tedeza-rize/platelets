import { expect, type Locator, type Page, test } from "@playwright/test";
import { ensureSetupComplete } from "./home-helpers";

async function openLinkedTab(page: Page, tab: Locator, expectedUrl: RegExp) {
  await expect(tab).toBeVisible();
  const href = await tab.getAttribute("href");
  expect(href).toBeTruthy();
  await page.goto(href as string);
  await expect(page).toHaveURL(expectedUrl);
}

test.describe("Sudo console tab switching and layout", () => {
  test.beforeEach(async ({ request }) => {
    await ensureSetupComplete(request);
  });

  test("can login and switch tabs on /sudo", async ({ page }) => {
    await page.goto("/login");
    await page.locator('input[name="username"]').fill("sudo");
    await page.locator('input[name="password"]').fill("StrongSudoPass1!");
    await page.locator('button[type="submit"]').click();
    await page.waitForURL("/admin/users");
    await page.goto("/sudo");

    await expect(page.locator("h1")).toContainText(/Administrator/i);

    await openLinkedTab(
      page,
      page.locator('a[role="tab"][href*="tab=integrations"]'),
      /tab=integrations/,
    );

    await expect(page.getByText(/External service connections/i)).toBeVisible();

    await openLinkedTab(
      page,
      page.locator('a[role="tab"][href*="section=data"]'),
      /tab=integrations&section=data/,
    );
    await expect(page.getByText(/Fire safety API key/i)).toBeVisible();

    await openLinkedTab(
      page,
      page.locator('a[role="tab"][href*="section=map"]'),
      /tab=integrations&section=map/,
    );
    await expect(page.getByText(/VWorld API key/i)).toBeVisible();

    await openLinkedTab(
      page,
      page.locator('a[role="tab"][href*="tab=settings"]'),
      /tab=settings/,
    );

    await openLinkedTab(
      page,
      page.locator('a[role="tab"][href*="tab=updates"]'),
      /tab=updates/,
    );

    await openLinkedTab(
      page,
      page.locator('a[role="tab"][href*="tab=status"]'),
      /tab=status/,
    );

    await openLinkedTab(
      page,
      page.locator('a[role="tab"][href*="tab=logs"]'),
      /tab=logs/,
    );

    await page.screenshot({
      path: "test-results/sudo-logs-screenshot.png",
      fullPage: true,
    });
  });
});
