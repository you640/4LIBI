import { describe, it, expect } from "vitest";
import {
  buildUserPrompt,
  buildRetryJsonPrompt,
  cleanResponse,
  extractJson,
  validateAnalysisResponse,
  normalizeAnalysis,
  parseAnalysisResponse,
} from "../src/lib/sherlockPrompt";

describe("Sherlock Prompt Construction & JSON Sanitization", () => {
  it("zostaví korektný user prompt s textom dokumentu", () => {
    const prompt = buildUserPrompt("Svedok uviedol, že videl auto.");
    expect(prompt).toContain("Analyzuj nasledujúci text a vráť IBA validné JSON");
    expect(prompt).toContain("Svedok uviedol, že videl auto.");
  });

  it("zostaví retry prompt pre opravu nevalidného JSON", () => {
    const retryPrompt = buildRetryJsonPrompt();
    expect(retryPrompt).toContain("Predchádzajúca odpoveď nebola validné JSON");
  });

  it("odstráni markdown obal ```json a ``` z odpovede", () => {
    const raw = "```json\n{\"metadata\": {}}\n```";
    expect(cleanResponse(raw)).toBe("{\"metadata\": {}}");
  });

  it("odstráni UTF-8 BOM znak a biele znaky", () => {
    const raw = "\uFEFF   {\"test\": 123}   ";
    expect(cleanResponse(raw)).toBe("{\"test\": 123}");
  });

  it("extrahuje JSON z nečistého textu s úvodným a záverečným komentárom", () => {
    const text = "Ahoj, tu je tvoja analýza:\n{\"metadata\": {\"document_name\": \"test\"}}\nDúfam, že pomohlo.";
    const extracted = extractJson(text);
    expect(extracted).toHaveProperty("metadata");
  });

  it("opraví koncové čiarky (trailing commas) v JSON", () => {
    const text = "{\"metadata\": {\"name\": \"test\",}, \"persons\": [\"p1\",],}";
    const extracted = extractJson(text);
    expect(extracted).toHaveProperty("metadata");
    expect(extracted).toHaveProperty("persons");
  });

  it("vyhodí chybu pri úplne neplatnom JSON", () => {
    expect(() => extractJson("Toto vôbec nie je JSON")).toThrow();
  });

  it("normalizuje neúplnú odpoveď na platný Analysis model", () => {
    const raw = {
      metadata: { document_name: "Zápisnica" },
      persons: [{ id: "p1", name: "Jozef", role: "podozrivý" }],
    };
    const normalized = normalizeAnalysis(raw, "Záložný názov");

    expect(normalized.metadata.document_name).toBe("Zápisnica");
    expect(normalized.metadata.language).toBe("sk");
    expect(normalized.persons.length).toBe(1);
    expect(normalized.evidence).toEqual([]);
    expect(normalized.relationships).toEqual([]);
    expect(normalized.timeline).toEqual([]);
  });

  it("správne rozpozná podporované jazyky (en, cs, sk)", () => {
    const rawEn = { metadata: { language: "en" } };
    const rawCs = { metadata: { language: "cz" } };
    const rawSk = { metadata: { language: "sk" } };

    expect(normalizeAnalysis(rawEn, "").metadata.language).toBe("en");
    expect(normalizeAnalysis(rawCs, "").metadata.language).toBe("cs");
    expect(normalizeAnalysis(rawSk, "").metadata.language).toBe("sk");
  });

  it("normalizuje page z timeline a fallback zo source_text", () => {
    const raw = {
      timeline: [
        {
          id: "t1",
          title: "A",
          description: "",
          source_text: "--- STRANA 9 --- citát",
          tags: [],
          confidence: 0.8,
          approximate: false,
        },
        {
          id: "t2",
          title: "B",
          description: "",
          source_text: "bez strany",
          page: 15,
          tags: [],
          confidence: 0.9,
          approximate: false,
        },
      ],
    };
    const normalized = normalizeAnalysis(raw, "Spis");
    expect(normalized.timeline[0].page).toBe(9);
    expect(normalized.timeline[1].page).toBe(15);
  });

  it("úspešne overí a rozparsuje platnú LLM odpoveď pomocou parseAnalysisResponse", () => {
    const response = JSON.stringify({
      metadata: { document_name: "Kauza Test", language: "sk" },
      persons: [{ id: "p1", name: "Jozef", role: "podozrivý", description: null, aliases: [] }],
      evidence: [],
      relationships: [],
      timeline: [
        {
          id: "t1",
          timestamp: "2026-08-17T20:00:00Z",
          title: "Stretnutie",
          description: "Popis",
          location: "BA",
          persons_involved: ["p1"],
          evidence_links: [],
          tags: ["rozpor"],
          source_text: "Text",
          confidence: 0.9,
          approximate: false,
        },
      ],
    });

    const parsed = parseAnalysisResponse(response, "Kauza");
    expect(parsed).not.toBeNull();
    expect(parsed?.timeline.length).toBe(1);
    expect(validateAnalysisResponse(response)).toBe(true);
  });
});
