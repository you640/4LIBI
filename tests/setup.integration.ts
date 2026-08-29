import { beforeAll, afterAll, afterEach } from "vitest";

beforeAll(async () => {
  process.env.NODE_ENV = "test";
  process.env.SKIP_LISTEN = "1";
});

afterEach(async () => {
  const { cleanupDatabase } = await import("./helpers/db");
  await cleanupDatabase();
});

afterAll(async () => {
  const { cleanupDatabase } = await import("./helpers/db");
  await cleanupDatabase();
  const { prisma } = await import("../server/prisma");
  await prisma.$disconnect();
});
