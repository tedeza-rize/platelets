import { expect, test } from "@playwright/test";

test("redirects first-run deployments to the setup wizard", async ({
  page,
}) => {
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
});
