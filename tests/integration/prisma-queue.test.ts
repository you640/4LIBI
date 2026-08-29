import { describe, it, expect, beforeAll, afterAll } from "vitest";
import net from "node:net";
import type { PrismaClient } from "../../generated/client";
import { resolveTestDatabaseUrl } from "../helpers/resolveTestDatabaseUrl";

let prisma: PrismaClient;

async function loadPrisma(): Promise<PrismaClient> {
  if (!prisma) {
    ({ prisma } = await import("../../server/prisma"));
  }
  return prisma;
}

async function canConnect(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port }, () => {
      socket.end();
      resolve(true);
    });
    socket.on("error", () => resolve(false));
    socket.setTimeout(1500, () => {
      socket.destroy();
      resolve(false);
    });
  });
}

const databaseUrl = await resolveTestDatabaseUrl();
process.env.DATABASE_URL = databaseUrl;
const dbUrl = new URL(databaseUrl);
const dbHost = dbUrl.hostname || "127.0.0.1";
const dbPort = Number(dbUrl.port || 5432);
const portOpen = await canConnect(dbHost, dbPort).catch(() => false);
const redisReady = await canConnect("127.0.0.1", 6379).catch(() => false);

let dbReady = false;
if (portOpen) {
  await loadPrisma();
  const { verifyDatabaseReady } = await import("../helpers/db");
  dbReady = await verifyDatabaseReady();
}

describe.skipIf(!dbReady)("Prisma integration", () => {
  beforeAll(async () => {
    const { cleanupDatabase } = await import("../helpers/db");
    await cleanupDatabase();
  });

  afterAll(async () => {
    const { cleanupDatabase } = await import("../helpers/db");
    await cleanupDatabase();
    const client = await loadPrisma();
    await client.$disconnect();
  });

  it("creates user and analysis", async () => {
    const client = await loadPrisma();
    const user = await client.user.upsert({
      where: { email: "integration@test.local" },
      update: {},
      create: { email: "integration@test.local" },
    });
    const analysis = await client.analysis.create({
      data: {
        ownerId: user.id,
        name: "Integration case",
        status: "ready",
      },
    });
    expect(analysis.id).toBeTruthy();

    const hitl = await client.hitlStatusRecord.create({
      data: {
        analysisId: analysis.id,
        eventId: "t1",
        status: "open",
        ownerId: user.id,
      },
    });
    expect(hitl.status).toBe("open");

    const log = await client.auditLog.create({
      data: {
        action: "integration_test",
        userId: user.id,
        details: { ok: true },
      },
    });
    expect(log.action).toBe("integration_test");
  });
});

describe.skipIf(!redisReady || !dbReady)("Redis queue integration", () => {
  beforeAll(async () => {
    await loadPrisma();
  });

  it("enqueues analysis job", async () => {
    const client = await loadPrisma();
    const { queueAnalysisJob, getJobById, shutdownQueue } = await import(
      "../../server/queue"
    );
    const user = await client.user.upsert({
      where: { email: "queue@test.local" },
      update: {},
      create: { email: "queue@test.local" },
    });
    const analysis = await client.analysis.create({
      data: {
        ownerId: user.id,
        name: "Queue case",
        status: "queued",
      },
    });
    const job = await queueAnalysisJob({
      analysisId: analysis.id,
      ownerId: user.id,
      filePaths: [],
      apiKey: "test",
    });
    expect(job.id).toBeTruthy();
    const fetched = await getJobById(String(job.id));
    expect(fetched).toBeTruthy();
    await shutdownQueue();
  });
});
