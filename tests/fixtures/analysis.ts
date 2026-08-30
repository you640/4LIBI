import type { Analysis } from "../../src/types";

export const minimalAnalysisFixture: Analysis = {
  metadata: {
    document_name: "test-spis.pdf",
    language: "sk",
    page_count: 1,
    upload_date: "2026-01-15T12:00:00.000Z",
  },
  persons: [
    {
      id: "p1",
      name: "Ján Novák",
      role: "podozrivý",
      description: "Podozrivý z prípadu",
      aliases: [],
    },
  ],
  evidence: [
    {
      id: "e1",
      type: "video",
      content: "Kamerový záznam",
      source: "kamera zachytila",
      relevance_score: 8,
    },
  ],
  relationships: [
    {
      person1_id: "p1",
      person2_id: "p2",
      type: "kontakt",
      description: "kontakt",
      evidence_supporting: [],
    },
  ],
  timeline: [
    {
      id: "t1",
      title: "Rozpor v alibi",
      description: "Nemožné alibi medzi Bratislavou a Košicami",
      timestamp: "2026-01-10T10:00:00.000Z",
      location: "Bratislava",
      tags: ["rozpor", "alibi"],
      source_text: "bol som v BA",
      persons_involved: ["p1"],
      evidence_links: [],
      confidence: 0.9,
      approximate: false,
      page: 12,
    },
  ],
  contradictions: [],
};

/** Two-city travel conflict for geospatial / dossier tests. */
export const travelConflictFixture: Analysis = {
  metadata: {
    document_name: "Vyšetrovací spis č. 123/2023",
    language: "sk",
    page_count: 3,
    upload_date: "2023-05-16T10:00:00Z",
  },
  persons: [
    {
      id: "P001",
      name: "Ján Novák",
      role: "obvinený",
      type: "podozrivý",
      description: "Obvinený z krádeže.",
    },
  ],
  evidence: [],
  relationships: [],
  timeline: [
    {
      id: "T001",
      timestamp: "2023-05-15T08:00:00Z",
      title: "Začiatok pracovného dňa",
      description: "Podľa výpovede bol celý deň v Košiciach.",
      location: "Košice",
      persons_involved: ["P001"],
      evidence_links: [],
      tags: ["alibi"],
      source_text: "Boli sme v Košiciach celý deň, od 8:00 do 20:00.",
      confidence: 0.7,
      approximate: false,
    },
    {
      id: "T002",
      timestamp: "2023-05-15T13:40:00Z",
      title: "Mýtny lístok D1",
      description: "Prechod mýtnou bránou smerom z Bratislavy do Košíc.",
      location: "Diaľnica D1, Bratislava",
      persons_involved: ["P001"],
      evidence_links: [],
      tags: ["rozpor", "alibi"],
      source_text: "Mýtny lístok na diaľnici D1, čas 13:40",
      confidence: 1.0,
      approximate: false,
      page: 12,
    },
  ],
};

export function analysisJsonResponse(): string {
  return JSON.stringify(minimalAnalysisFixture);
}
