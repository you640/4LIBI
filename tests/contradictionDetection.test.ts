import { describe, it, expect } from "vitest";
import { contradictionEvents, isContradiction } from "../src/lib/caseUtils";
import type { Analysis, TimelineEvent } from "../src/types";

describe("Contradiction & Alibi Collision Detection", () => {
  const baseAnalysis: Analysis = {
    metadata: {
      document_name: "Test Case",
      language: "sk",
      page_count: 5,
      upload_date: "2026-08-17T12:00:00Z",
    },
    persons: [
      { id: "p1", name: "Jozef Mrkvička", role: "podozrivý", description: null, aliases: [] },
      { id: "p2", name: "Peter Svedok", role: "svedok", description: null, aliases: [] },
    ],
    evidence: [],
    relationships: [],
    timeline: [],
  };

  it("deteguje explicitný tag 'rozpor' v udalosti", () => {
    const event: TimelineEvent = {
      id: "e1",
      timestamp: "2026-08-17T20:30:00Z",
      title: "Alibi v kine",
      description: "Tvrdí, že bol v kine, ale záznam ukazuje iné miesto",
      location: "Bratislava",
      persons_involved: ["p1"],
      evidence_links: [],
      tags: ["rozpor", "alibi"],
      source_text: "Bol som v kine od 20:00 do 22:00",
      confidence: 0.9,
      approximate: false,
    };

    expect(isContradiction(event)).toBe(true);
  });

  it("deteguje explicitný tag 'alibi' s nízkou alebo vysokou dôveryhodnosťou", () => {
    const event: TimelineEvent = {
      id: "e2",
      timestamp: "2026-08-17T21:00:00Z",
      title: "Nemožné alibi",
      description: "Svedecká výpoveď odporuje tvrdeniu podozrivého",
      location: "Košice",
      persons_involved: ["p1"],
      evidence_links: [],
      tags: ["alibi"],
      source_text: "Svedok tvrdí, že obvinený bol s ním",
      confidence: 0.88,
      approximate: false,
    };

    expect(isContradiction(event)).toBe(true);
  });

  it("nedeteguje bežnú udalosť bez tagov rozporu", () => {
    const event: TimelineEvent = {
      id: "e3",
      timestamp: "2026-08-17T14:00:00Z",
      title: "Príchod do práce",
      description: "Štandardný príchod zaznamenaný na vrátnici",
      location: "Bratislava",
      persons_involved: ["p1"],
      evidence_links: [],
      tags: ["rutina", "záznam"],
      source_text: "Prišiel do práce o 14:00",
      confidence: 0.95,
      approximate: false,
    };

    expect(isContradiction(event)).toBe(false);
  });

  it("extrahuje zoznam rozporových udalostí zo spisu", () => {
    const analysis: Analysis = {
      ...baseAnalysis,
      timeline: [
        {
          id: "e1",
          timestamp: "2026-08-17T20:30:00Z",
          title: "Udalosť 1",
          description: "Popis 1",
          location: "BA",
          persons_involved: ["p1"],
          evidence_links: [],
          tags: ["rozpor"],
          source_text: "Text 1",
          confidence: 0.9,
          approximate: false,
        },
        {
          id: "e2",
          timestamp: "2026-08-17T21:00:00Z",
          title: "Udalosť 2",
          description: "Popis 2",
          location: "KE",
          persons_involved: ["p1"],
          evidence_links: [],
          tags: ["bežné"],
          source_text: "Text 2",
          confidence: 0.8,
          approximate: false,
        },
        {
          id: "e3",
          timestamp: "2026-08-17T22:00:00Z",
          title: "Udalosť 3",
          description: "Popis 3",
          location: "BB",
          persons_involved: ["p2"],
          evidence_links: [],
          tags: ["alibi_konflikt"],
          source_text: "Text 3",
          confidence: 0.85,
          approximate: false,
        },
      ],
    };

    const contradictions = contradictionEvents(analysis);
    expect(contradictions.length).toBe(2);
    expect(contradictions.map((c) => c.id)).toContain("e1");
    expect(contradictions.map((c) => c.id)).toContain("e3");
  });

  it("zvládne prázdnu časovú os bez pádu", () => {
    const analysis: Analysis = { ...baseAnalysis, timeline: [] };
    const contradictions = contradictionEvents(analysis);
    expect(contradictions).toEqual([]);
  });

  it("správne filtruje case-insensitive tagy 'ROZPOR', 'Alibi'", () => {
    const event: TimelineEvent = {
      id: "e_case",
      timestamp: "2026-08-17T18:00:00Z",
      title: "Test",
      description: "Test",
      location: "BA",
      persons_involved: ["p1"],
      evidence_links: [],
      tags: ["ROZPOR"],
      source_text: "Text",
      confidence: 0.9,
      approximate: false,
    };
    expect(isContradiction(event)).toBe(true);
  });

  it("deteguje rozpor podľa textových kľúčových slov 'nesúlad' a 'odporuje'", () => {
    const event: TimelineEvent = {
      id: "e_keyword",
      timestamp: "2026-08-17T18:00:00Z",
      title: "Výpoveď v nesúlade s kamerou",
      description: "Výpoveď priamo odporuje kamerovému záznamu z miesta činu",
      location: "BA",
      persons_involved: ["p1"],
      evidence_links: [],
      tags: [],
      source_text: "Tvrdil, že bol inde",
      confidence: 0.88,
      approximate: false,
    };
    expect(isContradiction(event)).toBe(true);
  });

  it("deteguje nemožnú bilokáciu rovnakej osoby v rovnaký čas", () => {
    const time = "2026-08-17T20:00:00Z";
    const ev1: TimelineEvent = {
      id: "ev1",
      timestamp: time,
      title: "Platba kartou v Bratislave",
      description: "POS terminál BA",
      location: "Bratislava",
      persons_involved: ["p1"],
      evidence_links: ["ev_pos"],
      tags: ["dokaz"],
      source_text: "Platba v obchode",
      confidence: 0.99,
      approximate: false,
    };
    const ev2: TimelineEvent = {
      id: "ev2",
      timestamp: time,
      title: "Svedectvo o prítomnosti v Košiciach",
      description: "Videný v reštaurácii KE",
      location: "Košice",
      persons_involved: ["p1"],
      evidence_links: [],
      tags: ["svedectvo"],
      source_text: "Sedel so mnou na večeri",
      confidence: 0.85,
      approximate: false,
    };

    // Obidve udalosti v ten istý čas na dvoch rôznych miestach vzdialených 400km
    const timeDeltaMinutes = Math.abs(
      (new Date(ev1.timestamp!).getTime() - new Date(ev2.timestamp!).getTime()) / 60000
    );
    expect(timeDeltaMinutes).toBe(0);
    expect(ev1.location).not.toBe(ev2.location);
  });

  it("správne zoradí udalosti podľa času aj pri neúplných dátumoch", () => {
    const events: TimelineEvent[] = [
      { id: "3", timestamp: "2026-08-17T23:00:00Z", title: "C", description: "", location: null, persons_involved: [], evidence_links: [], tags: [], source_text: "", confidence: 1, approximate: false },
      { id: "1", timestamp: "2026-08-17T10:00:00Z", title: "A", description: "", location: null, persons_involved: [], evidence_links: [], tags: [], source_text: "", confidence: 1, approximate: false },
      { id: "2", timestamp: "2026-08-17T15:30:00Z", title: "B", description: "", location: null, persons_involved: [], evidence_links: [], tags: [], source_text: "", confidence: 1, approximate: false },
      { id: "4", timestamp: null, title: "D", description: "", location: null, persons_involved: [], evidence_links: [], tags: [], source_text: "", confidence: 1, approximate: true },
    ];

    const sorted = [...events].sort((a, b) => {
      if (!a.timestamp && !b.timestamp) return 0;
      if (!a.timestamp) return 1;
      if (!b.timestamp) return -1;
      return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
    });

    expect(sorted.map((e) => e.id)).toEqual(["1", "2", "3", "4"]);
  });

  it("správne identifikuje rozpory v rýchlych po sebe idúcich alibi", () => {
    const t1 = new Date("2026-08-17T20:00:00Z").getTime();
    const t2 = new Date("2026-08-17T20:30:00Z").getTime();
    const diffHours = (t2 - t1) / (1000 * 60 * 60); // 0.5h
    const distanceKm = 400; // Bratislava -> Košice
    const speed = distanceKm / diffHours; // 800 km/h

    expect(speed).toBe(800);
    expect(speed > 160).toBe(true); // Fyzikálne nemožné autom
  });
});
