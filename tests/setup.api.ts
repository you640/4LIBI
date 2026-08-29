import { vi } from "vitest";

vi.mock("../server/queue", () => ({
  queueAnalysisJob: vi.fn(async () => ({ id: "job_test_1" })),
  getJobProgress: vi.fn(async () => ({
    status: "queued",
    progress: 0,
    message: "Čaká v fronte",
  })),
  getJobById: vi.fn(),
  startQueueProcessing: vi.fn(),
  cleanupOldJobs: vi.fn(),
  shutdownQueue: vi.fn(),
  analysisQueue: {},
  worker: {},
}));

vi.mock("../server/ocrService", () => ({
  createOCRService: vi.fn(() => ({
    processDocument: vi.fn(async () => ({
      text: "OCR text",
      processingTimeMs: 10,
      sourceType: "image",
      sha256Hash: "abc",
    })),
  })),
}));

const analyses = new Map<string, Record<string, unknown>>();
const hitl = new Map<string, Record<string, unknown>>();
const auditLogs: Record<string, unknown>[] = [];

vi.mock("../server/prisma", () => {
  const prisma = {
    analysis: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const row = {
          id: `an_${analyses.size + 1}`,
          createdAt: new Date(),
          updatedAt: new Date(),
          errorMessage: null,
          data: null,
          ...data,
        };
        analyses.set(String(row.id), row);
        return row;
      }),
      findMany: vi.fn(async (args?: { where?: { ownerId?: string } }) =>
        [...analyses.values()].filter(
          (a) => !args?.where?.ownerId || a.ownerId === args.where.ownerId
        )
      ),
      findFirst: vi.fn(
        async (args?: { where?: { id?: string; ownerId?: string }; include?: unknown }) => {
          const row = args?.where?.id ? analyses.get(args.where.id) : undefined;
          if (!row) return null;
          if (args?.where?.ownerId && row.ownerId !== args.where.ownerId) return null;
          return { ...row, files: [] };
        }
      ),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const row = { ...analyses.get(where.id), ...data };
        analyses.set(where.id, row as Record<string, unknown>);
        return row;
      }),
      delete: vi.fn(async ({ where }: { where: { id: string } }) => {
        const row = analyses.get(where.id);
        analyses.delete(where.id);
        return row;
      }),
      deleteMany: vi.fn(async ({ where }: { where?: { ownerId?: string } }) => {
        let count = 0;
        for (const [id, row] of analyses) {
          if (!where?.ownerId || row.ownerId === where.ownerId) {
            analyses.delete(id);
            count++;
          }
        }
        return { count };
      }),
    },
    file: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
        id: `f_${Date.now()}`,
        ...data,
      })),
      deleteMany: vi.fn(async () => ({ count: 0 })),
    },
    hitlStatusRecord: {
      findMany: vi.fn(async () => [...hitl.values()]),
      upsert: vi.fn(async ({ create, update, where }: { create: Record<string, unknown>; update: Record<string, unknown>; where: { analysisId_eventId: { analysisId: string; eventId: string } } }) => {
        const key = `${where.analysisId_eventId.analysisId}:${where.analysisId_eventId.eventId}`;
        const row = { id: key, ...create, ...update };
        hitl.set(key, row);
        return row;
      }),
    },
    auditLog: {
      findMany: vi.fn(async (args?: { where?: { userId?: string } }) =>
        auditLogs.filter((l) => !args?.where?.userId || l.userId === args.where.userId)
      ),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: `log_${auditLogs.length + 1}`, timestamp: new Date(), ...data };
        auditLogs.push(row);
        return row;
      }),
    },
    ocrResult: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
        id: `ocr_1`,
        createdAt: new Date(),
        ...data,
      })),
    },
    geospatialCheck: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
        id: `geo_1`,
        createdAt: new Date(),
        ...data,
      })),
    },
    conversationLog: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
        id: `chat_1`,
        createdAt: new Date(),
        ...data,
      })),
    },
    user: {
      upsert: vi.fn(async () => ({ id: "api_user", email: "api@forenzdetectiv.local" })),
    },
  };

  return {
    prisma,
    logAuditAction: vi.fn(async () => undefined),
    getLocalUser: vi.fn(async () => ({ id: "api_user", email: "api@forenzdetectiv.local" })),
  };
});

export function resetApiMocks() {
  analyses.clear();
  hitl.clear();
  auditLogs.length = 0;
}
