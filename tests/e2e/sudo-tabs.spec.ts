import { expect, test } from "@playwright/test";
import { ensureSetupComplete } from "./home-helpers";

test.describe("Sudo console tab switching and layout", () => {
  test.beforeEach(async ({ request }) => {
    await ensureSetupComplete(request);
  });

  test("can login and switch tabs on /sudo", async ({ page }) => {
    // Login as Sudo first
    await page.goto("/login");
    await page.locator('input[name="username"]').fill("sudo");
    await page.locator('input[name="password"]').fill("StrongSudoPass1!");
    await page.locator('button[type="submit"]').click();
    await page.waitForURL("/admin/users");
    await page.goto("/sudo");

    // Check we are on the page (checks both Administrator and 관리자)
    await expect(page.locator("h1")).toContainText(/관리자|Administrator/i);

    // Check the active tab link or button using href instead of text
    const integrationsTab = page.locator(
      'a[role="tab"][href*="tab=integrations"]',
    );
    await expect(integrationsTab).toBeVisible();
    await integrationsTab.click();

    // Check URL has ?tab=integrations
    await expect(page).toHaveURL(/tab=integrations/);

    // Check that we see the Integrations panel by looking for a text unique to integrations
    await expect(
      page.getByText(/외부 서비스 연결|External service connections/i),
    ).toBeVisible();

    // Click the settings tab
    const settingsTab = page.locator('a[role="tab"][href*="tab=settings"]');
    await expect(settingsTab).toBeVisible();
    await page.waitForTimeout(200);
    await settingsTab.click();
    await expect(page).toHaveURL(/tab=settings/);

    // Click updates tab
    const updatesTab = page.locator('a[role="tab"][href*="tab=updates"]');
    await expect(updatesTab).toBeVisible();
    await page.waitForTimeout(200);
    await updatesTab.click();
    await expect(page).toHaveURL(/tab=updates/);

    // Click status tab
    const statusTab = page.locator('a[role="tab"][href*="tab=status"]');
    await expect(statusTab).toBeVisible();
    await page.waitForTimeout(200);
    await statusTab.click();
    await expect(page).toHaveURL(/tab=status/);

    // Click logs tab
    const logsTab = page.locator('a[role="tab"][href*="tab=logs"]');
    await expect(logsTab).toBeVisible();
    await page.waitForTimeout(200);
    await logsTab.click();
    await expect(page).toHaveURL(/tab=logs/);

    // Take screenshot of Sudo Logs page to check alignment and styling
    await page.screenshot({
      path: "test-results/sudo-logs-screenshot.png",
      fullPage: true,
    });
  });
});
