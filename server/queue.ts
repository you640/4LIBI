import "dotenv/config";
import { Queue, Worker, Job } from "bullmq";
import IORedis from "ioredis";
import { readFile } from "node:fs/promises";
import { prisma, logAuditAction } from "./prisma";
import { analyzeFilesFromBytes } from "../src/lib/analyzeCore";

// ============================================
// REDIS CONNECTION
// ============================================
let redisConnection: IORedis | null = null;

function getRedisConnection(): IORedis {
  if (!redisConnection) {
    const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
    redisConnection = new IORedis(redisUrl, {
      maxRetriesPerRequest: null,
      enableOfflineQueue: false,
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

// ============================================
// JOB QUEUE DEFINITIONS
// ============================================

export interface AnalysisJobData {
  analysisId: string;
  ownerId: string;
  filePaths: { name: string; path: string; mime: string; size: number }[];
  apiKey: string;
}

export interface JobProgress {
  step: string;
  progress: number;
  message: string;
  currentFile?: string;
  processedFiles?: number;
  totalFiles?: number;
}

// Create queues
const analysisQueue = new Queue<AnalysisJobData>("analysis", {
  connection: getRedisConnection(),
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
    removeOnComplete: true,
    removeOnFail: false,
  },
});

// ============================================
// JOB PROCESSOR (Worker)
// ============================================

async function processAnalysisJob(job: Job<AnalysisJobData>) {
  const { analysisId, ownerId, filePaths, apiKey } = job.data;
  
  try {
    // Update analysis status
    await prisma.analysis.update({
      where: { id: analysisId },
      data: { status: "processing", updatedAt: new Date() },
    });
    
    // Update progress
    await updateJobProgress(job, {
      step: "initializing",
      progress: 0,
      message: "Inicializácia analýzy...",
      totalFiles: filePaths.length,
      processedFiles: 0,
    });
    
    // Load all files
    const docs: { name: string; mime: string; bytes: ArrayBuffer }[] = [];
    
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
        bytes: fileBuffer.buffer as ArrayBuffer,
      });
    }
    
    await updateJobProgress(job, {
      step: "extracting_text",
      progress: 35,
      message: "Extrahujem text z dokumentov...",
      totalFiles: filePaths.length,
      processedFiles: filePaths.length,
    });
    
    // Analyze files
    await updateJobProgress(job, {
      step: "analyzing",
      progress: 40,
      message: "Spúštam forenznú analýzu...",
    });
    
    const data = await analyzeFilesFromBytes(docs, apiKey);
    
    await updateJobProgress(job, {
      step: "analyzing",
      progress: 80,
      message: "Analýza prebieha...",
    });
    
    // Update analysis with results
    await prisma.analysis.update({
      where: { id: analysisId },
      data: {
        status: "ready",
        data: data as any,
        name: data.metadata?.document_name || `Analýza ${new Date().toLocaleDateString()}`,
        updatedAt: new Date(),
      },
    });
    
    // Log success
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
  } catch (error: any) {
    const errorMessage = error.message || String(error);
    
    // Update analysis status to error
    await prisma.analysis.update({
      where: { id: analysisId },
      data: {
        status: "error",
        errorMessage,
        updatedAt: new Date(),
      },
    });
    
    // Log error
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

// Create worker
const worker = new Worker<AnalysisJobData>(
  "analysis",
  processAnalysisJob,
  {
    connection: getRedisConnection(),
    concurrency: 2, // Process up to 2 jobs at once
    limiter: {
      max: 5, // Max 5 jobs per second
      duration: 1000,
    },
  }
);

worker.on("completed", (job, result) => {
  if (job) {
    console.log(`[Queue] Job ${job.id} completed:`, result);
  }
});

worker.on("failed", (job, err) => {
  if (job) {
    console.error(`[Queue] Job ${job.id} failed:`, err);
  }
});

worker.on("progress", (job, progress) => {
  if (job) {
    console.log(`[Queue] Job ${job.id} progress:`, progress);
  }
});

// ============================================
// QUEUE EXPORTS
// ============================================

export { analysisQueue, worker };

// Add job to queue
export async function queueAnalysisJob(data: AnalysisJobData) {
  const job = await analysisQueue.add("analysis", data, {
    jobId: `analysis_${data.analysisId}`,
    removeOnComplete: true,
    removeOnFail: false,
  });
  
  console.log(`[Queue] Added job ${job.id} for analysis ${data.analysisId}`);
  return job;
}

// Get job by ID (for progress tracking)
export async function getJobById(jobId: string) {
  const job = await analysisQueue.getJob(jobId);
  return job;
}

// Get job progress
export async function getJobProgress(analysisId: string) {
  const job = await analysisQueue.getJob(`analysis_${analysisId}`);
  
  if (!job) {
    // Job might already be completed and removed
    const analysis = await prisma.analysis.findUnique({
      where: { id: analysisId },
      select: { status: true, errorMessage: true },
    });
    
    return {
      status: analysis?.status || "unknown",
      progress: analysis?.status === "ready" ? 100 : (analysis?.status === "error" ? 100 : 0),
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

// Cleanup completed jobs
export async function cleanupOldJobs(days: number = 7) {
  const cutoff = days * 24 * 60 * 60 * 1000;
  await analysisQueue.clean(cutoff, 100, "completed");
  await analysisQueue.clean(cutoff, 100, "failed");
}

// Graceful shutdown
export async function shutdownQueue() {
  await worker.close();
  await analysisQueue.close();
  if (redisConnection) {
    await redisConnection.disconnect();
  }
}

// Start queue processing (call this when server starts)
export function startQueueProcessing() {
  console.log("[Queue] Worker started, waiting for jobs...");
}
