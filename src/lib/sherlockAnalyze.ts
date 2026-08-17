// Reálna Sherlock analýza — Mistral API z frontendu (naostro, žiadne demo)
// Flow: PDF súbor → pdfjs-dist extrakcia textu → Mistral API → JSON → Analysis

import { callMistralApi } from "./mistralApi";
import { extractTextFromPdf, truncateText } from "./pdfParser";
import {
  SHERLOCK_SYSTEM_PROMPT,
  buildUserPrompt,
  validateAnalysisResponse,
  extractJson,
} from "./sherlockPrompt";
import type { Analysis } from "../types";

/**
 * Analyzuje PDF súbor pomocou Mistral API — NAOSTRO.
 *
 * @param file PDF/File objekt nahraný používateľom
 * @returns Analysis (metadata, persons, evidence, relationships, timeline)
 * @throws Error ak nie je nastavený API kľúč, PDF parsing zlyhá, alebo LLM vráti neplatný JSON
 */
export async function analyzeDocument(file: File): Promise<Analysis> {
  const startTime = Date.now();
  console.log(`[Sherlock] Starting analysis for "${file.name}" (${file.size} bytes)`);

  // 1. Overenie, že je to PDF
  if (!file.type.includes("pdf") && !file.name.toLowerCase().endsWith(".pdf")) {
    // Pre textové súbory (TXT) môžeme čítať priamo
    if (file.type.includes("text") || file.name.toLowerCase().endsWith(".txt")) {
      const text = await file.text();
      return analyzeText(text, file.name);
    }
    throw new Error(
      `Nepodporovaný formát: ${file.type || file.name}. Podporované: PDF, TXT.`
    );
  }

  // 2. Extrahuj text z PDF
  console.log("[Sherlock] Extrahujem text z PDF…");
  const arrayBuffer = await file.arrayBuffer();

  let documentText: string;
  try {
    documentText = await extractTextFromPdf(arrayBuffer);
  } catch (error) {
    throw new Error(
      `PDF parsing zlyhal: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  if (!documentText || documentText.trim().length < 10) {
    throw new Error(
      "Z PDF sa nepodarilo extrahovať text. Možno je skenovaný (potrebuje OCR) alebo je prázdny."
    );
  }

  return analyzeText(documentText, file.name, startTime);
}

/**
 * Analyzuje text pomocou Mistral API — NAOSTRO.
 */
async function analyzeText(
  text: string,
  documentName: string,
  startTime?: number
): Promise<Analysis> {
  const start = startTime || Date.now();

  // 3. Skráť text pre LLM limit
  const truncatedText = truncateText(text);
  console.log(
    `[Sherlock] Text extrahovaný (${text.length} znakov, po skrátení ${truncatedText.length})`
  );

  // 4. Získaj API kľúč z env
  const apiKey = import.meta.env.VITE_MISTRAL_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Chýba VITE_MISTRAL_API_KEY — nastavte v .env súbore. Bez kľúča nie je možná reálna analýza."
    );
  }

  // 5. Zavolaj Mistral API
  console.log("[Sherlock] Volám Mistral API…");
  const llmResponse = await callMistralApi(
    [
      { role: "system", content: SHERLOCK_SYSTEM_PROMPT },
      { role: "user", content: buildUserPrompt(truncatedText) },
    ],
    {
      apiKey,
      temperature: 0.3, // nízka kreativita = presnosť (S4.5.7)
      maxTokens: 8000,
    }
  );

  // 6. Validácia JSON odpovede
  if (!validateAnalysisResponse(llmResponse)) {
    console.error("[Sherlock] Neplatná LLM odpoveď:", llmResponse.slice(0, 500));
    throw new Error("Mistral API vrátil neplatný formát JSON. Skúste znova.");
  }

  // 7. Extrahuj a doplň metadáta
  const analysisData = extractJson(llmResponse) as Analysis;

  // Doplň metadáta ak chýbajú
  if (!analysisData.metadata) {
    analysisData.metadata = {
      document_name: documentName,
      language: "sk",
      page_count: null,
      upload_date: new Date().toISOString(),
    };
  } else {
    analysisData.metadata.document_name =
      analysisData.metadata.document_name || documentName;
    analysisData.metadata.upload_date =
      analysisData.metadata.upload_date || new Date().toISOString();
  }

  const duration = ((Date.now() - start) / 1000).toFixed(2);
  console.log(
    `[Sherlock] Analýza dokončená za ${duration}s — ${
      analysisData.timeline?.length || 0
    } timeline eventov, ${analysisData.persons?.length || 0} osôb`
  );

  return analysisData;
}

/**
 * Analyzuje viacero súborov naraz — spojí texty a analyzuje ako jeden dokument.
 */
export async function analyzeMultipleFiles(files: File[]): Promise<Analysis> {
  if (files.length === 0) {
    throw new Error("Žiadne súbory na analýzu.");
  }

  if (files.length === 1) {
    return analyzeDocument(files[0]);
  }

  const startTime = Date.now();
  console.log(`[Sherlock] Analýza ${files.length} súborov…`);

  // Extrahuj text z každého súboru
  const texts: string[] = [];
  for (const file of files) {
    try {
      if (file.type.includes("pdf") || file.name.toLowerCase().endsWith(".pdf")) {
        const arrayBuffer = await file.arrayBuffer();
        const text = await extractTextFromPdf(arrayBuffer);
        texts.push(text);
      } else if (
        file.type.includes("text") ||
        file.name.toLowerCase().endsWith(".txt")
      ) {
        texts.push(await file.text());
      }
    } catch (error) {
      console.error(`[Sherlock] Preskakujem ${file.name}:`, error);
    }
  }

  if (texts.length === 0) {
    throw new Error("Z žiadneho súboru sa nepodarilo extrahovať text.");
  }

  const combinedText = texts.join("\n\n---\n\n");
  return analyzeText(combinedText, `${files.length} dokumentov`, startTime);
}
