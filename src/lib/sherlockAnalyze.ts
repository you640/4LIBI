import { analyzeFilesFromBytes } from "./analyzeCore";
import type { Analysis } from "../types";

function requireApiKey(): string {
  const apiKey = import.meta.env.VITE_MISTRAL_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Chýba VITE_MISTRAL_API_KEY — nastavte v .env súbore. Bez kľúča nie je možná reálna analýza."
    );
  }
  return apiKey;
}

export async function analyzeDocument(file: File): Promise<Analysis> {
  return analyzeFilesFromBytes(
    [{ name: file.name, mime: file.type, bytes: await file.arrayBuffer() }],
    requireApiKey()
  );
}

export async function analyzeMultipleFiles(files: File[]): Promise<Analysis> {
  if (files.length === 0) {
    throw new Error("Žiadne súbory na analýzu.");
  }

  const docs = await Promise.all(
    files.map(async (file) => ({
      name: file.name,
      mime: file.type,
      bytes: await file.arrayBuffer(),
    }))
  );

  return analyzeFilesFromBytes(docs, requireApiKey());
}
