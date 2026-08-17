import { callMistralApi } from "./mistralApi";
import { truncateText } from "./pdfParser";
import { extractTextFromBytes } from "./extractDocumentText";
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

async function analyzeText(
  text: string,
  documentName: string,
  apiKey: string,
  startTime = Date.now()
): Promise<Analysis> {
  const truncatedText = truncateText(text);
  console.log(
    `[Sherlock] Text extrahovaný (${text.length} znakov, po skrátení ${truncatedText.length})`
  );

  console.log("[Sherlock] Volám Mistral API…");
  const messages = [
    { role: "system" as const, content: SHERLOCK_SYSTEM_PROMPT },
    { role: "user" as const, content: buildUserPrompt(truncatedText) },
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

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(
    `[Sherlock] Analýza dokončená za ${duration}s — ${
      analysisData.timeline?.length || 0
    } timeline eventov, ${analysisData.persons?.length || 0} osôb`
  );

  return analysisData;
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
