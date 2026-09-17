import { resolve } from "node:path";

import { defineConfig, devices } from "@playwright/test";

const configuredRunId = process.env.FOCUSED_MOMENT_TEST_RUN_ID;
const generatedRunId = `run-${new Date().toISOString().replace(/[^0-9TZ-]/g, "-")}-${process.pid}`;
const runId = (configuredRunId ?? generatedRunId).replace(/[^a-zA-Z0-9_-]/g, "-") || "run";
const outputDir = resolve("output", "qa", "frontend", runId);

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
    command: "pnpm dev --host 127.0.0.1",
    url: "http://127.0.0.1:1420",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
