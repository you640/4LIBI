import "dotenv/config";
import { Queue, Worker, Job } from "bullmq";
import IORedis from "ioredis";
import { readFile } from "node:fs/promises";
import { prisma, logAuditAction } from "./prisma";
import {
  analyzeFilesFromBytes,
  analyzeForensicLinearFromBytes,
  omitForensic,
  type SourceDocument,
} from "../src/lib/analyzeCore";
import { resolveAnalysisQueueName } from "./queueName";

let redisConnection: IORedis | null = null;
let analysisQueue: Queue<AnalysisJobData> | null = null;
let worker: Worker<AnalysisJobData> | null = null;
const ANALYSIS_QUEUE_NAME = resolveAnalysisQueueName();

function getRedisConnection(): IORedis {
  if (!redisConnection) {
    const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
    redisConnection = new IORedis(redisUrl, {
      maxRetriesPerRequest: null,
      enableOfflineQueue: false,
      lazyConnect: true,
    });

    redisConnection.on("error", (err) => {
      console.error("[Redis] Error:", err);
    });

    redisConnection.on("connect", () => {
      console.log("[Redis] Connected");
    });
  }
  return redisConnection;
}

export interface AnalysisJobData {
  analysisId: string;
  ownerId: string;
  filePaths: {
    name: string;
    path: string;
    mime: string;
    size: number;
    linearMeta?: {
      linear_project_id: string;
      linear_issue_id?: string;
      linear_document_id?: string;
      attachment_id?: string;
    };
  }[];
  apiKey: string;
  mode?: "sherlock" | "forensic";
}

export interface JobProgress {
  step: string;
  progress: number;
  message: string;
  currentFile?: string;
  processedFiles?: number;
  totalFiles?: number;
}

/** Privacy: wipe completed jobs immediately; failed jobs max 24h. */
const DEFAULT_JOB_OPTIONS = {
  attempts: 2,
  backoff: { type: "exponential" as const, delay: 1000 },
  removeOnComplete: { age: 0, count: 0 },
  removeOnFail: { age: 24 * 3600, count: 100 },
};

function getAnalysisQueue(): Queue<AnalysisJobData> {
  if (!analysisQueue) {
    analysisQueue = new Queue<AnalysisJobData>(ANALYSIS_QUEUE_NAME, {
      connection: getRedisConnection(),
      defaultJobOptions: DEFAULT_JOB_OPTIONS,
    });
  }
  return analysisQueue;
}

async function processAnalysisJob(job: Job<AnalysisJobData>) {
  const { analysisId, ownerId, filePaths, apiKey, mode = "sherlock" } = job.data;

  try {
    await prisma.analysis.update({
      where: { id: analysisId },
      data: { status: "processing", updatedAt: new Date() },
    });

    await updateJobProgress(job, {
      step: "initializing",
      progress: 0,
      message: "Inicializácia analýzy...",
      totalFiles: filePaths.length,
      processedFiles: 0,
    });

    const docs: SourceDocument[] = [];

    for (let i = 0; i < filePaths.length; i++) {
      const filePath = filePaths[i];

      await updateJobProgress(job, {
        step: "loading_files",
        progress: (i / filePaths.length) * 30,
        message: `Nahrávanie súboru ${i + 1}/${filePaths.length}: ${filePath.name}`,
        currentFile: filePath.name,
        totalFiles: filePaths.length,
        processedFiles: i + 1,
      });

      const fileBuffer = await readFile(filePath.path);
      docs.push({
        name: filePath.name,
        mime: filePath.mime,
        bytes: fileBuffer.buffer.slice(
          fileBuffer.byteOffset,
          fileBuffer.byteOffset + fileBuffer.byteLength
        ) as ArrayBuffer,
        linearMeta: filePath.linearMeta,
      });
    }

    await updateJobProgress(job, {
      step: "extracting_text",
      progress: 35,
      message: "Extrahujem text z dokumentov...",
      totalFiles: filePaths.length,
      processedFiles: filePaths.length,
    });

    await updateJobProgress(job, {
      step: "analyzing",
      progress: 40,
      message:
        mode === "forensic"
          ? "Spúšťam forenznú analýzu troch otázok..."
          : "Spúšťam lokálnu Sherlock analýzu...",
    });

    const data =
      mode === "forensic"
        ? await analyzeForensicLinearFromBytes(docs, apiKey)
        : omitForensic(await analyzeFilesFromBytes(docs, apiKey));

    await updateJobProgress(job, {
      step: "analyzing",
      progress: 80,
      message: "Analýza prebieha...",
    });

    await prisma.analysis.update({
      where: { id: analysisId },
      data: {
        status: "ready",
        data: data as unknown as import("../generated/client").Prisma.InputJsonValue,
        name: data.metadata?.document_name || `Analýza ${new Date().toLocaleDateString()}`,
        updatedAt: new Date(),
      },
    });

    await logAuditAction(ownerId, "analysis_complete", {
      analysisId,
      fileCount: filePaths.length,
      status: "ready",
    });

    await updateJobProgress(job, {
      step: "completed",
      progress: 100,
      message: "Analýza dokončená!",
      totalFiles: filePaths.length,
      processedFiles: filePaths.length,
    });

    return { success: true, analysisId };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    await prisma.analysis.update({
      where: { id: analysisId },
      data: {
        status: "error",
        errorMessage,
        updatedAt: new Date(),
      },
    });

    await logAuditAction(ownerId, "analysis_error", {
      analysisId,
      error: errorMessage,
    });

    await updateJobProgress(job, {
      step: "error",
      progress: 100,
      message: `Chyba: ${errorMessage}`,
    });

    throw error;
  }
}

async function updateJobProgress(job: Job, progress: JobProgress) {
  await job.updateProgress(progress);
  console.log(`[Job ${job.id}] ${progress.step}: ${progress.message} (${progress.progress}%)`);
}

function getWorker(): Worker<AnalysisJobData> {
  if (!worker) {
    worker = new Worker<AnalysisJobData>(ANALYSIS_QUEUE_NAME, processAnalysisJob, {
      connection: getRedisConnection(),
      concurrency: 2,
      limiter: { max: 5, duration: 1000 },
    });

    worker.on("completed", (job, result) => {
      if (job) console.log(`[Queue] Job ${job.id} completed:`, result);
    });
    worker.on("failed", (job, err) => {
      if (job) console.error(`[Queue] Job ${job.id} failed:`, err);
    });
    worker.on("progress", (job, progress) => {
      if (job) console.log(`[Queue] Job ${job.id} progress:`, progress);
    });
  }
  return worker;
}

export { getAnalysisQueue as analysisQueue, getWorker as worker };

export async function queueAnalysisJob(data: AnalysisJobData) {
  const job = await getAnalysisQueue().add("analysis", data, {
    jobId: `analysis_${data.analysisId}`,
    ...DEFAULT_JOB_OPTIONS,
  });

  console.log(`[Queue] Added job ${job.id} for analysis ${data.analysisId}`);
  return job;
}

/** Privacy: manuálne odstránenie jobu z Redis fronty pri zmazaní spisu. */
export async function removeAnalysisJob(analysisId: string): Promise<void> {
  try {
    const jobId = `analysis_${analysisId}`;
    const job = await getAnalysisQueue().getJob(jobId);
    if (job) {
      await job.remove();
      console.log(`[Privacy] Job ${jobId} bol úspešne odstránený z fronty.`);
    }
  } catch (err) {
    console.warn(`[Privacy] Nepodarilo sa odstrániť job pre analýzu ${analysisId}:`, err);
  }
}

export async function getJobById(jobId: string) {
  return getAnalysisQueue().getJob(jobId);
}

export async function getJobProgress(analysisId: string) {
  const job = await getAnalysisQueue().getJob(`analysis_${analysisId}`);

  if (!job) {
    const analysis = await prisma.analysis.findUnique({
      where: { id: analysisId },
      select: { status: true, errorMessage: true },
    });

    return {
      status: analysis?.status || "unknown",
      progress:
        analysis?.status === "ready"
          ? 100
          : analysis?.status === "error"
            ? 100
            : 0,
      message: analysis?.errorMessage || "Analýza sa spracúva...",
    };
  }

  const state = await job.getState();
  const progress = job.progress;

  return {
    id: job.id,
    state,
    progress,
    timestamp: job.timestamp,
  };
}

export async function cleanupOldJobs(days: number = 7) {
  const cutoff = days * 24 * 60 * 60 * 1000;
  await getAnalysisQueue().clean(cutoff, 100, "completed");
  await getAnalysisQueue().clean(cutoff, 100, "failed");
}

export async function shutdownQueue() {
  if (worker) await worker.close();
  if (analysisQueue) await analysisQueue.close();
  if (redisConnection) await redisConnection.disconnect();
  worker = null;
  analysisQueue = null;
  redisConnection = null;
}

export function startQueueProcessing() {
  getWorker();
  console.log(`[Queue] Worker started on ${ANALYSIS_QUEUE_NAME}, waiting for jobs...`);
}
