import { defineConfig, devices } from "@playwright/test";

/**
 * Full-stack E2E — real Vite + Hono API (no /api mocks).
 * Requires Postgres + Redis (Cloud Railway or local instance).
 *
 *   npm run test:e2e:full
 */
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/fullstack*.spec.ts",
  timeout: 90_000,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:5175",
    trace: "on-first-retry",
  },
  webServer: [
    {
      command: "npx tsx server/index.ts",
      url: "http://127.0.0.1:5176/api/health",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        ...process.env,
        HOST: "127.0.0.1",
        PORT: "5176",
        ENABLE_AUTH: "false",
        DATABASE_URL:
          process.env.DATABASE_URL ||
          "postgresql://forenz:forenz@127.0.0.1:5432/forenzdetectiv?schema=public",
        REDIS_URL: process.env.REDIS_URL || "redis://127.0.0.1:6379",
      },
    },
    {
      command: "npx vite --host 127.0.0.1 --port 5175",
      url: "http://127.0.0.1:5175",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
