import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { Prisma } from "../generated/client";
import { analyzeFilesFromBytes } from "../src/lib/analyzeCore";
import { getLocalUser, prisma } from "./prisma";

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

serve(
  {
    fetch: app.fetch,
    port: PORT,
    hostname: "127.0.0.1",
  },
  (info) => {
    console.log(`[api] http://127.0.0.1:${info.port}`);
  }
);
