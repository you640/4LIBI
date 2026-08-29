import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Contradiction } from "../../src/types";

vi.mock("../../src/lib/auditLog", () => ({
  logAction: vi.fn(),
}));

vi.mock("../../src/lib/crossExamination", () => ({
  buildLocalCrossExamQuestions: vi.fn(() => [
    {
      id: "local-q1",
      question: "Lokálna otázka?",
      rationale: "r",
      targetPerson: "Ján",
      citation: { documentTitle: "spis", passage: "p", page: 1, line: null },
      suggestedFollowUps: [],
    },
  ]),
  generateCrossExamWithMistral: vi.fn(async () => [
    {
      id: "gen-q1",
      question: "Fallback otázka?",
      rationale: "r",
      targetPerson: "Ján",
      citation: { documentTitle: "spis", passage: "p", page: 1, line: null },
      suggestedFollowUps: [],
    },
  ]),
}));

import { logAction } from "../../src/lib/auditLog";
import { requestCrossExam, auditCrossExam } from "../../src/lib/crossExamApi";

const contradiction: Contradiction = {
  id: "c1",
  explanation: "BA vs KE",
  severity: "critical",
  entity_ref: "Ján",
};

describe("crossExamApi", () => {
  beforeEach(() => {
    vi.mocked(logAction).mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("auditCrossExam logs cross_exam action", () => {
    auditCrossExam({ caseId: "a1", eventId: "t1", source: "local", count: 2 });
    expect(logAction).toHaveBeenCalledWith("cross_exam", {
      caseId: "a1",
      eventId: "t1",
      source: "local",
      count: 2,
    });
  });

  it("uses server response when /api/cross-exam succeeds", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          questions: [
            {
              id: "api-q1",
              question: "Server otázka?",
              rationale: "r",
              targetPerson: "Ján",
              citation: {
                documentTitle: "spis",
                passage: "p",
                page: 1,
                line: null,
              },
              suggestedFollowUps: [],
            },
          ],
          source: "mistral",
        }),
      }))
    );

    const res = await requestCrossExam({
      contradictions: [contradiction],
      contextText: "ctx",
      caseId: "a1",
      eventId: "t1",
    });

    expect(res.source).toBe("mistral");
    expect(res.questions[0].question).toMatch(/Server/i);
    expect(logAction).toHaveBeenCalledWith(
      "cross_exam",
      expect.objectContaining({ source: "mistral", count: 1 })
    );
  });

  it("falls back to local templates when fetch fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline");
      })
    );

    const res = await requestCrossExam({
      contradictions: [contradiction],
      contextText: "ctx",
    });

    expect(res.source).toBe("local");
    expect(res.questions.length).toBeGreaterThan(0);
    expect(logAction).toHaveBeenCalledWith(
      "cross_exam",
      expect.objectContaining({ source: "local" })
    );
  });
});
