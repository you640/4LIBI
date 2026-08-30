import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  QUICK_TIP_STORAGE_KEY,
  hasSeenQuickTip,
  markQuickTipSeen,
} from "../../src/lib/quickTip";

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

describe("quickTip", () => {
  beforeEach(() => {
    mockLocalStorage();
    localStorage.clear();
  });

  it("tracks quick tip in localStorage", () => {
    expect(hasSeenQuickTip()).toBe(false);
    markQuickTipSeen();
    expect(localStorage.getItem(QUICK_TIP_STORAGE_KEY)).toBe("1");
    expect(hasSeenQuickTip()).toBe(true);
  });
});
