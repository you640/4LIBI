import { describe, it, expect } from "vitest";
import {
  parseAnalysisResponse,
  validateAnalysisResponse,
  cleanResponse,
} from "../../src/lib/sherlockPrompt";
import { analysisJsonResponse, minimalAnalysisFixture } from "../fixtures/analysis";
import { trackEvent } from "../../src/lib/analytics";
import { vi } from "vitest";

describe("contract: Analysis schema", () => {
  it("validates required analysis keys", () => {
    expect(validateAnalysisResponse(analysisJsonResponse())).toBe(true);
    const parsed = parseAnalysisResponse(analysisJsonResponse(), "doc.pdf");
    expect(parsed).not.toBeNull();
    expect(parsed?.metadata).toBeTruthy();
    expect(parsed?.persons).toBeInstanceOf(Array);
    expect(parsed?.evidence).toBeInstanceOf(Array);
    expect(parsed?.relationships).toBeInstanceOf(Array);
    expect(parsed?.timeline).toBeInstanceOf(Array);
  });

  it("rejects incomplete JSON", () => {
    expect(validateAnalysisResponse("not-json-at-all")).toBe(false);
    expect(validateAnalysisResponse("")).toBe(false);
  });

  it("cleans markdown fences before parse", () => {
    const fenced = "```json\n" + analysisJsonResponse() + "\n```";
    expect(cleanResponse(fenced)).not.toContain("```");
    expect(validateAnalysisResponse(fenced)).toBe(true);
  });

  it("matches fixture snapshot shape", () => {
    expect(minimalAnalysisFixture).toMatchObject({
      metadata: expect.objectContaining({
        document_name: expect.any(String),
        language: expect.any(String),
      }),
      persons: expect.any(Array),
      timeline: expect.any(Array),
    });
  });
});

describe("contract: analytics PII sanitization", () => {
  it("redacts email/name/phone keys", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    trackEvent("pii_check", {
      email: "secret@x.com",
      investigator_name: "Ján",
      phone: "+421",
      count: 1,
    });
    const props = spy.mock.calls[0][1] as Record<string, unknown>;
    expect(props.email).toBe("[REDACTED]");
    expect(props.investigator_name).toBe("[REDACTED]");
    expect(props.phone).toBe("[REDACTED]");
    expect(props.count).toBe(1);
    spy.mockRestore();
  });
});
