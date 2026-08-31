/**
 * Regresné testy pre documentChunker.ts
 *
 * Kryjú edge-case, keď Mistral vráti null/undefined pre povinné polia:
 * - person.name = undefined/null
 * - evidence.content = undefined/null
 * - timeline event.title = undefined/null
 * - persons_involved obsahuje neplatné hodnoty
 *
 * Tieto testy potvrdzujú, že mergeAnalysisResults a normalizePersonName
 * nepadnú na TypeError a neplatné dáta sa bezpečne preskočia.
 */
import { describe, it, expect } from "vitest";
import { mergeAnalysisResults } from "../../src/lib/documentChunker";
import type { Analysis, Person, Evidence, TimelineEvent } from "../../src/types";

function makeAnalysis(overrides: Partial<Analysis> = {}): Analysis {
  return {
    metadata: {
      document_name: "test-doc",
      language: "sk",
      page_count: 1,
      upload_date: new Date().toISOString(),
    },
    persons: [],
    evidence: [],
    relationships: [],
    timeline: [],
    ...overrides,
  };
}

function makePerson(overrides: Partial<Person> = {}): Person {
  return {
    id: "p_1",
    name: "Testovacia osoba",
    role: "svedok",
    description: null,
    ...overrides,
  };
}

function makeEvidence(overrides: Partial<Evidence> = {}): Evidence {
  return {
    id: "ev_1",
    type: "testimony",
    content: "Test obsah dôkazu",
    source: "test-source",
    relevance_score: 5,
    ...overrides,
  };
}

function makeTimelineEvent(overrides: Partial<TimelineEvent> = {}): TimelineEvent {
  return {
    id: "event_1",
    timestamp: "2025-01-01T00:00:00Z",
    title: "Test udalosť",
    description: "Popis udalosti",
    location: null,
    persons_involved: [],
    evidence_links: [],
    tags: [],
    source_text: "test",
    confidence: 0.8,
    approximate: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// mergeAnalysisResults — null/undefined guards
// ---------------------------------------------------------------------------

describe("mergeAnalysisResults – null/undefined guards", () => {
  it("should handle person.name = undefined without throwing", () => {
    const a1 = makeAnalysis({
      persons: [
        makePerson({ id: "p_1", name: undefined as unknown as string }),
        makePerson({ id: "p_2", name: "Ján Novák" }),
      ],
    });
    const a2 = makeAnalysis({
      persons: [
        makePerson({ id: "p_3", name: "Ján Novák" }),
      ],
    });

    const result = mergeAnalysisResults([a1, a2], "test");
    // person with undefined name should be skipped
    expect(result.persons.length).toBe(1);
    expect(result.persons[0].name).toBe("Ján Novák");
  });

  it("should handle person.name = null without throwing", () => {
    const a1 = makeAnalysis({
      persons: [
        makePerson({ id: "p_1", name: null as unknown as string }),
      ],
    });
    const a2 = makeAnalysis({
      persons: [
        makePerson({ id: "p_2", name: "Mária Kováčová" }),
      ],
    });

    const result = mergeAnalysisResults([a1, a2], "test");
    expect(result.persons.length).toBe(1);
    expect(result.persons[0].name).toBe("Mária Kováčová");
  });

  it("should handle person.name = empty string without throwing", () => {
    const a1 = makeAnalysis({
      persons: [
        makePerson({ id: "p_1", name: "" }),
        makePerson({ id: "p_2", name: "   " }),
      ],
    });
    const a2 = makeAnalysis({
      persons: [
        makePerson({ id: "p_3", name: "Reálna osoba" }),
      ],
    });

    const result = mergeAnalysisResults([a1, a2], "test");
    // empty or whitespace-only names should be skipped by normalizePersonName returning ""
    expect(result.persons.some((p) => p.name === "Reálna osoba")).toBe(true);
  });

  it("should handle evidence.content = undefined without throwing", () => {
    const a1 = makeAnalysis({
      evidence: [
        makeEvidence({ id: "ev_1", content: undefined as unknown as string }),
        makeEvidence({ id: "ev_2", content: "Platný dôkaz" }),
      ],
    });
    const a2 = makeAnalysis({
      evidence: [
        makeEvidence({ id: "ev_3", content: null as unknown as string }),
      ],
    });

    const result = mergeAnalysisResults([a1, a2], "test");
    // should not throw; evidence with empty content still gets included
    expect(result.evidence.length).toBeGreaterThanOrEqual(1);
  });

  it("should handle timeline event.title = undefined without throwing", () => {
    const a1 = makeAnalysis({
      timeline: [
        makeTimelineEvent({ id: "event_1", title: undefined as unknown as string }),
        makeTimelineEvent({ id: "event_2", title: "Platná udalosť" }),
      ],
    });
    const a2 = makeAnalysis({
      timeline: [
        makeTimelineEvent({ id: "event_3", title: null as unknown as string }),
      ],
    });

    const result = mergeAnalysisResults([a1, a2], "test");
    // events with undefined/null title should be skipped
    expect(result.timeline.some((e) => e.title === "Platná udalosť")).toBe(true);
  });

  it("should handle timeline event.title = null without throwing", () => {
    const a1 = makeAnalysis({
      timeline: [
        makeTimelineEvent({ id: "event_1", title: null as unknown as string }),
      ],
    });

    const a2 = makeAnalysis({
      timeline: [
        makeTimelineEvent({ id: "event_2", title: "Reálna udalosť" }),
      ],
    });

    const result = mergeAnalysisResults([a1, a2], "test");
    // null title event should be skipped
    const titles = result.timeline.map((e) => e.title);
    expect(titles).not.toContain(null);
    expect(titles).toContain("Reálna udalosť");
  });

  it("should handle persons_involved containing undefined/null values", () => {
    const a1 = makeAnalysis({
      persons: [makePerson({ id: "p_1", name: "Ján Novák" })],
      timeline: [
        makeTimelineEvent({
          id: "event_1",
          title: "Udalosť s neplatnými osobami",
          persons_involved: [
            "p_1",
            undefined as unknown as string,
            null as unknown as string,
            "",
          ],
        }),
      ],
    });
    const a2 = makeAnalysis({
      persons: [makePerson({ id: "p_1", name: "Ján Novák" })],
    });

    const result = mergeAnalysisResults([a1, a2], "test");
    expect(result.timeline.length).toBe(1);
    // Should not throw when resolving persons_involved with invalid values
    expect(result.timeline[0].persons_involved).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// mergeAnalysisResults — dedup & correctness
// ---------------------------------------------------------------------------

describe("mergeAnalysisResults – dedup correctness", () => {
  it("should deduplicate same person across chunks", () => {
    const a1 = makeAnalysis({
      persons: [makePerson({ id: "p_1", name: "Erik Babčan", role: "obvinený" })],
    });
    const a2 = makeAnalysis({
      persons: [makePerson({ id: "p_5", name: "Erik Babčan", role: "svedok" })],
    });

    const result = mergeAnalysisResults([a1, a2], "test");
    // Diacritics-insensitive dedup → should result in 1 person
    expect(result.persons.length).toBe(1);
    expect(result.persons[0].name).toBe("Erik Babčan");
  });

  it("should return single analysis unchanged for 1-element array", () => {
    const single = makeAnalysis({
      persons: [makePerson({ id: "p_1", name: "Osoba" })],
      evidence: [makeEvidence({ id: "ev_1", content: "Dôkaz" })],
    });

    const result = mergeAnalysisResults([single], "test");
    expect(result).toBe(single); // same reference
  });

  it("should return empty analysis for empty array", () => {
    const result = mergeAnalysisResults([], "test");
    expect(result.persons).toEqual([]);
    expect(result.evidence).toEqual([]);
    expect(result.timeline).toEqual([]);
    expect(result.relationships).toEqual([]);
  });

  it("should not include invalid persons in final output", () => {
    const a1 = makeAnalysis({
      persons: [
        makePerson({ id: "p_bad1", name: undefined as unknown as string }),
        makePerson({ id: "p_bad2", name: null as unknown as string }),
        makePerson({ id: "p_bad3", name: "" }),
        makePerson({ id: "p_ok", name: "Platná Osoba" }),
      ],
    });
    const a2 = makeAnalysis({
      persons: [
        makePerson({ id: "p_ok2", name: "Druhá Osoba" }),
      ],
    });

    const result = mergeAnalysisResults([a1, a2], "test");
    // Only valid persons should be in output
    const names = result.persons.map((p) => p.name);
    expect(names).toContain("Platná Osoba");
    expect(names).toContain("Druhá Osoba");
    expect(names).not.toContain("");
    expect(names).not.toContain(undefined);
    expect(names).not.toContain(null);
  });
});
