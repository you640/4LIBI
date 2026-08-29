import { describe, it, expect } from "vitest";
import { chunkText, isPdf, estimateTokens } from "../../src/lib/pdfParser";

describe("pdfParser", () => {
  describe("chunkText", () => {
    it("should return single chunk for text under maxChars", () => {
      const text = "This is a short text.";
      const chunks = chunkText(text, 100);
      expect(chunks).toEqual([text]);
    });

    it("should split text into multiple chunks when exceeding maxChars", () => {
      const text = "a".repeat(250000);
      const chunks = chunkText(text, 100000, 10000);
      expect(chunks.length).toBe(3);
      expect(chunks[0].length).toBe(100000);
      expect(chunks[1].length).toBe(100000);
      expect(chunks[2].length).toBe(70000);
    });

    it("should maintain overlap between chunks for context continuity", () => {
      const text = "0123456789".repeat(20000);
      const chunks = chunkText(text, 100000, 10000);
      expect(chunks.length).toBe(3);
      expect(chunks[0]).toBe(text.slice(0, 100000));
      expect(chunks[1]).toBe(text.slice(90000, 190000));
      expect(chunks[2]).toBe(text.slice(180000));
    });

    it("should handle empty text", () => {
      expect(chunkText("", 100000)).toEqual([""]);
    });

    it("should handle exactly maxChars length", () => {
      const text = "a".repeat(100000);
      expect(chunkText(text, 100000)).toEqual([text]);
    });
  });

  describe("isPdf / estimateTokens", () => {
    it("detects PDF magic bytes", () => {
      const pdf = new TextEncoder().encode("%PDF-1.4 rest").buffer;
      const notPdf = new TextEncoder().encode("HELLO").buffer;
      expect(isPdf(pdf)).toBe(true);
      expect(isPdf(notPdf)).toBe(false);
    });

    it("estimates tokens roughly", () => {
      expect(estimateTokens("abcd efgh")).toBeGreaterThan(0);
    });
  });
});
