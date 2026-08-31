import { describe, it, expect } from "vitest";
import {
  isTxtFile,
  isPdfFile,
  isImageFile,
  extractTextFromBytes,
} from "../../src/lib/extractDocumentText";

describe("extractDocumentText", () => {
  it("detects file kinds correctly", () => {
    // Text & PDF
    expect(isTxtFile("a.txt", "text/plain")).toBe(true);
    expect(isPdfFile("a.pdf", "application/pdf")).toBe(true);

    // Images (original)
    expect(isImageFile("a.png", "image/png")).toBe(true);
    expect(isImageFile("a.jpg")).toBe(true);
    expect(isImageFile("a.webp", "image/webp")).toBe(true);

    // Images (new formats integrity)
    expect(isImageFile("photo.bmp")).toBe(true);
    expect(isImageFile("scan.tiff")).toBe(true);
    expect(isImageFile("scan.tif", "image/tiff")).toBe(true);
    expect(isImageFile("iphone.heic", "image/heic")).toBe(true);
    expect(isImageFile("iphone.heif")).toBe(true);
    expect(isImageFile("animation.gif", "image/gif")).toBe(true);

    // Negative tests
    expect(isImageFile("report.doc")).toBe(false);
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

  it("rejects unsupported formats with updated error message", async () => {
    await expect(
      extractTextFromBytes(new ArrayBuffer(8), { name: "x.bin", mime: "application/octet-stream" }, "k")
    ).rejects.toThrow(/Nepodporovaný formát/);
  });
});
