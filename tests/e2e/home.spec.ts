import { expect, test } from "@playwright/test";

test("loads the integrated disaster response map", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });

  await expect(page.getByText("Platelets 통합 재난 지도")).toBeVisible();
  await expect(page.getByRole("button", { name: "대시보드" })).toBeVisible();
  await expect(page.getByRole("button", { name: "3D" })).toBeVisible();
  await expect(page.locator("canvas.maplibregl-canvas")).toBeVisible();
});
