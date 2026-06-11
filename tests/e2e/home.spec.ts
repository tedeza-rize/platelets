import { expect, test } from "@playwright/test";

test("loads the public emergency map shell", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });

  await expect(page.getByText("Platelets").first()).toBeVisible();
  await expect(
    page.getByRole("button", { name: "응급 출동·이송" }),
  ).toBeVisible();
  await expect(page.locator('[role="application"]')).toBeVisible();
});
