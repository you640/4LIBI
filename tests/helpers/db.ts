import { prisma } from "../../server/prisma";

/** Truncate mapped Prisma tables used in integration tests. */
export async function cleanupDatabase(): Promise<void> {
  try {
    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE
        "hitl_statuses",
        "audit_logs",
        "ocr_results",
        "conversation_logs",
        "geospatial_checks",
        "_AnalysisToFile",
        "analyses",
        "files",
        "User"
      RESTART IDENTITY CASCADE
    `);
  } catch {
    // Join table name may differ; fall back to sequential deletes.
    try {
      await prisma.hitlStatusRecord.deleteMany();
      await prisma.auditLog.deleteMany();
      await prisma.ocrResult.deleteMany();
      await prisma.conversationLog.deleteMany();
      await prisma.geospatialCheck.deleteMany();
      await prisma.analysis.deleteMany();
      await prisma.file.deleteMany();
      await prisma.user.deleteMany();
    } catch (err) {
      console.error("Database cleanup error:", err);
      const code =
        err && typeof err === "object" && "code" in err
          ? String((err as { code: unknown }).code)
          : "";
      if (code === "P1017") {
        await prisma.$disconnect().catch(() => {});
        const globalForPrisma = globalThis as { prisma?: unknown };
        globalForPrisma.prisma = undefined;
      }
    }
  }
}

/** Verify DB is reachable and schema exists (User table). */
export async function verifyDatabaseReady(): Promise<boolean> {
  try {
    const { prisma: client } = await import("../../server/prisma");
    await client.$queryRaw`SELECT 1`;
    await client.user.findMany({ take: 1 });
    return true;
  } catch {
    return false;
  }
}
