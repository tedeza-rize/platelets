import { type APIRequestContext, expect, type Page } from "@playwright/test";
import webPush from "web-push";

export const SEOUL_COORDINATES = {
  latitude: 37.5665,
  longitude: 126.978,
} as const;

export const E2E_VAPID_KEYS = webPush.generateVAPIDKeys();

export async function ensureSetupComplete(request: APIRequestContext) {
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
      integrations: {
        webPushContact: "mailto:e2e@example.com",
        webPushPrivateKey: E2E_VAPID_KEYS.privateKey,
        webPushPublicKey: E2E_VAPID_KEYS.publicKey,
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

export async function signInAsStaff(
  request: APIRequestContext,
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

export async function showEnglishSetup(page: Page) {
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
