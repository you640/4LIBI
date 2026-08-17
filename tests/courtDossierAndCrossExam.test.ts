import { describe, it, expect } from "vitest";
import {
  buildLocalCrossExamQuestions,
  CROSS_EXAM_MODES,
} from "../src/lib/crossExamination";
import { generateCourtDossierMarkdown } from "../src/lib/courtDossier";
import type { Contradiction, Analysis } from "../src/types";

describe("Court Dossier & Cross-Examination Engine", () => {
  const sampleContradictions: Contradiction[] = [
    {
      id: "c1",
      case_id: "case_01",
      title: "Alibi v rozpore s kamerou",
      explanation: "Podozrivý tvrdí, že spal doma, ale kamera ho zachytila na čerpacej stanici.",
      severity: "critical",
      contradiction_type: "bilocation",
      entity_ref: "Jozef Podozrivý",
      document_title: "Zápisnica o výsluchu",
    },
    {
      id: "c2",
      case_id: "case_01",
      title: "Nezrovnalosť v čase odchodu",
      explanation: "Svedok uvádza odchod o 20:00, digitálny kľúč zaznamenal 21:15.",
      severity: "high",
      contradiction_type: "timeline_gap",
      entity_ref: "Peter Svedok",
      document_title: "Výpis z elektronického prístupu",
    },
  ];

  it("správne definuje všetky 3 režimy výsluchu (mild, aggressive, alibi)", () => {
    expect(CROSS_EXAM_MODES.mild).toBeDefined();
    expect(CROSS_EXAM_MODES.aggressive).toBeDefined();
    expect(CROSS_EXAM_MODES.alibi).toBeDefined();
  });

  it("vygeneruje agresívne otázky pre krížový výsluch", () => {
    const questions = buildLocalCrossExamQuestions(sampleContradictions, "aggressive");
    expect(questions.length).toBe(2);
    expect(questions[0].targetPerson).toBe("Jozef Podozrivý");
    expect(questions[0].question).toContain("Ako vysvetlíte");
    expect(questions[0].suggestedFollowUps.length).toBeGreaterThan(0);
  });

  it("vygeneruje otázky pre detailnú verifikáciu alibi", () => {
    const questions = buildLocalCrossExamQuestions(sampleContradictions, "alibi");
    expect(questions.length).toBe(2);
    expect(questions[0].question).toContain("minútu po minúte");
    expect(questions[0].rationale).toContain("rekonštrukcia alibi");
  });

  it("vygeneruje mierne otázky pre svedka", () => {
    const questions = buildLocalCrossExamQuestions(sampleContradictions, "mild");
    expect(questions.length).toBe(2);
    expect(questions[0].question).toContain("Mohli by ste bližšie vysvetliť");
  });

  it("vygeneruje formálny súdny spis (Court Dossier) v Markdown formáte", () => {
    const sampleAnalysis: Analysis = {
      metadata: {
        document_name: "Kauza Nočné Alibi",
        language: "sk",
        page_count: 12,
        upload_date: "2026-08-17T10:00:00Z",
      },
      persons: [
        { id: "p1", name: "Jozef Podozrivý", role: "obvinený", description: "Hlavný podozrivý", aliases: [] },
      ],
      evidence: [
        { id: "ev1", type: "video", content: "Kamerový záznam z pumpy", source: "ČS Slovnaft", relevance_score: 0.95 },
      ],
      relationships: [],
      timeline: [
        {
          id: "t1",
          timestamp: "2026-08-17T20:30:00Z",
          title: "Pohyb na pumpe",
          description: "Tankovanie na ČS",
          location: "Bratislava",
          persons_involved: ["p1"],
          evidence_links: ["ev1"],
          tags: ["rozpor"],
          source_text: "Kamera ČS",
          confidence: 0.95,
          approximate: false,
        },
      ],
    };

    const markdown = generateCourtDossierMarkdown(sampleAnalysis, "ČVS: PP-104/2026");

    expect(markdown).toContain("# FORENZNÁ ZPRÁVA A ANALÝZA ALIBI");
    expect(markdown).toContain("Kauza Nočné Alibi");
    expect(markdown).toContain("ČVS: PP-104/2026");
    expect(markdown).toContain("## 1. PREHĽAD IDENTIFIKOVANÝCH OSÔB A SUBJEKTOV");
    expect(markdown).toContain("Jozef Podozrivý");
    expect(markdown).toContain("## 2. CHRONOLOGICKÁ REKONŠTRUKCIA UDALOSTÍ");
    expect(markdown).toContain("Pohyb na pumpe");
  });
});
