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

export async function getLocalUser() {
  return prisma.user.upsert({
    where: { email: LOCAL_USER_EMAIL },
    update: {},
    create: { email: LOCAL_USER_EMAIL },
  });
}
