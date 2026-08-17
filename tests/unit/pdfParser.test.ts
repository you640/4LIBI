import { describe, it, expect, vi } from "vitest";
import { chunkText, truncateText } from "../../src/lib/pdfParser";

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
      const text = "0123456789".repeat(20000); // 200,000 characters
      const chunks = chunkText(text, 100000, 10000);
      
      expect(chunks.length).toBe(3);
      
      // First chunk: 0-100000
      expect(chunks[0]).toBe(text.slice(0, 100000));
      
      // Second chunk should start at 90000 (100000 - 10000 overlap) and end at 190000
      expect(chunks[1]).toBe(text.slice(90000, 190000));
      // Third chunk should start at 180000 (190000 - 10000 overlap)
      expect(chunks[2]).toBe(text.slice(180000));
    });

    it("should handle empty text", () => {
      const chunks = chunkText("", 100000);
      expect(chunks).toEqual([""]);
    });

    it("should handle exactly maxChars length", () => {
      const text = "a".repeat(100000);
      const chunks = chunkText(text, 100000);
      expect(chunks).toEqual([text]);
    });
  });

  describe("truncateText (DEPRECATED)", () => {
    it("should warn when used", () => {
      const consoleWarnSpy = vi.spyOn(console, "warn");
      const text = "a".repeat(200000);
      const result = truncateText(text, 100000);
      
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("DEPRECATED")
      );
      expect(result.length).toBe(100000);
      
      consoleWarnSpy.mockRestore();
    });

    it("should return full text when under limit", () => {
      const text = "Short text";
      const result = truncateText(text, 100000);
      expect(result).toBe(text);
    });
  });
});
