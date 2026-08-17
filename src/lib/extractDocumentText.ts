import { callMistralOcr } from "./mistralApi";
import { extractTextFromPdf } from "./pdfParser";

const MIN_TEXT = 10;

function fileExt(name: string): string {
  const parts = name.toLowerCase().split(".");
  return parts.length > 1 ? parts.pop() || "" : "";
}

export function isTxtFile(name: string, mime = ""): boolean {
  return mime.includes("text") || fileExt(name) === "txt";
}

export function isPdfFile(name: string, mime = ""): boolean {
  return mime.includes("pdf") || fileExt(name) === "pdf";
}

export function isImageFile(name: string, mime = ""): boolean {
  const ext = fileExt(name);
  return mime.startsWith("image/") || ["jpg", "jpeg", "png", "webp"].includes(ext);
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const maybeBuffer = (globalThis as { Buffer?: { from: (b: ArrayBuffer) => { toString: (enc: string) => string } } }).Buffer;
  if (maybeBuffer) {
    return maybeBuffer.from(buffer).toString("base64");
  }
  const bytes = new Uint8Array(buffer);
  const chunk = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function imageMime(name: string, mime: string): string {
  if (mime.startsWith("image/")) return mime === "image/jpg" ? "image/jpeg" : mime;
  const ext = fileExt(name);
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "webp") return "image/webp";
  return "image/png";
}

/**
 * Extrahuje text zo súboru: TXT priamo, PDF cez pdfjs (OCR fallback), foto cez OCR.
 */
export async function extractTextFromBytes(
  bytes: ArrayBuffer,
  meta: { name: string; mime?: string },
  apiKey: string
): Promise<string> {
  const mime = meta.mime || "";
  const name = meta.name;

  if (isTxtFile(name, mime)) {
    return new TextDecoder("utf-8").decode(bytes).trim();
  }

  if (isPdfFile(name, mime)) {
    const intact = bytes.slice(0);
    let text = "";
    try {
      // pdfjs worker odpojí (detach) ArrayBuffer — OCR potrebuje nedotknutú kópiu
      text = (await extractTextFromPdf(bytes.slice(0))).trim();
    } catch (error) {
      console.warn("[Sherlock] pdfjs zlyhal, skúšam OCR:", error);
    }

    if (text.length >= MIN_TEXT) {
      console.log(`[Sherlock] Text z pdfjs (${text.length} znakov)`);
      return text;
    }

    console.log("[Sherlock] PDF bez textovej vrstvy — OCR");
    return callMistralOcr({
      apiKey,
      kind: "document",
      mime: "application/pdf",
      base64: arrayBufferToBase64(intact),
    });
  }

  if (isImageFile(name, mime)) {
    console.log("[Sherlock] Obrázok — OCR");
    return callMistralOcr({
      apiKey,
      kind: "image",
      mime: imageMime(name, mime),
      base64: arrayBufferToBase64(bytes),
    });
  }

  throw new Error(
    `Nepodporovaný formát: ${mime || name}. Podporované: PDF, foto (JPG/PNG/WEBP), TXT.`
  );
}

export async function extractTextFromFile(
  file: File,
  apiKey: string
): Promise<string> {
  const bytes = await file.arrayBuffer();
  return extractTextFromBytes(
    bytes,
    { name: file.name, mime: file.type },
    apiKey
  );
}
