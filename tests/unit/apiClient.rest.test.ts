import "fake-indexeddb/auto";
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  listAnalyses,
  getAnalysis,
  renameAnalysis,
  deleteAnalysis,
  deleteAllAnalyses,
  deleteLocalAnalysis,
  clearAllLocalAnalyses,
} from "../../src/lib/api";
import { storage, _resetDbForTests } from "../../src/lib/db";

describe("api client rest", () => {
  const lsStore: Record<string, string> = {};

  beforeEach(async () => {
    Object.keys(lsStore).forEach((k) => delete lsStore[k]);
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => lsStore[k] ?? null,
      setItem: (k: string, v: string) => {
        lsStore[k] = v;
      },
      removeItem: (k: string) => {
        delete lsStore[k];
      },
      clear: () => {
        Object.keys(lsStore).forEach((k) => delete lsStore[k]);
      },
    });
    vi.stubGlobal("window", globalThis);
    _resetDbForTests();
    await storage.clearAll();
    vi.spyOn(globalThis, "fetch");
  });

  it("listAnalyses merges remote and local", async () => {
    await storage.saveAnalysis("local1", {
      id: "local1",
      name: "Local",
      status: "ready",
      createdAt: "2026-01-01",
      data: null,
    });
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify([
          { id: "r1", name: "Remote", status: "ready", createdAt: "2026-01-02" },
        ]),
        { status: 200 }
      )
    );
    const list = await listAnalyses();
    expect(list.some((x) => x.id === "r1")).toBe(true);
    expect(list.some((x) => x.id === "local1")).toBe(true);
  });

  it("getAnalysis returns remote and caches in IndexedDB", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id: "a1",
          name: "A",
          status: "ready",
          createdAt: "2026-01-01",
          data: { metadata: {} },
        }),
        { status: 200 }
      )
    );
    const record = await getAnalysis("a1");
    expect(record.id).toBe("a1");
    const cached = await storage.getAnalysis("a1");
    expect(cached?.id).toBe("a1");
  });

  it("renameAnalysis sends PATCH", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id: "a1",
          name: "Nový názov",
          status: "ready",
          createdAt: "2026-01-01",
        }),
        { status: 200 }
      )
    );
    const updated = await renameAnalysis("a1", "Nový názov");
    expect(updated.name).toBe("Nový názov");
    expect(fetch).toHaveBeenCalledWith("/api/analyses/a1", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Nový názov" }),
    });
  });

  it("deleteAnalysis hits DELETE endpoint", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 204 }));
    await deleteAnalysis("x");
    expect(fetch).toHaveBeenCalledWith("/api/analyses/x", {
      method: "DELETE",
      credentials: "include",
    });
  });

  it("deleteAllAnalyses clears local IndexedDB and remote", async () => {
    await storage.saveAnalysis("z", {
      id: "z",
      name: "Z",
      status: "ready",
      createdAt: "",
      data: null,
    });
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 200 }));
    await deleteAllAnalyses();
    expect(await storage.getAllAnalyses()).toEqual([]);
    expect(fetch).toHaveBeenCalledWith("/api/analyses", {
      method: "DELETE",
      credentials: "include",
    });
  });

  it("deleteLocalAnalysis removes cache entry", async () => {
    await storage.saveAnalysis("z", {
      id: "z",
      name: "Z",
      status: "ready",
      createdAt: "",
      data: null,
    });
    await deleteLocalAnalysis("z");
    expect(await storage.getAnalysis("z")).toBeUndefined();
    await clearAllLocalAnalyses();
  });
});
