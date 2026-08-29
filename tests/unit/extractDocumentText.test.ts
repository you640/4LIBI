import { describe, it, expect } from "vitest";
import {
  isTxtFile,
  isPdfFile,
  isImageFile,
  extractTextFromBytes,
} from "../../src/lib/extractDocumentText";

describe("extractDocumentText", () => {
  it("detects file kinds", () => {
    expect(isTxtFile("a.txt", "text/plain")).toBe(true);
    expect(isPdfFile("a.pdf", "application/pdf")).toBe(true);
    expect(isImageFile("a.png", "image/png")).toBe(true);
    expect(isImageFile("a.jpg")).toBe(true);
  });

  it("extracts text from txt bytes", async () => {
    const bytes = new TextEncoder().encode("Ahoj forenzný text dlhší").buffer;
    const text = await extractTextFromBytes(
      bytes,
      { name: "note.txt", mime: "text/plain" },
      "key"
    );
    expect(text).toContain("Ahoj");
  });

  it("rejects unsupported formats", async () => {
    await expect(
      extractTextFromBytes(new ArrayBuffer(8), { name: "x.bin", mime: "application/octet-stream" }, "k")
    ).rejects.toThrow(/Nepodporovaný/);
  });
});
