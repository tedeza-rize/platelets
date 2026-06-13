import { defineConfig, devices } from "@playwright/test";
import webPush from "web-push";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3100";
const browserChannel = process.env.PLAYWRIGHT_BROWSER_CHANNEL;
const e2eDataDir =
  process.env.PLATELETS_DATA_DIR ??
  `.playwright-data/${Date.now()}-${Math.random().toString(16).slice(2)}`;
const e2eVapidKeys = webPush.generateVAPIDKeys();
const projects = browserChannel
  ? [
      {
        name: `system-${browserChannel}`,
        use: { ...devices["Desktop Chrome"], channel: browserChannel },
      },
    ]
  : [
      {
        name: "chromium",
        use: { ...devices["Desktop Chrome"] },
      },
      {
        name: "firefox",
        use: { ...devices["Desktop Firefox"] },
      },
    ];

export default defineConfig({
  fullyParallel: true,
  projects,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  retries: process.env.CI ? 2 : 0,
  testDir: "./tests/e2e",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  webServer: {
    command: "npm run start -- --hostname 127.0.0.1 --port 3100",
    env: {
      ...process.env,
      PLATELETS_DATA_DIR: e2eDataDir,
      WEB_PUSH_CONTACT: "mailto:e2e@example.com",
      WEB_PUSH_VAPID_PRIVATE_KEY: e2eVapidKeys.privateKey,
      WEB_PUSH_VAPID_PUBLIC_KEY: e2eVapidKeys.publicKey,
    },
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    url: baseURL,
  },
  workers: 1,
});
