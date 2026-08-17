import "dotenv/config";
import { PrismaClient } from "../generated/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export const LOCAL_USER_EMAIL = "local@forenzdetectiv.local";

async function withDbRetry<T>(fn: () => Promise<T>): Promise<T> {
  let last: unknown;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      last = err;
      const code =
        err && typeof err === "object" && "code" in err
          ? String((err as { code: unknown }).code)
          : "";
      if (code !== "ECONNREFUSED" && code !== "P1001") throw err;
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
  }
  throw last;
}

export async function getLocalUser() {
  return withDbRetry(() =>
    prisma.user.upsert({
      where: { email: LOCAL_USER_EMAIL },
      update: {},
      create: { email: LOCAL_USER_EMAIL },
    })
  );
}
