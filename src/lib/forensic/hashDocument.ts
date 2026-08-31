import { createHash } from "node:crypto";

export function hashDocumentBytes(bytes: ArrayBuffer): string {
  return createHash("sha256").update(Buffer.from(bytes)).digest("hex");
}

export function hashDocumentText(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}
