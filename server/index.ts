import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { Prisma } from "../generated/client";
import { analyzeFilesFromBytes } from "../src/lib/analyzeCore";
import { getLocalUser, prisma } from "./prisma";
import { createOCRService } from "./ocrService";
import { evaluateTravelFeasibility } from "./geospatialEngine";

const PORT = 5176;
const MAX_FILES = 20;
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const UPLOAD_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../uploads"
);

function sanitizeName(name: string): string {
  return name.replace(/[^\w.\- ()[\]]+/g, "_").slice(0, 180) || "document";
}

function isUploadedFile(value: FormDataEntryValue): value is File {
  return typeof File !== "undefined" && value instanceof File;
}

const app = new Hono();

app.use("/api/*", cors());

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

// 1. Sherlock Batch Analysis
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

  const user = await getLocalUser();
  const fallbackName =
    entries.length === 1 ? entries[0].name : `${entries.length} dokumentov`;

  const analysis = await prisma.analysis.create({
    data: {
      ownerId: user.id,
      name: fallbackName,
      status: "analyzing",
    },
  });

  const analysisDir = path.join(UPLOAD_DIR, analysis.id);
  await mkdir(analysisDir, { recursive: true });

  try {
    const docs: { name: string; mime: string; bytes: ArrayBuffer }[] = [];

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
          ownerId: user.id,
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
      });
    }

    const data = await analyzeFilesFromBytes(docs, apiKey);
    const updated = await prisma.analysis.update({
      where: { id: analysis.id },
      data: {
        status: "ready",
        data: data as unknown as Prisma.InputJsonValue,
        name: data.metadata?.document_name || fallbackName,
      },
    });

    return c.json({
      id: updated.id,
      name: updated.name,
      status: updated.status,
      createdAt: updated.createdAt,
      data: updated.data,
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

// 2. ForenzDetectiv Direct Analysis (Text & Vision)
app.post("/api/forenz/analyze", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { text, image_url, title, apiKey: clientApiKey } = body;

  if (!text && !image_url) {
    return c.json({ error: "Chýba text výpovede alebo obrázok dokumentu." }, 400);
  }

  const apiKey = clientApiKey || process.env.MISTRAL_API_KEY;

  if (apiKey && apiKey.trim().length > 10) {
    try {
      const isVision = !!image_url && image_url.startsWith("data:");
      const model = isVision ? "pixtral-12b-2409" : "mistral-large-latest";

      const systemPrompt = `Si ForenzDetectiv AI — špecializovaný systém na forenznú analýzu výpovedí, alibi a dôkazov.
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
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userContent }
          ]
        })
      });

      if (response.ok) {
        const aiData = await response.json();
        const raw = aiData.choices?.[0]?.message?.content || "{}";
        const cleaned = raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
        const parsed = JSON.parse(cleaned);

        return c.json({
          ok: true,
          source: "mistral_ai",
          model,
          data: parsed
        });
      }
    } catch (err: any) {
      console.warn("Mistral AI call fallback:", err.message);
    }
  }

  // Lokálny deterministický fallback
  const rawText = String(text || "");
  const timeMatches = Array.from(rawText.matchAll(/(\b[0-2]?[0-9][:.][0-5][0-9]\b)/g)).map(m => m[1]);

  return c.json({
    ok: true,
    source: "local_heuristic_engine",
    data: {
      summary: rawText.slice(0, 250) + (rawText.length > 250 ? "..." : ""),
      nodes: [{ id: "node_1", label: title || "Svedok", type: "svedok", details: "Extrahované z dokumentu" }],
      edges: [],
      red_flags: timeMatches.length === 0 ? ["Výpoveď neobsahuje žiadne konkrétne časové údaje."] : [],
      events: timeMatches.map((t) => ({ title: `Záznam o ${t}`, time: t, date: new Date().toISOString().slice(0, 10), confidence: 0.85 })),
      claims: timeMatches.map(t => ({ subject: title || "Svedok", predicate: "was_at", object: "Miesto konania", event_time: t, confidence: 0.85 }))
    }
  });
});

// 3. Forenz OCR Endpoint
app.post("/api/forenz/ocr", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { fileBase64, fileName, mimeType, caseId } = body;

  if (!fileBase64) {
    return c.json({ error: "Chýbajú dáta súboru (fileBase64)" }, 400);
  }

  try {
    const ocrService = createOCRService();
    const result = await ocrService.extractFromImageBase64(fileBase64, mimeType || "image/jpeg");
    const sha256 = crypto.createHash("sha256").update(fileBase64).digest("hex");

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
  } catch (err: any) {
    return c.json({ error: `OCR chyba: ${err.message}` }, 500);
  }
});

// 4. Conversational Forensic Agent Chat
app.post("/api/agent/chat", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const apiKey = process.env.MISTRAL_API_KEY || "";
  const { message, history } = body;

  if (!message) {
    return c.json({ error: "Správa nemôže byť prázdna." }, 400);
  }

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
      ...(history || []).map((h: any) => ({
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
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// 5. Geospatial Feasibility Check
app.post("/api/geospatial/check", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { locA, timeA, locB, timeB, personName } = body;

  const result = evaluateTravelFeasibility(locA, timeA, locB, timeB, personName);
  return c.json({ success: true, result });
});

// Analysis CRUD
app.get("/api/analyses", async (c) => {
  const user = await getLocalUser();
  const rows = await prisma.analysis.findMany({
    where: { ownerId: user.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, status: true, createdAt: true },
  });
  return c.json(rows);
});

app.get("/api/analyses/:id", async (c) => {
  const user = await getLocalUser();
  const row = await prisma.analysis.findFirst({
    where: { id: c.req.param("id"), ownerId: user.id },
  });
  if (!row) {
    return c.json({ error: "Spis sa nenašiel." }, 404);
  }
  return c.json({
    id: row.id,
    name: row.name,
    status: row.status,
    createdAt: row.createdAt,
    errorMessage: row.errorMessage,
    data: row.data,
  });
});

function listen(attempt = 0) {
  const server = serve(
    {
      fetch: app.fetch,
      port: PORT,
      hostname: "127.0.0.1",
    },
    (info) => {
      console.log(`[api] http://127.0.0.1:${info.port}`);
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

listen();
