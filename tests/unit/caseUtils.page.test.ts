import { describe, it, expect } from "vitest";
import { resolvePageFromText, resolveEventPage } from "../../src/lib/caseUtils";

describe("resolvePageFromText", () => {
  it("parsuje --- STRANA N ---", () => {
    expect(resolvePageFromText("--- STRANA 12 ---\nCitát")).toBe(12);
  });

  it("parsuje KONTEXT prefix", () => {
    expect(
      resolvePageFromText("[KONTEXT: ANALÝZA STRANY CCA 25]\nText")
    ).toBe(25);
  });

  it("vráti undefined bez značky", () => {
    expect(resolvePageFromText("Bez strany")).toBeUndefined();
  });
});

describe("resolveEventPage", () => {
  it("preferuje explicitné page na evente", () => {
    expect(
      resolveEventPage({ page: 7, source_text: "--- STRANA 1 ---" })
    ).toBe(7);
  });

  it("fallback na source_text", () => {
    expect(
      resolveEventPage({ source_text: "--- STRANA 42 --- popis" })
    ).toBe(42);
  });
});
