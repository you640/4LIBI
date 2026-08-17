import { beforeAll, afterAll, afterEach, vi } from "vitest";
import { prisma } from "../server/prisma";

// Mock console methods to reduce noise in tests
beforeAll(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.clearAllMocks();
});

afterAll(() => {
  vi.restoreAllMocks();
});

// Clean up database after tests
// Note: This requires a test database connection
export async function cleanupDatabase() {
  try {
    // In a real test environment, you would clean up test data
    // For now, just log that cleanup would happen
    if (process.env.NODE_ENV === "test") {
      // Clean up test data
      await prisma.$executeRaw`TRUNCATE TABLE "Analysis" CASCADE`;
      await prisma.$executeRaw`TRUNCATE TABLE "File" CASCADE`;
      await prisma.$executeRaw`TRUNCATE TABLE "User" CASCADE`;
    }
  } catch (err) {
    console.error("Database cleanup error:", err);
  }
}
