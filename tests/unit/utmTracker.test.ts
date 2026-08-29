import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  captureUtmParameters,
  getUtmData,
  withUtm,
} from "../../src/lib/utmTracker";

describe("utmTracker", () => {
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
    vi.stubGlobal("window", {
      location: {
        search: "?utm_source=li&utm_medium=social&utm_campaign=alibi",
        pathname: "/sherlock",
      },
      history: { replaceState: vi.fn() },
    });
  });

  it("captures UTM params and persists them", () => {
    const data = captureUtmParameters();
    expect(data).toEqual({
      utm_source: "li",
      utm_medium: "social",
      utm_campaign: "alibi",
    });
    expect(getUtmData().utm_source).toBe("li");
    expect(window.history.replaceState).toHaveBeenCalled();
  });

  it("merges UTM into event properties", () => {
    captureUtmParameters();
    expect(withUtm({ foo: 1 })).toMatchObject({
      foo: 1,
      utm_source: "li",
    });
  });
});
