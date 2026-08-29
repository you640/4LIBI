import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  riskScore,
  riskLabel,
  formatCaseDate,
  formatEventTime,
  rememberLastCaseId,
  getLastCaseId,
} from "../../src/lib/caseUtils";
import { minimalAnalysisFixture } from "../fixtures/analysis";

describe("caseUtils rest", () => {
  beforeEach(() => {
    const store: Record<string, string> = {};
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => {
        store[k] = v;
      },
      removeItem: (k: string) => {
        delete store[k];
      },
    });
  });

  it("scores risk from contradictions", () => {
    const empty = { ...minimalAnalysisFixture, timeline: [] };
    expect(riskScore(empty)).toBe(18);
    expect(riskLabel(18)).toBe("NÍZKE");
    expect(riskScore(minimalAnalysisFixture)).toBeGreaterThanOrEqual(40);
    expect(riskLabel(80)).toBe("VYSOKÉ");
  });

  it("formats dates", () => {
    expect(formatCaseDate(null)).toBe("—");
    expect(formatEventTime(null)).toBe("Neznámy čas");
    expect(formatCaseDate("2026-01-15T12:00:00.000Z")).toMatch(/2026/);
  });

  it("remembers last case id", () => {
    rememberLastCaseId("case-9");
    expect(getLastCaseId()).toBe("case-9");
  });
});
