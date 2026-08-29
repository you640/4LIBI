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
      description: "Nemožné alibi medzi BA a KE",
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

export function analysisJsonResponse(): string {
  return JSON.stringify(minimalAnalysisFixture);
}
