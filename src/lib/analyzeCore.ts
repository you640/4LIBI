import { callMistralApi } from "./mistralApi";
import { chunkDocument, mergeAnalysisResults } from "./documentChunker";
import { extractTextFromBytes } from "./extractDocumentText";
import { mapWithAdaptiveConcurrency } from "./adaptiveConcurrency";
import {
  SHERLOCK_SYSTEM_PROMPT,
  buildUserPrompt,
  buildRetryJsonPrompt,
  parseAnalysisResponse,
} from "./sherlockPrompt";
import type { Analysis } from "../types";

export type SourceDocument = {
  name: string;
  mime: string;
  bytes: ArrayBuffer;
};

async function analyzeSingleChunk(
  text: string,
  documentName: string,
  apiKey: string
): Promise<Analysis> {
  const messages = [
    { role: "system" as const, content: SHERLOCK_SYSTEM_PROMPT },
    { role: "user" as const, content: buildUserPrompt(text) },
  ];

  let llmResponse = await callMistralApi(messages, {
    apiKey,
    temperature: 0.3,
    maxTokens: 16000,
    jsonObject: true,
  });

  let analysisData = parseAnalysisResponse(llmResponse, documentName);

  if (!analysisData) {
    console.warn("[Sherlock] Neplatný JSON — opakujem požiadavku…");
    llmResponse = await callMistralApi(
      [
        ...messages,
        { role: "assistant", content: llmResponse.slice(0, 4000) },
        { role: "user", content: buildRetryJsonPrompt() },
      ],
      {
        apiKey,
        temperature: 0.1,
        maxTokens: 16000,
        jsonObject: true,
      }
    );
    analysisData = parseAnalysisResponse(llmResponse, documentName);
  }

  if (!analysisData) {
    console.error("[Sherlock] Neplatná LLM odpoveď:", llmResponse.slice(0, 800));
    throw new Error("Mistral API vrátil neplatný formát JSON. Skúste znova.");
  }

  return analysisData;
}

async function analyzeText(
  text: string,
  documentName: string,
  apiKey: string,
  startTime = Date.now()
): Promise<Analysis> {
  const chunks = chunkDocument(text);
  console.log(
    `[Sherlock] Text rozdelený na ${chunks.length} blokov pre analýzu (celkovo ${text.length} znakov)`
  );

  const chunkResults = await mapWithAdaptiveConcurrency(
    chunks,
    1, // start concurrency: 1
    2, // max concurrency: 2 (safe bulk limit to avoid rate-limiting Mistral)
    async (chunk) => {
      console.log(
        `[Sherlock] Analyzujem blok ${chunk.index + 1}/${chunk.totalChunks} (strana cca ${chunk.likelyPage}, ${chunk.text.length} znakov)…`
      );
      return analyzeSingleChunk(chunk.text, documentName, apiKey);
    }
  );

  const partialAnalyses: Analysis[] = [];
  for (const res of chunkResults) {
    if (res.ok && res.res) {
      partialAnalyses.push(res.res);
    } else {
      console.error("[Sherlock] Chyba pri analýze bloku:", res.err);
      throw res.err instanceof Error ? res.err : new Error("Chyba pri analýze bloku.");
    }
  }

  const merged = mergeAnalysisResults(partialAnalyses, documentName);

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(
    `[Sherlock] Analýza dokončená za ${duration}s — ${
      merged.timeline?.length || 0
    } timeline eventov, ${merged.persons?.length || 0} osôb`
  );

  return merged;
}

export async function analyzeFilesFromBytes(
  files: SourceDocument[],
  apiKey: string
): Promise<Analysis> {
  if (files.length === 0) {
    throw new Error("Žiadne súbory na analýzu.");
  }

  const startTime = Date.now();
  const texts: string[] = [];
  const errors: string[] = [];

  for (const file of files) {
    try {
      const text = await extractTextFromBytes(
        file.bytes,
        { name: file.name, mime: file.mime },
        apiKey
      );
      if (text.trim().length >= 10) {
        texts.push(text);
      } else {
        errors.push(`${file.name}: prázdny text`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${file.name}: ${message}`);
    }
  }

  if (texts.length === 0) {
    throw new Error(
      errors.length > 0
        ? `Z žiadneho súboru sa nepodarilo prečítať text. ${errors.join(" ")}`
        : "Z žiadneho súboru sa nepodarilo prečítať text."
    );
  }

  const documentName =
    files.length === 1 ? files[0].name : `${files.length} dokumentov`;
  return analyzeText(texts.join("\n\n---\n\n"), documentName, apiKey, startTime);
}
