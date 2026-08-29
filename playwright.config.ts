import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  testIgnore: "**/fullstack*.spec.ts",
  timeout: 60_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://127.0.0.1:5175",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  webServer: {
    // UI smoke only — full API stack is covered by Vitest API/integration suites
    command: "npx vite --host 127.0.0.1 --port 5175",
    url: "http://127.0.0.1:5175",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "iphone-air",
      use: {
        ...devices["iPhone 14 Pro"],
        browserName: "chromium",
        viewport: { width: 393, height: 852 },
      },
    },
  ],
});
