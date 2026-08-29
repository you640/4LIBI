import { describe, it, expect } from "vitest";
import { DEMO_ANALYSIS } from "../../src/types";
import {
  appendIntegrityFooter,
  buildCourtDossierExport,
  sha256Hex,
} from "../../src/lib/dossierExport";
import {
  deriveGeospatialCheck,
  extractCityFromLocation,
  timestampToHHMM,
} from "../../src/lib/alibiGeospatial";

describe("dossierExport", () => {
  it("computes stable SHA-256 hex", async () => {
    const hash = await sha256Hex("hello");
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[a-f0-9]+$/);
  });

  it("appends integrity footer with hash", () => {
    const out = appendIntegrityFooter("# Title", "abc123");
    expect(out).toContain("SHA-256");
    expect(out).toContain("abc123");
  });

  it("builds court dossier export with hash", async () => {
    const { markdown, hash } = await buildCourtDossierExport(DEMO_ANALYSIS);
    expect(markdown).toContain("# FORENZNÁ ZPRÁVA");
    expect(markdown).toContain(hash);
    expect(hash).toHaveLength(64);
  });
});

describe("alibiGeospatial", () => {
  it("extracts city from compound location", () => {
    expect(extractCityFromLocation("Banka, Bratislava")).toBe("Bratislava");
  });

  it("parses timestamp to HH:MM", () => {
    expect(timestampToHHMM("2023-05-15T14:25:00Z")).toMatch(/^\d{2}:\d{2}$/);
  });

  it("derives BA-KE geospatial pair from demo analysis", () => {
    const rozpor = DEMO_ANALYSIS.timeline.find((e) => e.id === "T002");
    expect(rozpor).toBeTruthy();
    const pair = deriveGeospatialCheck(DEMO_ANALYSIS, rozpor!);
    expect(pair).toBeTruthy();
    expect(pair!.locA.toLowerCase()).toContain("ko");
    expect(pair!.locB.toLowerCase()).toContain("bratislava");
  });
});
