import { describe, it, expect, vi, beforeEach } from "vitest";
import { analysisJsonResponse } from "../fixtures/analysis";

vi.mock("../../src/lib/mistralApi", () => ({
  callMistralApi: vi.fn(),
  callMistralOcr: vi.fn(),
}));

vi.mock("../../src/lib/forensic/forensicAnalyze", () => ({
  analyzeForensicCase: vi.fn(async () => ({
    status: "ready",
    prompt_version: "1.0.0",
    model: "mistral-large-latest",
    analyzed_at: "2026-01-01T00:00:00.000Z",
    documents: [],
    case_level: null,
    diagnostics: null,
  })),
}));

vi.mock("../../src/lib/extractDocumentText", () => ({
  extractTextFromBytes: vi.fn(
    async () => "Dokument: Ján bol v Bratislave o 10:00 a tvrdil alibi."
  ),
}));

import { callMistralApi } from "../../src/lib/mistralApi";
import { extractTextFromBytes } from "../../src/lib/extractDocumentText";
import { analyzeForensicCase } from "../../src/lib/forensic/forensicAnalyze";
import {
  analyzeFilesFromBytes,
  analyzeForensicLinearFromBytes,
} from "../../src/lib/analyzeCore";

describe("analyzeCore", () => {
  beforeEach(() => {
    vi.mocked(callMistralApi).mockReset();
    vi.mocked(analyzeForensicCase).mockReset();
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
    expect(result.forensic).toBeUndefined();
    expect(analyzeForensicCase).not.toHaveBeenCalled();
    expect(callMistralApi).toHaveBeenCalled();
  });

  it("omitForensic odstráni forensic pole z lokálneho výsledku", async () => {
    const { omitForensic } = await import("../../src/lib/analyzeCore");
    const stripped = omitForensic({
      metadata: {
        document_name: "local.txt",
        language: "sk",
        page_count: 1,
        upload_date: "2026-01-01T00:00:00.000Z",
      },
      persons: [],
      evidence: [],
      relationships: [],
      timeline: [],
      forensic: {
        status: "ready",
        prompt_version: "1.0.0",
        model: "x",
        analyzed_at: "2026-01-01T00:00:00.000Z",
        documents: [],
        case_level: null,
        diagnostics: null,
      },
    });
    expect(stripped.forensic).toBeUndefined();
  });

  it("lokálne nahratie nespustí forenzné tri otázky; bez Linear metadata zlyhá fail-closed", async () => {
    vi.mocked(callMistralApi).mockResolvedValue(analysisJsonResponse());
    await expect(
      analyzeForensicLinearFromBytes(
        [
          {
            name: "local.txt",
            mime: "text/plain",
            bytes: new TextEncoder().encode("x").buffer,
          },
        ],
        "test-key"
      )
    ).rejects.toThrow(/Linear metadata|project ID/);
    expect(analyzeForensicCase).not.toHaveBeenCalled();
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
