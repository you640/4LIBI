import { afterEach, describe, expect, it, vi } from "vitest";
import { analyzeViaApi } from "../src/lib/api";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("analyzeViaApi", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("waits for an asynchronous analysis to finish", async () => {
    const readyRecord = {
      id: "analysis-1",
      name: "spis.txt",
      status: "ready",
      createdAt: "2026-08-18T12:00:00.000Z",
      data: {
        metadata: {
          document_name: "spis.txt",
          language: "sk",
          page_count: 1,
          upload_date: "2026-08-18T12:00:00.000Z",
        },
        persons: [],
        evidence: [],
        relationships: [],
        timeline: [],
        contradictions: [],
      },
    };

    let pollCount = 0;
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith("/api/analyze")) {
        return jsonResponse({
          id: "analysis-1",
          name: "spis.txt",
          status: "queued",
          createdAt: "2026-08-18T12:00:00.000Z",
        });
      }
      if (url.includes("/progress")) {
        return jsonResponse({
          status: "processing",
          progress: { message: "Analyzujem…", progress: 40 },
        });
      }
      if (url.includes("/api/analyses/analysis-1")) {
        pollCount += 1;
        if (pollCount < 2) {
          return jsonResponse({
            id: "analysis-1",
            name: "spis.txt",
            status: "queued",
            createdAt: "2026-08-18T12:00:00.000Z",
          });
        }
        return jsonResponse(readyRecord);
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    const result = await analyzeViaApi([
      new File(["obsah výpovede"], "spis.txt", { type: "text/plain" }),
    ]);

    expect(result).toEqual(readyRecord);
    expect(fetchMock.mock.calls.some((c) => String(c[0]).includes("/progress"))).toBe(
      true
    );
  });

  it("surfaces API validation errors instead of creating a fake local result", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      jsonResponse({ error: "Nepodporovaný súbor." }, 400)
    );

    await expect(
      analyzeViaApi([
        new File(["data"], "spis.bin", { type: "application/octet-stream" }),
      ])
    ).rejects.toThrow("Nepodporovaný súbor.");
  });
  it("does not treat an unavailable API as a successful empty Sherlock result", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new TypeError("Failed to fetch"));

    await expect(
      analyzeViaApi([
        new File(["obsah výpovede"], "spis.txt", { type: "text/plain" }),
      ])
    ).rejects.toThrow(/API je nedostupné/);
  });

  it("does not treat HTTP 503 as a successful local analysis", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      jsonResponse({ error: "Databáza nie je dostupná." }, 503)
    );

    await expect(
      analyzeViaApi([
        new File(["obsah výpovede"], "spis.txt", { type: "text/plain" }),
      ])
    ).rejects.toThrow(/API je nedostupné/);
  });
});
