// PDF text extraction pomocou pdfjs-dist (Issue #10 — S4.2.3)
// Convex node action kompatibilný — používa pdfjs-dist (nie pdf-parse).

/**
 * Extrahuje text z PDF bufferu (ArrayBuffer).
 * Funguje v Node.js (Convex) aj v prehliadači.
 */
export async function extractTextFromPdf(
  pdfBuffer: ArrayBuffer
): Promise<string> {
  // Dynamický import pdfjs-dist (lazy-load — Issue S2.3.4)
  const pdfjsLib = await import("pdfjs-dist");

  // Prehliadač: pdfjs-dist 6 vyžaduje workerSrc (disableWorker v browseri nestačí)
  if (typeof window !== "undefined" && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
    const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
    pdfjsLib.GlobalWorkerOptions.workerSrc = worker.default;
  }

  const loadingTask = pdfjsLib.getDocument({
    data: pdfBuffer,
    // disableWorker nie je v typoch, ale funguje v Node.js / Convex
    ...(typeof window === "undefined" ? ({ disableWorker: true } as any) : {}),
  });

  const pdf = await loadingTask.promise;
  let fullText = "";

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();

    // Spoj text itemov s medzerami
    const pageText = textContent.items
      .map((item: any) => item.str)
      .join(" ");

    fullText += pageText + "\n\n";
  }

  return fullText.trim();
}

/**
 * Validácia, či je súbor PDF (podľa magic bytes).
 */
export function isPdf(buffer: ArrayBuffer): boolean {
  const bytes = new Uint8Array(buffer.slice(0, 5));
  const header = String.fromCharCode(...bytes);
  return header.startsWith("%PDF");
}

/**
 * Odhad počtu tokenov (1 token ≈ 4 znaky).
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Skráti text na maximálnu dĺžku (pre veľké dokumenty).
 */
export function truncateText(text: string, maxChars = 120000): string {
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + "\n\n[Dokument bol skrátený kvôli limitu LLM]";
}
