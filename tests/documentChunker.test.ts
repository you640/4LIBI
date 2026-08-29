import { describe, it, expect } from "vitest";
import { chunkDocument, mergeAnalysisResults } from "../src/lib/documentChunker";
import type { Analysis } from "../src/types";

describe("Document Chunker & Multi-Page RAG Synthesis", () => {
  it("ponechá krátky dokument ako 1 chunk", () => {
    const text = "Krátky zápis z výsluchu svedka Jozefa.";
    const chunks = chunkDocument(text, { maxChunkChars: 1000, overlapChars: 100 });

    expect(chunks.length).toBe(1);
    expect(chunks[0].text).toBe(`[KONTEXT: ANALÝZA STRANY CCA 1]\n${text}`);
    expect(chunks[0].likelyPage).toBe(1);
    expect(chunks[0].totalChunks).toBe(1);
    expect(chunks[0].index).toBe(0);
  });

  it("rozdelí dlhý text na viacero chunkov s prekrytím", () => {
    const paragraph = "Toto je forenzný odsek s podrobným popisom miesta činu a dôkazov.\n\n";
    const longText = paragraph.repeat(50); // cca 3500 znakov

    const chunks = chunkDocument(longText, { maxChunkChars: 1000, overlapChars: 200 });

    expect(chunks.length).toBeGreaterThan(3);
    for (let i = 0; i < chunks.length; i++) {
      expect(chunks[i].index).toBe(i);
      expect(chunks[i].totalChunks).toBe(chunks.length);
      expect(chunks[i].text).toContain("[KONTEXT: ANALÝZA STRANY CCA");
      expect(chunks[i].likelyPage).toBeGreaterThanOrEqual(1);
      expect(chunks[i].text.length).toBeGreaterThan(0);
    }
  });

  it("rešpektuje hranice strán (--- STRANA X ---)", () => {
    const page1 = "--- STRANA 1 ---\nVýpoveď číslo 1 svedka.";
    const page2 = "\n\n--- STRANA 2 ---\nVýpoveď číslo 2 svedka.";
    const text = page1 + page2;

    const chunks = chunkDocument(text, { maxChunkChars: 50, overlapChars: 10 });
    expect(chunks.length).toBeGreaterThanOrEqual(2);
  });

  it("pridá likelyPage a meta-prefix podľa značiek --- STRANA N ---", () => {
    const text =
      "--- STRANA 1 ---\nÚvod spisu.\n\n--- STRANA 2 ---\nDruhá strana s výpoveďou.\n\n--- STRANA 12 ---\nZáver.";
    const chunks = chunkDocument(text, { maxChunkChars: 80, overlapChars: 10 });

    expect(chunks.length).toBeGreaterThanOrEqual(2);
    const last = chunks[chunks.length - 1];
    expect(last.likelyPage).toBe(12);
    expect(last.text).toContain("STRANY CCA 12");
  });

  it("vráti prázdne pole pre prázdny alebo biely text", () => {
    expect(chunkDocument("")).toEqual([]);
    expect(chunkDocument("   \n\n  ")).toEqual([]);
  });

  it("zjednotí prázdne analýzy bez pádu", () => {
    const merged = mergeAnalysisResults([], "Prazdny spis");
    expect(merged.persons).toEqual([]);
    expect(merged.timeline).toEqual([]);
    expect(merged.metadata.document_name).toBe("Prazdny spis");
  });

  it("deduplikuje a zjednotí osoby z viacerých chunkov podľa mena", () => {
    const a1: Analysis = {
      metadata: { document_name: "Spis", language: "sk", page_count: 1, upload_date: "" },
      persons: [
        { id: "p1", name: "Jozef Mrkvička", role: "podozrivý", description: "Videný na mieste", aliases: ["Jožo"] },
        { id: "p2", name: "Peter Novák", role: "svedok", description: null, aliases: [] },
      ],
      evidence: [],
      relationships: [],
      timeline: [],
    };

    const a2: Analysis = {
      metadata: { document_name: "Spis", language: "sk", page_count: 1, upload_date: "" },
      persons: [
        { id: "p_dup", name: "jozef mrkvicka", role: "podozrivý", description: "Doplnkový popis", aliases: ["Kuchtík"] },
        { id: "p3", name: "Elena Kováčová", role: "obeť", description: null, aliases: [] },
      ],
      evidence: [],
      relationships: [],
      timeline: [],
    };

    const merged = mergeAnalysisResults([a1, a2], "Spis");

    expect(merged.persons.length).toBe(3);
    const jozef = merged.persons.find((p) => p.name.toLowerCase().includes("jozef"));
    expect(jozef).toBeDefined();
    expect(jozef?.aliases).toContain("Jožo");
    expect(jozef?.aliases).toContain("Kuchtík");
  });

  it("zjednotí a usporiada časové udalosti chronologicky cez všetky chunky", () => {
    const a1: Analysis = {
      metadata: { document_name: "Spis", language: "sk", page_count: 1, upload_date: "" },
      persons: [],
      evidence: [],
      relationships: [],
      timeline: [
        {
          id: "e2",
          timestamp: "2026-08-17T21:00:00Z",
          title: "Udalosť neskôr",
          description: "",
          location: null,
          persons_involved: [],
          evidence_links: [],
          tags: [],
          source_text: "",
          confidence: 1,
          approximate: false,
        },
      ],
    };

    const a2: Analysis = {
      metadata: { document_name: "Spis", language: "sk", page_count: 1, upload_date: "" },
      persons: [],
      evidence: [],
      relationships: [],
      timeline: [
        {
          id: "e1",
          timestamp: "2026-08-17T18:00:00Z",
          title: "Udalosť skôr",
          description: "",
          location: null,
          persons_involved: [],
          evidence_links: [],
          tags: [],
          source_text: "",
          confidence: 1,
          approximate: false,
        },
      ],
    };

    const merged = mergeAnalysisResults([a1, a2], "Spis");
    expect(merged.timeline.length).toBe(2);
    expect(merged.timeline[0].title).toBe("Udalosť skôr");
    expect(merged.timeline[1].title).toBe("Udalosť neskôr");
  });

  it("správne zlúči a deduplikuje dôkazy a väzby", () => {
    const a1: Analysis = {
      metadata: { document_name: "Spis", language: "sk", page_count: 1, upload_date: "" },
      persons: [{ id: "p1", name: "Adam", role: "", description: null, aliases: [] }],
      evidence: [{ id: "ev1", type: "photo", content: "Zbraň", source: "Kriminalistika", relevance_score: 0.9 }],
      relationships: [{ person1_id: "p1", person2_id: "p2", type: "kolega", description: "", evidence_supporting: [] }],
      timeline: [],
    };
    const a2: Analysis = {
      metadata: { document_name: "Spis", language: "sk", page_count: 1, upload_date: "" },
      persons: [{ id: "p2", name: "Beno", role: "", description: null, aliases: [] }],
      evidence: [{ id: "ev2", type: "photo", content: "Zbraň", source: "Kriminalistika", relevance_score: 0.9 }],
      relationships: [],
      timeline: [],
    };

    const merged = mergeAnalysisResults([a1, a2], "Spis");
    expect(merged.evidence.length).toBe(1); // deduplikované podľa typu a obsahu
    expect(merged.relationships.length).toBe(1);
  });

  it("zachová page pri merge timeline a relationships", () => {
    const a1: Analysis = {
      metadata: { document_name: "Spis", language: "sk", page_count: 1, upload_date: "" },
      persons: [],
      evidence: [],
      relationships: [
        {
          person1_id: "p1",
          person2_id: "p2",
          type: "kolega",
          description: "popis",
          evidence_supporting: [],
          page: 3,
        },
      ],
      timeline: [
        {
          id: "e1",
          timestamp: "2026-08-17T10:00:00Z",
          title: "Udalosť",
          description: "",
          location: null,
          persons_involved: [],
          evidence_links: [],
          tags: ["rozpor"],
          source_text: "citát",
          confidence: 1,
          approximate: false,
          page: 12,
        },
      ],
    };

    const merged = mergeAnalysisResults([a1], "Spis");
    expect(merged.timeline[0].page).toBe(12);
    expect(merged.relationships[0].page).toBe(3);
  });
});
