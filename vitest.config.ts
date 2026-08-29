import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const sharedEnv = {
  NODE_ENV: "test",
  VITEST: "true",
  SKIP_LISTEN: "1",
  DATABASE_URL:
    process.env.DATABASE_URL ||
    "postgresql://forenz:forenz@localhost:5432/forenzdetectiv?schema=public",
  JWT_SECRET: "test-secret-key-min-32-characters!!",
  API_KEY: "test-api-key-forenz",
  MISTRAL_API_KEY: "test-mistral-key",
  ENABLE_AUTH: "true",
  ALLOWED_ORIGINS: "http://localhost:5175,http://127.0.0.1:5175",
  REDIS_URL: process.env.REDIS_URL || "redis://localhost:6379",
};

const { DATABASE_URL: _integrationDatabaseUrl, ...integrationEnvBase } = sharedEnv;

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    root: __dirname,
    resolveSnapshotPath: (testPath) => {
      const fileName = path.basename(testPath);
      const dirName = path.dirname(testPath);
      return path.resolve(dirName, "__snapshots__", fileName + ".snap");
    },
    exclude: ["node_modules", "dist", "generated", "tests/e2e/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      reportsDirectory: "./coverage",
      include: ["src/**/*.{ts,tsx}", "server/**/*.{ts,js}"],
      exclude: [
        "src/**/*.d.ts",
        "server/**/*.d.ts",
        "**/*.config.*",
        "**/__mocks__/**",
      ],
      thresholds: {
        lines: 20,
        functions: 15,
        statements: 20,
      },
    },
    testTimeout: 15000,
    projects: [
      {
        test: {
          name: "unit",
          environment: "node",
          include: [
            "tests/**/*.{test,spec}.{js,ts}",
            "tests/unit/**/*.{test,spec}.{js,ts}",
            "tests/contract/**/*.{test,spec}.{js,ts}",
            "tests/security/**/*.{test,spec}.{js,ts}",
          ],
          exclude: [
            "tests/api/**",
            "tests/integration/**",
            "tests/components/**",
            "tests/e2e/**",
            "node_modules",
            "dist",
          ],
          setupFiles: ["./tests/setup.ts"],
          env: sharedEnv,
        },
      },
      {
        test: {
          name: "api",
          environment: "node",
          include: ["tests/api/**/*.{test,spec}.{js,ts}"],
          setupFiles: ["./tests/setup.ts", "./tests/setup.api.ts"],
          env: sharedEnv,
        },
      },
      {
        test: {
          name: "integration",
          environment: "node",
          include: ["tests/integration/**/*.{test,spec}.{js,ts}"],
          setupFiles: [
            "./tests/setup.integration-env.ts",
            "./tests/setup.integration.ts",
          ],
          env: { ...integrationEnvBase, ENABLE_AUTH: "false" },
          testTimeout: 30000,
        },
      },
      {
        extends: true,
        test: {
          name: "components",
          environment: "jsdom",
          include: ["tests/components/**/*.{test,spec}.{js,ts,tsx}"],
          setupFiles: ["./tests/setup.components.ts"],
          env: sharedEnv,
        },
      },
    ],
  },
});
