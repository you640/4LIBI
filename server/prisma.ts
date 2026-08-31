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
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

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

// ============================================
// USER AUTHENTICATION FUNCTIONS
// ============================================

export async function getUserById(userId: string) {
  return withDbRetry(() => prisma.user.findUnique({ where: { id: userId } }));
}

export async function getUserByEmail(email: string) {
  return withDbRetry(() => prisma.user.findUnique({ where: { email } }));
}

export async function createUser(email: string, passwordHash?: string) {
  return withDbRetry(() =>
    prisma.user.create({
      data: { email, passwordHash: passwordHash || null },
    })
  );
}

// ============================================
// AUDIT LOG FUNCTIONS (Server-side, not localStorage)
// ============================================

export async function logAuditAction(
  ownerId: string,
  action: string,
  details?: Record<string, unknown>
) {
  return withDbRetry(() =>
    prisma.auditLog.create({
      data: {
        action,
        userId: ownerId,
        details: sanitizeAuditDetails(details) as unknown as import("../generated/client").Prisma.InputJsonValue,
      },
    })
  );
}

function sanitizeAuditDetails(details: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!details) return {};
  const sanitized: Record<string, unknown> = {};
  const sensitiveKeys = ["password", "token", "apikey", "secret", "email", "phone"];
  
  for (const [key, value] of Object.entries(details)) {
    if (sensitiveKeys.some(s => key.toLowerCase().includes(s))) {
      sanitized[key] = "[REDACTED]";
    } else if (typeof value === "string" && value.length > 1000) {
      sanitized[key] = value.slice(0, 1000) + "...";
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
}

export async function getAuditLogs(ownerId?: string, limit: number = 100) {
  return withDbRetry(() =>
    prisma.auditLog.findMany({
      where: ownerId ? { userId: ownerId } : undefined,
      orderBy: { timestamp: "desc" },
      take: limit,
    })
  );
}

// ============================================
// HITL FUNCTIONS (Server-side, not localStorage)
// ============================================

export type HitlStatus = "open" | "confirmed" | "dismissed";

export async function getHitlStatus(analysisId: string, eventId: string) {
  return withDbRetry(() =>
    prisma.hitlStatusRecord.findUnique({
      where: {
        analysisId_eventId: {
          analysisId,
          eventId,
        },
      },
    })
  );
}

export async function setHitlStatus(
  analysisId: string,
  eventId: string,
  ownerId: string,
  status: HitlStatus
) {
  return withDbRetry(() =>
    prisma.hitlStatusRecord.upsert({
      where: {
        analysisId_eventId: {
          analysisId,
          eventId,
        },
      },
      create: {
        analysisId,
        eventId,
        status,
        ownerId,
      },
      update: { status },
    })
  );
}

export async function getAllHitlForAnalysis(analysisId: string, ownerId?: string, eventIds?: string[]) {
  return withDbRetry(() =>
    prisma.hitlStatusRecord.findMany({
      where: {
        analysisId,
        ...(eventIds && eventIds.length > 0 ? { eventId: { in: eventIds } } : {}),
        ...(ownerId ? { ownerId } : {}),
      },
    })
  );
}
