import type { Analysis } from "../types";

/**
 * Browser-side Mistral is disabled. Keys stay on the Hono server
 * (MISTRAL_API_KEY). Use analyzeViaApi() / POST /api/analyze.
 */
function rejectBrowserMistral(): never {
  throw new Error(
    "Mistral kľúč nie je dostupný v prehliadači. Analýza ide cez server (MISTRAL_API_KEY). API je nedostupné pre priame volanie z klienta."
  );
}

export async function analyzeDocument(_file: File): Promise<Analysis> {
  rejectBrowserMistral();
}

export async function analyzeMultipleFiles(_files: File[]): Promise<Analysis> {
  rejectBrowserMistral();
}
