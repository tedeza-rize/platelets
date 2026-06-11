import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
const browserChannel = process.env.PLAYWRIGHT_BROWSER_CHANNEL;
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
    command: "npm run start -- --hostname 127.0.0.1 --port 3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    url: baseURL,
  },
  workers: process.env.CI ? 1 : undefined,
});
