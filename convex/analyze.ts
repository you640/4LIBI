// Convex node action — Sherlock analyze (Issue #10 — S4.2)
// Stiahne PDF zo storage, extrahuje text, posle do Mistral, validuje JSON, ulozi.

import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import { callMistralApi } from "../src/lib/mistralApi";
import { extractTextFromPdf, truncateText } from "../src/lib/pdfParser";
import {
  SHERLOCK_SYSTEM_PROMPT,
  buildUserPrompt,
  validateAnalysisResponse,
  extractJson,
} from "../src/lib/sherlockPrompt";

export const analyze = action({
  args: { fileIds: v.array(v.id("files")) },
  handler: async (ctx, args): Promise<string> => {
    const startTime = Date.now();
    console.log(`[Sherlock] Starting analysis for ${args.fileIds.length} files`);

    // 1. Overenie vlastnictva + stiahnutie suborov (S4.2.1, S4.2.2)
    const texts: string[] = [];
    for (const fileId of args.fileIds) {
      const file = await ctx.db.get(fileId);
      if (!file) throw new Error(`Subor ${fileId} nebol najdeny`);

      const blob = await ctx.storage.get(file.storageId);
      if (!blob) throw new Error(`Nepodarilo sa stiahnut subor ${file.name}`);

      const arrayBuffer = await blob.arrayBuffer();

      // 2. Extrahuj text z PDF (S4.2.3)
      try {
        const text = await extractTextFromPdf(arrayBuffer);
        texts.push(text);
        console.log(`[Sherlock] Extracted ${text.length} chars from ${file.name}`);
      } catch (error) {
        throw new Error(
          `PDF parsing zlyhal pre ${file.name}: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    }

    // Skombinuj texty a skrat pre LLM limit
    const combinedText = texts.join("\n\n---\n\n");
    const truncatedText = truncateText(combinedText);

    // 3. Posli do Mistral API (S4.2.4, S4.2.8)
    const apiKey = process.env.MISTRAL_API_KEY;
    if (!apiKey) {
      throw new Error("Chyba MISTRAL_API_KEY - nastavte v Convex environment variables");
    }

    const llmResponse = await callMistralApi(
      [
        { role: "system", content: SHERLOCK_SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt(truncatedText) },
      ],
      { apiKey, temperature: 0.3, maxTokens: 8000 }
    );

    // 4. Validacia JSON (S4.2.5)
    if (!validateAnalysisResponse(llmResponse)) {
      console.error("[Sherlock] Invalid LLM response:", llmResponse.slice(0, 500));
      throw new Error("LLM vratil neplatny format JSON");
    }

    // 5. Extrahuj a uloz vysledok (S4.2.6)
    const analysisData = extractJson(llmResponse);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(
      `[Sherlock] Analysis completed in ${duration}s - ${analysisData.timeline?.length || 0} timeline events`
    );

    // 6. Uloz do analyses tabulky (S4.2.6)
    const analysisId = await ctx.runMutation(api.analyses.createAnalysis, {
      fileIds: args.fileIds,
      name: `Analyza ${new Date().toLocaleDateString("sk-SK")}`,
      data: analysisData,
      status: "ready",
    });

    return analysisId;
  },
});
