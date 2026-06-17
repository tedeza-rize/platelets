import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3100";
const browserChannel = process.env.PLAYWRIGHT_BROWSER_CHANNEL;
const firefoxLaunchOptions = {
  env: {
    ...process.env,
    LIBGL_ALWAYS_SOFTWARE: process.env.LIBGL_ALWAYS_SOFTWARE ?? "1",
    MOZ_WEBGL_FORCE_ENABLE: process.env.MOZ_WEBGL_FORCE_ENABLE ?? "1",
  },
  firefoxUserPrefs: {
    "gfx.webrender.software": true,
    "layers.acceleration.force-enabled": true,
    "webgl.disabled": false,
    "webgl.enable-webgl2": true,
    "webgl.force-enabled": true,
  },
};
const e2eRoot = path.join(process.cwd(), ".playwright-data");
const e2eDataDir = path.join(
  e2eRoot,
  `${Date.now()}-${Math.random().toString(16).slice(2)}`,
);
mkdirSync(e2eRoot, { recursive: true });
writeFileSync(
  path.join(e2eRoot, "active.json"),
  JSON.stringify({ dataDirectory: e2eDataDir }),
);
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
        use: {
          ...devices["Desktop Firefox"],
          launchOptions: firefoxLaunchOptions,
        },
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
      PLAYWRIGHT_TEST: "true",
      NODE_OPTIONS: [
        process.env.NODE_OPTIONS,
        "--import=./tests/register-e2e-data-dir.mjs",
      ]
        .filter(Boolean)
        .join(" "),
    },
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    url: baseURL,
  },
  workers: 1,
});
