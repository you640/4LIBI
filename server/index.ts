import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { prisma, logAuditAction, ensureUser } from "./prisma";
import { ensureUserIdentity } from "./identity";
import type { Prisma } from "../generated/client";
import { createOCRService } from "./ocrService";
import { evaluateTravelFeasibility } from "./geospatialEngine";
import { generateCrossExamWithMistral } from "../src/lib/crossExamination";
import type { Contradiction } from "../src/types";
import { queueAnalysisJob, getJobProgress, removeAnalysisJob, type AnalysisJobData, startQueueProcessing } from "./queue";
import { bodyLimit } from "hono/body-limit";
import {
  type AuthVariables,
  authMiddleware,
  rateLimitMiddleware,
  sanitizeName,
  isUploadedFile,
  isAuthBypass,
} from "./middleware";

const PORT = Number(process.env.PORT ?? 5176);
const HOST = process.env.HOST ?? "127.0.0.1";
const MAX_FILES = 20;
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const UPLOAD_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../uploads"
);

type Variables = AuthVariables;

export const app = new Hono<{ Variables: Variables }>();

const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(",") || [
  "http://localhost:5173",
  "http://localhost:5175",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5175",
  "http://localhost:3000",
  "https://forenzdetectiv.sk",
  "https://www.forenzdetectiv.sk"
];

app.use(
  "/api/*",
  cors({
    origin: (origin) => {
      // Never return "*" together with credentials: true.
      if (!origin) return allowedOrigins[0];
      return allowedOrigins.includes(origin) ? origin : "";
    },
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "X-API-Key", "X-Owner-Id"],
    exposeHeaders: ["Content-Length", "X-Request-Id"],
    credentials: true,
    maxAge: 86400
  })
);

// Body size limit for file uploads (600MB = 20 files * 25MB + buffer)
app.use(
  "/api/*",
  bodyLimit({
    maxSize: 600 * 1024 * 1024,
    onError: (c) => {
      return c.json({ error: "Veľkosť požiadavky presiahla povolený limit (max 600 MB)." }, 413);
    },
  })
);

app.get("/api/health", (c) => {
  return c.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    version: "0.2.0-beta",
    mistralConfigured: Boolean(process.env.MISTRAL_API_KEY),
  });
});

app.use("/api/*", rateLimitMiddleware(60, 60 * 1000));
app.use("/api/*", authMiddleware);
app.use("/api/*", async (c, next) => {
  await ensureUserIdentity(prisma, c.get("ownerId"), c.get("userEmail"));
  await next();
});

app.onError((err, c) => {
  console.error(err);
  const code =
    err && typeof err === "object" && "code" in err
      ? String((err as { code: unknown }).code)
      : "";
  if (code === "ECONNREFUSED" || code === "P1001" || code === "P1017") {
    return c.json(
      {
        error:
          "Databáza nie je dostupná. Spustite: npx prisma dev --name forenzdetectiv --detach",
      },
      503
    );
  }
  return c.json(
    { error: err instanceof Error ? err.message : "Server error" },
    500
  );
});

// 1. Sherlock Batch Analysis (Asynchronous Job Queue)
app.post("/api/analyze", async (c) => {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) {
    return c.json({ error: "Chýba MISTRAL_API_KEY na serveri." }, 500);
  }

  const form = await c.req.formData();
  const entries = form.getAll("files").filter(isUploadedFile);
  if (entries.length === 0) {
    return c.json({ error: "Nahrajte aspoň jeden súbor." }, 400);
  }
  if (entries.length > MAX_FILES) {
    return c.json({ error: `Maximálne ${MAX_FILES} súborov.` }, 400);
  }

  const ownerId = c.get("ownerId");
  const userEmail = c.get("userEmail");
  const fallbackName =
    entries.length === 1 ? entries[0].name : `${entries.length} dokumentov`;

  if (ownerId) {
    try {
      await ensureUser(ownerId, userEmail);
    } catch (err) {
      console.warn("[/api/analyze] ensureUser warning:", err);
    }
  }

  // Log audit action
  await logAuditAction(ownerId, "analysis_start", {
    fileCount: entries.length,
    totalSize: entries.reduce((sum, f) => sum + f.size, 0),
    names: entries.map((f) => f.name),
  });

  // Create analysis record
  const analysis = await prisma.analysis.create({
    data: {
      ownerId,
      name: fallbackName,
      status: "queued",
      metadata: {
        email: userEmail,
        fileCount: entries.length
      }
    },
  });

  const analysisDir = path.join(UPLOAD_DIR, analysis.id);
  await mkdir(analysisDir, { recursive: true });

  try {
    const docs: { name: string; mime: string; bytes: ArrayBuffer; size: number }[] = [];

    for (const [index, file] of entries.entries()) {
      if (file.size > MAX_FILE_BYTES) {
        throw new Error(`Súbor ${file.name} je príliš veľký (max 25 MB).`);
      }

      const bytes = await file.arrayBuffer();
      const storedName = `${index + 1}-${sanitizeName(file.name)}`;
      const storagePath = path.join(analysisDir, storedName);
      await writeFile(storagePath, Buffer.from(bytes));

      await prisma.file.create({
        data: {
          ownerId,
          name: file.name,
          storagePath,
          contentType: file.type || "application/octet-stream",
          size: file.size,
          analyses: { connect: { id: analysis.id } },
        },
      });

      docs.push({
        name: file.name,
        mime: file.type || "",
        bytes,
        size: file.size,
      });
    }

    const filePaths: AnalysisJobData["filePaths"] = [];
    for (let i = 0; i < docs.length; i++) {
      const storedName = `${i + 1}-${sanitizeName(docs[i].name)}`;
      const storagePath = path.join(analysisDir, storedName);
      filePaths.push({
        name: docs[i].name,
        path: storagePath,
        mime: docs[i].mime,
        size: docs[i].size,
      });
    }

    await queueAnalysisJob({
      analysisId: analysis.id,
      ownerId,
      filePaths,
      apiKey,
    });

    await prisma.analysis.update({
      where: { id: analysis.id },
      data: {
        status: "queued",
        metadata: {
          ...(analysis.metadata as object || {}),
          files: docs.map(d => ({ name: d.name, mime: d.mime, size: d.size })),
          queuedAt: new Date().toISOString()
        }
      }
    });

    return c.json({
      id: analysis.id,
      name: analysis.name,
      status: "queued",
      createdAt: analysis.createdAt,
      message: "Analýza bola zaradená do spracovania.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await prisma.analysis.update({
      where: { id: analysis.id },
      data: { status: "error", errorMessage: message },
    });
    return c.json({ error: message, id: analysis.id }, 500);
  }
});

// Job Progress
app.get("/api/analyses/:id/progress", async (c) => {
  const ownerId = c.get("ownerId");
  const analysisId = c.req.param("id");

  const analysis = await prisma.analysis.findFirst({
    where: { id: analysisId, ownerId },
    select: { id: true, status: true, errorMessage: true },
  });

  if (!analysis) {
    return c.json({ error: "Spis sa nenašiel alebo nemáte oprávnenie." }, 404);
  }

  const progress = await getJobProgress(analysisId);
  return c.json({
    analysisId,
    status: analysis.status,
    errorMessage: analysis.errorMessage,
    progress,
  });
});


// 2. ForenzDirect Analysis (Text & Vision)
app.post("/api/forenz/analyze", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { text, image_url, title } = body as { text?: string; image_url?: string; title?: string };

  if (!text && !image_url) {
    return c.json({ error: "Chýba text výpovede alebo obrázok dokumentu." }, 400);
  }

  const mainApiKey = process.env.MISTRAL_API_KEY || "";
  const backupApiKey = process.env.MISTRAL_BACKUP_API_KEY || process.env.MISTRAL_OCR_API_KEY || "";
  const keysToTry = [mainApiKey, backupApiKey].filter(k => !!k && k.trim().length > 10);

  const isVision = !!image_url && image_url.startsWith("data:");
  const model = isVision ? "pixtral-large-latest" : "mistral-large-latest";

  const systemPrompt = `Si ForenzDetectiv AI & Base44 Engine — špecializovaný systém na forenznú analýzu výpovedí, alibi a dôkazov.
Výstup MUSÍ byť VŽDY v čistom JSON formáte:
{
  "summary": "<súhrn>",
  "nodes": [{"id": "p1", "label": "<Meno>", "type": "podozrivý|svedok|obeť|alibi", "details": "<popis>"}],
  "edges": [{"source": "p1", "target": "p2", "label": "<vzťah>", "description": "<popis>"}],
  "red_flags": ["<nezrovnalosť>"],
  "flagged_passages": [{"text": "<citát>", "category": "rozpor|neistota", "explanation": "<dôvod>"}],
  "events": [{"title": "<názov>", "type": "čin|stretnutie|cesta", "persons": ["<Meno>"], "time": "HH:MM", "date": "YYYY-MM-DD", "description": "<popis>", "confidence": 0.9}],
  "claims": [{"subject": "<osoba>", "predicate": "was_at|saw|had", "object": "<miesto/vec>", "event_time": "HH:MM", "location": "<miesto>", "source_quote": "<citát>", "confidence": 0.9}]
}`;

  const userContent = isVision
    ? [
      { type: "text", text: `Analyzuj túto odfotenú výpoveď "${title || 'Dokument'}".` },
      { type: "image_url", image_url: { url: image_url } }
    ]
    : `Analyzuj výpoveď "${title || 'Dokument'}":\n\n${text}`;

  for (const apiKey of keysToTry) {
    try {
      const messages: Array<{ role: string; content: unknown }> = [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent }
      ];

      const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey.trim()}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model,
          temperature: 0.1,
          response_format: { type: "json_object" },
          messages
        })
      });

      if (!response.ok) {
        if (response.status === 402 || response.status === 401) {
          console.warn(`[ForenzAnalyze] Mistral kľúč zlyhal (${response.status}), skúšam záložný kľúč...`);
          continue;
        }
        const errText = await response.text();
        throw new Error(`Mistral API status ${response.status}: ${errText}`);
      }

      const aiData = await response.json();
      const raw = aiData.choices?.[0]?.message?.content || "{}";
      const cleaned = raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
      let parsed;
      try {
        parsed = JSON.parse(cleaned);
      } catch {
        // Base44 Self-Correction Prompt
        console.warn("[ForenzAnalyze] Nevalidný JSON z Mistral, spúšťam Base44 self-correction...");
        const correctionRes = await fetch("https://api.mistral.ai/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey.trim()}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model,
            temperature: 0.1,
            response_format: { type: "json_object" },
            messages: [
              ...messages,
              { role: "assistant", content: raw },
              { role: "user", content: "Tvoja odpoveď nebola validné JSON. Oprav ju a vráť IBA validné JSON bez markdown." }
            ]
          })
        });
        if (correctionRes.ok) {
          const corrData = await correctionRes.json();
          const corrRaw = corrData.choices?.[0]?.message?.content || "{}";
          parsed = JSON.parse(corrRaw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim());
        }
      }

      if (parsed) {
        return c.json({
          ok: true,
          source: "mistral_ai",
          model,
          data: parsed
        });
      }
    } catch (err: unknown) {
      console.warn("[ForenzAnalyze] Pokus s Mistral kľúčom zlyhal:", err instanceof Error ? err.message : String(err));
    }
  }

  // 3. Fallback na Base44 lokálny heuristický engine
  console.info("[ForenzAnalyze] Aktivujem Base44 lokálny heuristický engine.");
  const rawText = String(text || "");
  const timeMatches = Array.from(rawText.matchAll(/(\b[0-2]?[0-9][:.][0-5][0-9]\b)/g)).map(m => m[1]);

  return c.json({
    ok: true,
    source: "base44_local_engine",
    data: {
      summary: rawText.slice(0, 250) + (rawText.length > 250 ? "..." : ""),
      nodes: [{ id: "node_1", label: title || "Svedok", type: "svedok", details: "Extrahované z dokumentu cez Base44" }],
      edges: [],
      red_flags: timeMatches.length === 0 ? ["Výpoveď neobsahuje žiadne konkrétne časové údaje."] : [],
      events: timeMatches.map((t) => ({ title: `Záznam o ${t}`, time: t, date: new Date().toISOString().slice(0, 10), confidence: 0.85 })),
      claims: timeMatches.map(t => ({ subject: title || "Svedok", predicate: "was_at", object: "Miesto konania", event_time: t, confidence: 0.85 }))
    }
  });

});

// 3. Forenz OCR Endpoint
app.post("/api/forenz/ocr", async (c) => {
  const ownerId = c.get("ownerId");
  const body = await c.req.json().catch(() => ({}));
  const { fileBase64, fileName, mimeType, caseId } = body as { fileBase64?: string; fileName?: string; mimeType?: string; caseId?: string };

  if (!fileBase64) {
    return c.json({ error: "Chýbajú dáta súboru (fileBase64)" }, 400);
  }

  try {
    const ocrService = createOCRService();
    const result = await ocrService.extractFromImageBase64(fileBase64, mimeType || "image/jpeg");
    const sha256 = crypto.createHash("sha256").update(fileBase64).digest("hex");

    await prisma.ocrResult.create({
      data: {
        ownerId,
        fileName: fileName || "dokument",
        mimeType: mimeType || "image/jpeg",
        sourceType: result.sourceType,
        extractedText: result.text,
        processingTimeMs: result.processingTimeMs,
        sha256Hash: sha256,
        caseId: caseId || null,
      }
    });

    return c.json({
      success: true,
      document: {
        id: `doc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        case_id: caseId || "default_case",
        file_name: fileName || "dokument",
        source_type: result.sourceType,
        extracted_text: result.text,
        sha256_hash: sha256,
        status: "processed",
        processing_time_ms: result.processingTimeMs
      }
    });
  } catch (err: unknown) {
    return c.json({ error: `OCR chyba: ${err instanceof Error ? err.message : String(err)}` }, 500);
  }
});

// 4. Conversational Forensic Agent Chat
app.post("/api/agent/chat", async (c) => {
  const ownerId = c.get("ownerId");
  const body = await c.req.json().catch(() => ({}));
  const apiKey = process.env.MISTRAL_API_KEY;
  const { message, history } = body as { message?: string; history?: Array<{ role?: string; content?: string }> };

  if (!message) {
    return c.json({ error: "Správa nemôže byť prázdna." }, 400);
  }

  await prisma.conversationLog.create({
    data: {
      ownerId,
      userMessage: message,
      history: (history as unknown as Prisma.InputJsonValue) || [],
    }
  });

  if (!apiKey) {
    return c.json({
      success: true,
      role: "assistant",
      content: `[Offline režim] Otázka prijatá: ${message}`,
      created_date: new Date().toISOString()
    });
  }

  try {
    const formattedMessages = [
      {
        role: "system",
        content: "Si ForenzDetectiv AI Asistent — špecializovaný vyšetrovací expert na forenznú analýzu trestných spisov, krížovú kontrolu výpovedí, odhaľovanie rozporov v alibi a analýzu vzťahových sietí. Odpovedaj vecne, logicky a profesionálne v slovenskom jazyku."
      },
      ...(history || []).map((h) => ({
        role: h.role === "user" ? "user" : "assistant",
        content: String(h.content || "")
      })),
      { role: "user", content: String(message) }
    ];

    const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey.trim()}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "mistral-large-latest",
        temperature: 0.2,
        messages: formattedMessages
      })
    });

    if (!response.ok) {
      throw new Error(`Mistral API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    return c.json({
      success: true,
      role: "assistant",
      content,
      created_date: new Date().toISOString()
    });
  } catch (err: unknown) {
    return c.json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});

// 5. Geospatial Feasibility Check
app.post("/api/geospatial/check", async (c) => {
  const ownerId = c.get("ownerId");
  const body = await c.req.json().catch(() => ({}));
  const { locA, timeA, locB, timeB, personName } = body as {
    locA: string;
    timeA: string;
    locB: string;
    timeB: string;
    personName?: string;
  };

  await prisma.geospatialCheck.create({
    data: {
      ownerId,
      locationA: locA,
      timeA,
      locationB: locB,
      timeB,
      personName: personName || null,
    }
  });

  const result = evaluateTravelFeasibility(locA, timeA, locB, timeB, personName);
  return c.json({ success: true, result });
});

app.post("/api/cross-exam", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const {
    contradictions = [],
    contextText = "",
    mode = "alibi",
  } = body as {
    contradictions?: Contradiction[];
    contextText?: string;
    mode?: "mild" | "aggressive" | "alibi";
  };

  if (!Array.isArray(contradictions) || contradictions.length === 0) {
    return c.json({ error: "contradictions required" }, 400);
  }

  const apiKey = process.env.MISTRAL_API_KEY || "";
  const questions = await generateCrossExamWithMistral(
    contradictions,
    String(contextText || ""),
    apiKey,
    mode
  );

  return c.json({
    success: true,
    questions,
    source: apiKey ? "mistral" : "local",
  });
});

// Analysis CRUD
app.get("/api/analyses", async (c) => {
  const ownerId = c.get("ownerId");
  const rows = await prisma.analysis.findMany({
    where: { ownerId },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, status: true, createdAt: true, metadata: true },
  });
  return c.json(rows);
});

app.get("/api/analyses/:id", async (c) => {
  const ownerId = c.get("ownerId");
  const row = await prisma.analysis.findFirst({
    where: { id: c.req.param("id"), ownerId },
    include: {
      files: {
        select: { id: true, name: true, size: true, contentType: true }
      }
    }
  });
  if (!row) {
    return c.json({ error: "Spis sa nenašiel alebo nemáte oprávnenie." }, 404);
  }
  return c.json({
    id: row.id,
    name: row.name,
    status: row.status,
    createdAt: row.createdAt,
    errorMessage: row.errorMessage,
    data: row.data,
    metadata: row.metadata,
    files: row.files,
  });
});

app.patch("/api/analyses/:id", async (c) => {
  const ownerId = c.get("ownerId");
  const id = c.req.param("id");
  if (!ownerId) {
    return c.json({ error: "Vyžaduje sa autentifikácia." }, 401);
  }

  const body = await c.req.json().catch(() => ({}));
  const rawName = typeof (body as { name?: unknown }).name === "string"
    ? (body as { name: string }).name
    : "";
  const name = sanitizeName(rawName);
  if (!name.trim()) {
    return c.json({ error: "Chýba platný názov spisu." }, 400);
  }

  const owned = await prisma.analysis.findFirst({
    where: { id, ownerId },
    select: { id: true },
  });
  if (!owned) {
    return c.json({ error: "Spis sa nenašiel alebo nemáte oprávnenie." }, 404);
  }

  const updated = await prisma.analysis.update({
    where: { id },
    data: { name: name.trim(), updatedAt: new Date() },
    select: { id: true, name: true, status: true, createdAt: true },
  });

  await logAuditAction(ownerId, "case_renamed", { caseId: id, name: name.trim() });
  return c.json(updated);
});

app.delete("/api/analyses/:id", async (c) => {
  const ownerId = c.get("ownerId");
  const id = c.req.param("id");
  if (!ownerId) {
    return c.json({ error: "Vyžaduje sa autentifikácia." }, 401);
  }

  const owned = await prisma.analysis.findFirst({
    where: { id, ownerId },
    select: { id: true },
  });
  if (!owned) {
    return c.json({ error: "Spis sa nenašiel alebo nemáte oprávnenie." }, 404);
  }

  await prisma.hitlStatusRecord.deleteMany({
    where: { analysisId: id, ownerId }
  });

  await removeAnalysisJob(id);

  const analysisDir = path.join(UPLOAD_DIR, id);
  try {
    const { rm } = await import("node:fs/promises");
    await rm(analysisDir, { recursive: true, force: true });
  } catch (err) {
    console.warn("Failed to remove analysis directory:", err);
  }

  const deleted = await prisma.analysis.deleteMany({
    where: { id, ownerId }
  });

  await logAuditAction(ownerId, "case_deleted", { caseId: id });
  return c.json({ success: true, count: deleted.count });
});

app.delete("/api/analyses", async (c) => {
  const ownerId = c.get("ownerId");
  if (!ownerId) {
    return c.json({ error: "Vyžaduje sa autentifikácia." }, 401);
  }

  const owned = await prisma.analysis.findMany({
    where: { ownerId },
    select: { id: true },
  });

  for (const row of owned) {
    await removeAnalysisJob(row.id);
  }

  try {
    const { rm } = await import("node:fs/promises");
    for (const row of owned) {
      await rm(path.join(UPLOAD_DIR, row.id), { recursive: true, force: true });
    }
  } catch (err) {
    console.warn("Failed to clean owner upload directories:", err);
  }

  await prisma.hitlStatusRecord.deleteMany({
    where: { ownerId }
  });

  const deleted = await prisma.analysis.deleteMany({
    where: { ownerId }
  });

  await prisma.file.deleteMany({
    where: { ownerId }
  });

  await logAuditAction(ownerId, "all_cases_deleted", { count: deleted.count });
  return c.json({ success: true, count: deleted.count });
});



// 6. HITL Contradiction Status Endpoints
app.get("/api/analyses/:id/hitl", async (c) => {
  const analysisId = c.req.param("id");
  const ownerId = c.get("ownerId");
  if (!ownerId) {
    return c.json({ error: "Vyžaduje sa autentifikácia." }, 401);
  }
  const owned = await prisma.analysis.findFirst({
    where: { id: analysisId, ownerId },
    select: { id: true },
  });
  if (!owned) {
    return c.json({ error: "Spis sa nenašiel alebo nemáte oprávnenie." }, 404);
  }
  const records = await prisma.hitlStatusRecord.findMany({
    where: { analysisId, ownerId },
  });
  const map: Record<string, string> = {};
  for (const r of records) {
    map[r.eventId] = r.status;
  }
  return c.json({ success: true, statuses: map });
});

app.post("/api/analyses/:id/hitl", async (c) => {
  const analysisId = c.req.param("id");
  const ownerId = c.get("ownerId");
  if (!ownerId) {
    return c.json({ error: "Vyžaduje sa autentifikácia." }, 401);
  }
  const owned = await prisma.analysis.findFirst({
    where: { id: analysisId, ownerId },
    select: { id: true },
  });
  if (!owned) {
    return c.json({ error: "Spis sa nenašiel alebo nemáte oprávnenie." }, 404);
  }
  const body = await c.req.json().catch(() => ({}));
  const { eventId, status } = body as { eventId?: string; status?: string };

  if (!eventId || !status) {
    return c.json({ error: "Chýba eventId alebo status" }, 400);
  }

  const updated = await prisma.hitlStatusRecord.upsert({
    where: {
      analysisId_eventId: {
        analysisId,
        eventId,
      },
    },
    update: { status },
    create: {
      analysisId,
      eventId,
      status,
      ownerId,
    },
  });

  return c.json({ success: true, record: updated });
});

// 7. Audit Log Endpoints
app.get("/api/audit-logs", async (c) => {
  const ownerId = c.get("ownerId");
  if (!ownerId) {
    return c.json({ error: "Vyžaduje sa autentifikácia." }, 401);
  }
  const limit = Math.min(Number(c.req.query("limit") || 100), 500);
  const logs = await prisma.auditLog.findMany({
    where: { userId: ownerId },
    take: limit,
    orderBy: { timestamp: "desc" },
  });
  return c.json({ success: true, logs });
});

app.post("/api/audit-logs", async (c) => {
  const ownerId = c.get("ownerId");
  const body = await c.req.json().catch(() => ({}));
  const { action, details } = body as { action?: string; details?: Record<string, unknown> };

  if (!action) {
    return c.json({ error: "Chýba action" }, 400);
  }

  const log = await logAuditAction(ownerId, action, details);
  return c.json({ success: true, log });
});

function validateProductionEnv(): void {
  if (process.env.NODE_ENV !== "production") return;

  if (isAuthBypass()) {
    console.warn(
      "[PROD] WARNING: ENABLE_AUTH=false — auth bypass is active. Do not use in production."
    );
    return;
  }

  const missing: string[] = [];
  const jwtSecret = process.env.JWT_SECRET?.trim() ?? "";
  const apiKey = process.env.API_KEY?.trim() ?? "";

  if (!jwtSecret || jwtSecret.length < 32) {
    missing.push("JWT_SECRET (min. 32 characters)");
  }
  if (!apiKey) {
    missing.push("API_KEY");
  }

  if (missing.length > 0) {
    console.error(`[PROD] Missing required auth environment variables: ${missing.join(", ")}`);
    process.exit(1);
  }

  const corsOrigins = process.env.ALLOWED_ORIGINS?.trim() || "(default dev origins)";
  console.log(`[PROD] Auth is ENABLED. Monitoring CORS for: ${corsOrigins}`);
}

function listen(attempt = 0) {
  validateProductionEnv();
  // Bind HTTP first so platform healthchecks pass even if Redis/worker init is slow.
  const server = serve(
    {
      fetch: app.fetch,
      port: PORT,
      hostname: HOST,
    },
    (info) => {
      console.log(`[api] http://${HOST}:${info.port}`);
      try {
        startQueueProcessing();
      } catch (err) {
        console.error("[Queue] Failed to start worker (API still serving):", err);
      }
    }
  );

  server.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE" && attempt < 10) {
      setTimeout(() => listen(attempt + 1), 300);
      return;
    }
    if (err.code === "EADDRINUSE") {
      console.error(
        `[api] port ${PORT} is already in use. Stop the other process or run: node scripts/free-dev-ports.mjs ${PORT}`
      );
      process.exit(1);
    }
    throw err;
  });
}

const isTestRuntime =
  process.env.VITEST === "true" ||
  process.env.NODE_ENV === "test" ||
  process.env.SKIP_LISTEN === "1";

if (!isTestRuntime) {
  listen();
}
