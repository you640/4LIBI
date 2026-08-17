import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    root: __dirname,
    resolveSnapshotPath: (testPath) => {
      const fileName = path.basename(testPath);
      const dirName = path.dirname(testPath);
      return path.resolve(dirName, "__snapshots__", fileName + ".snap");
    },
    // Include all test files
    include: ["tests/**/*.{test,spec}.{js,ts,jsx,tsx}"],
    // Exclude node_modules and dist
    exclude: ["node_modules", "dist", "generated"],
    // Coverage configuration
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      reportsDirectory: "./coverage",
      include: [
        "src/**/*.{ts,tsx}",
        "server/**/*.{ts,js}",
      ],
      exclude: [
        "src/**/*.d.ts",
        "server/**/*.d.ts",
        "**/*.config.*",
        "**/__mocks__/**",
      ],
    },
    // Setup files
    setupFiles: [
      "./tests/setup.ts",
    ],
    // Mock environment variables
    env: {
      NODE_ENV: "test",
      DATABASE_URL: "postgresql://localhost:5432/test",
      JWT_SECRET: "test-secret-key",
      MISTRAL_API_KEY: "test-api-key",
    },
    // Timeout for async tests
    testTimeout: 10000,
  },
});
