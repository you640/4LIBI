import { describe, it, expect, vi, beforeEach } from "vitest";
import { analysisJsonResponse } from "../fixtures/analysis";

vi.mock("../../src/lib/mistralApi", () => ({
  callMistralApi: vi.fn(),
  callMistralOcr: vi.fn(),
}));

vi.mock("../../src/lib/extractDocumentText", () => ({
  extractTextFromBytes: vi.fn(
    async () => "Dokument: Ján bol v Bratislave o 10:00 a tvrdil alibi."
  ),
}));

import { callMistralApi } from "../../src/lib/mistralApi";
import { extractTextFromBytes } from "../../src/lib/extractDocumentText";
import { analyzeFilesFromBytes } from "../../src/lib/analyzeCore";

describe("analyzeCore", () => {
  beforeEach(() => {
    vi.mocked(callMistralApi).mockReset();
    vi.mocked(extractTextFromBytes).mockReset();
    vi.mocked(extractTextFromBytes).mockResolvedValue(
      "Dokument: Ján bol v Bratislave o 10:00 a tvrdil alibi."
    );
  });

  it("analyzes files via mocked mistral", async () => {
    vi.mocked(callMistralApi).mockResolvedValue(analysisJsonResponse());
    const result = await analyzeFilesFromBytes(
      [
        {
          name: "spis.txt",
          mime: "text/plain",
          bytes: new TextEncoder().encode("x").buffer,
        },
      ],
      "test-key"
    );
    expect(result.metadata.document_name).toBeTruthy();
    expect(result.persons.length).toBeGreaterThan(0);
    expect(callMistralApi).toHaveBeenCalled();
  });

  it("throws when no extractable text", async () => {
    vi.mocked(extractTextFromBytes).mockResolvedValue("   ");
    await expect(
      analyzeFilesFromBytes(
        [{ name: "empty.txt", mime: "text/plain", bytes: new ArrayBuffer(0) }],
        "k"
      )
    ).rejects.toThrow(/nepodarilo prečítať/);
  });
});
