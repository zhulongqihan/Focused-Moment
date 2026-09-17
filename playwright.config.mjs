import { fileURLToPath } from "node:url";

import { defineConfig, devices } from "@playwright/test";

import { getPlaywrightOutputDir } from "./scripts/playwright-output-root.mjs";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));
const outputDir = getPlaywrightOutputDir({ rootDir: projectRoot });

export default defineConfig({
  testDir: "./tests",
  outputDir,
  timeout: 30_000,
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://127.0.0.1:1420",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "pnpm dev --host 127.0.0.1 --strictPort",
    url: "http://127.0.0.1:1420",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
