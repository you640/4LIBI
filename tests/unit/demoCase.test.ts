import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  DEMO_CASE_ID,
  DEMO_LOADING_MS,
  QUICK_TIP_STORAGE_KEY,
  getDemoAnalysis,
  getDemoContradictionCount,
  hasSeenQuickTip,
  isDemoCaseId,
  markQuickTipSeen,
} from "../../src/lib/demoCase";

function mockLocalStorage() {
  const store: Record<string, string> = {};
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      for (const key of Object.keys(store)) delete store[key];
    },
  });
}

describe("demoCase", () => {
  beforeEach(() => {
    mockLocalStorage();
    localStorage.clear();
  });

  it("identifies demo case id", () => {
    expect(isDemoCaseId("demo")).toBe(true);
    expect(isDemoCaseId("real-id")).toBe(false);
    expect(isDemoCaseId(undefined)).toBe(false);
  });

  it("returns DEMO_ANALYSIS with contradictions", () => {
    const analysis = getDemoAnalysis();
    expect(analysis.metadata.document_name).toContain("BA-KE");
    expect(getDemoContradictionCount()).toBeGreaterThan(0);
    expect(analysis.timeline.some((e) => e.tags.includes("rozpor"))).toBe(true);
  });

  it("tracks quick tip in localStorage", () => {
    expect(hasSeenQuickTip()).toBe(false);
    markQuickTipSeen();
    expect(localStorage.getItem(QUICK_TIP_STORAGE_KEY)).toBe("1");
    expect(hasSeenQuickTip()).toBe(true);
  });

  it("uses stable demo route id", () => {
    expect(DEMO_CASE_ID).toBe("demo");
    expect(DEMO_LOADING_MS).toBe(1500);
  });
});

describe("DemoCaseRunner timing", () => {
  it("demo loading duration is 1.5 seconds per backlog", () => {
    expect(DEMO_LOADING_MS).toBe(1500);
  });
});
