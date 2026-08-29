import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { storage, _resetDbForTests } from "../../src/lib/db";

function stubLocalStorage() {
  const store: Record<string, string> = {};
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => {
      store[k] = v;
    },
    removeItem: (k: string) => {
      delete store[k];
    },
    clear: () => {
      Object.keys(store).forEach((k) => delete store[k]);
    },
  });
  return store;
}

describe("IndexedDB storage", () => {
  let lsStore: Record<string, string>;

  beforeEach(async () => {
    lsStore = stubLocalStorage();
    _resetDbForTests();
    await storage.clearAll();
  });

  it("saves and loads analysis by id", async () => {
    await storage.saveAnalysis("a1", {
      id: "a1",
      name: "Spis",
      status: "ready",
      createdAt: "2026-01-01",
      data: { metadata: { document_name: "x" } },
    });

    const row = await storage.getAnalysis("a1");
    expect(row?.id).toBe("a1");
    expect(row?.name).toBe("Spis");
    expect(row?.updatedAt).toBeTruthy();
  });

  it("lists, deletes and clears analyses", async () => {
    await storage.saveAnalysis("a1", {
      id: "a1",
      name: "A",
      status: "ready",
      createdAt: "2026-01-01",
      data: null,
    });
    await storage.saveAnalysis("a2", {
      id: "a2",
      name: "B",
      status: "ready",
      createdAt: "2026-01-02",
      data: null,
    });

    expect((await storage.getAllAnalyses()).length).toBe(2);
    await storage.deleteAnalysis("a1");
    expect((await storage.getAllAnalyses()).map((r) => r.id)).toEqual(["a2"]);
    await storage.clearAll();
    expect(await storage.getAllAnalyses()).toEqual([]);
  });

  it("migrates legacy localStorage cache once", async () => {
    lsStore["forenz_local_analyses_v1"] = JSON.stringify({
      legacy1: {
        id: "legacy1",
        name: "Legacy",
        status: "ready",
        createdAt: "2026-01-01",
        data: null,
      },
    });

    _resetDbForTests();
    const rows = await storage.getAllAnalyses();
    expect(rows.some((r) => r.id === "legacy1")).toBe(true);
    expect(lsStore["forenz_local_analyses_v1"]).toBeUndefined();
  });
});
