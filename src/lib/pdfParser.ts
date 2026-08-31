// Polyfill DOMMatrix for Node.js environments where pdfjs-dist standard build requires it
if (typeof globalThis !== "undefined" && typeof globalThis.DOMMatrix === "undefined") {
  class DOMMatrixPolyfill {
    a = 1; b = 0; c = 0; d = 1; e = 0; f = 0;
    m11 = 1; m12 = 0; m13 = 0; m14 = 0;
    m21 = 0; m22 = 1; m23 = 0; m24 = 0;
    m31 = 0; m32 = 0; m33 = 1; m34 = 0;
    m41 = 0; m42 = 0; m43 = 0; m44 = 1;
    is2D = true;
    isIdentity = true;
    constructor(init?: number[] | string) {
      if (Array.isArray(init) && init.length >= 6) {
        this.a = this.m11 = init[0];
        this.b = this.m12 = init[1];
        this.c = this.m21 = init[2];
        this.d = this.m22 = init[3];
        this.e = this.m41 = init[4];
        this.f = this.m42 = init[5];
      }
    }
  }
  // @ts-expect-error polyfill for Node.js
  globalThis.DOMMatrix = DOMMatrixPolyfill;
}

/**
 * Extrahuje text z PDF bufferu (ArrayBuffer).
 * Funguje v Node.js (Convex) aj v prehliadači.
 */
export async function extractTextFromPdf(
  pdfBuffer: ArrayBuffer
): Promise<string> {
  // Dynamický import pdfjs-dist (legacy build pre Node.js)
  let pdfjsLib: typeof import("pdfjs-dist");
  if (typeof window === "undefined") {
    try {
      pdfjsLib = (await import("pdfjs-dist/legacy/build/pdf.mjs" as string)) as unknown as typeof import("pdfjs-dist");
    } catch {
      pdfjsLib = await import("pdfjs-dist");
    }
  } else {
    pdfjsLib = await import("pdfjs-dist");
  }

  // Prehliadač: pdfjs-dist vyžaduje workerSrc
  if (typeof window !== "undefined" && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
    const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
    pdfjsLib.GlobalWorkerOptions.workerSrc = worker.default;
  }

  const loadingTask = pdfjsLib.getDocument({
    data: pdfBuffer,
    // disableWorker nie je v typoch, ale funguje v Node.js / Convex
    ...(typeof window === "undefined" ? ({ disableWorker: true } as unknown as Record<string, unknown>) : {}),
  });

  const pdf = await loadingTask.promise;
  let fullText = "";

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();

    // Spoj text itemov s medzerami
    const pageText = textContent.items
      .map((item: unknown) => {
        if (item && typeof item === "object" && "str" in item) {
          return String((item as { str: unknown }).str || "");
        }
        return "";
      })
      .join(" ");

    fullText += `--- STRANA ${i} ---\n` + pageText + "\n\n";
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
 * Rozdelí text na chunky pre LLM spracovanie.
 * Každý chunk má maximálne maxChars znakov s prekryvom (overlap) pre kontext.
 * @deprecated Použite chunkDocument z documentChunker.ts (page-aware chunking pre Sherlock).
 */
export function chunkText(text: string, maxChars: number = 120000, overlap: number = 10000): string[] {
  if (text.length <= maxChars) {
    return [text];
  }
  
  const chunks: string[] = [];
  let start = 0;
  
  while (start < text.length) {
    const end = Math.min(start + maxChars, text.length);
    chunks.push(text.slice(start, end));
    
    // Posun sa o (maxChars - overlap) alebo ak je to posledný chunk, skonči
    if (end === text.length) {
      break;
    }
    start = end - overlap;
  }
  
  return chunks;
}
