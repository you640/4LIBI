import { describe, it, expect, vi } from "vitest";
import {
  parseSourceMetadata,
  detectDateConflict,
  classifySourceKind,
  sourceGroupId,
  admissibilityGaps,
  loadLinearCatalog,
} from "../../src/lib/forensic/linearClient";
import { isNonAdmissibleDerived } from "../../src/lib/forensic/sourceOfTruth";
import { independentOrigins } from "../../src/lib/forensic/provenance";
import { independentEvidence } from "../../src/lib/forensic/forensicAggregate";
import { ev } from "../fixtures/forensic";
import { ALLOWED_LINEAR_PROJECT_ID } from "../../src/lib/forensic/sourceOfTruth";

const PROJECT_ID = ALLOWED_LINEAR_PROJECT_ID;

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

describe("dateConflict a dátumy narodenia", () => {
  it("uloží dátum Mareka Plcha ako dateConflict a neopraví rok", () => {
    const text = `
osoba: Marek Plch
typ dokumentu: zápisnica o výsluchu
dátum: 12.01.2026/2025
úplnosť: čiastočná
SHA-256: abc
`;
    const meta = parseSourceMetadata(text);
    expect(meta.personOrEntity).toMatch(/Marek Plch/i);
    expect(meta.dateConflict).toBe("12.01.2026/2025");
    expect(meta.documentDate).toBeNull();
    expect(meta.dateConflict).not.toBe("12.01.2026");
    expect(meta.dateConflict).not.toBe("12.01.2025");
  });

  it("detectDateConflict neskolabuje 2026/2025 na jeden rok", () => {
    const result = detectDateConflict(
      "Výsluch Mareka Plcha dňa 12.01.2026/2025",
      null,
      null
    );
    expect(result.dateConflict).toBe("12.01.2026/2025");
    expect(result.documentDate).toBeNull();
  });

  it("výsluch 12.08.2026, osoba nar. 30.05.1989 → dateConflict null", () => {
    const text = "DÔKAZ 07 – Výsluch zadržaného Erika Babčana, nar. 30.05.1989 v Košiciach, výsluch dňa 12.08.2026 o 15:02";
    const meta = parseSourceMetadata(text);
    expect(meta.dateConflict).toBeNull();
    expect(meta.documentDate).toBe("12.08.2026");
  });

  it("výsluch 13.08.2026, osoba nar. 03.07.1987 → dateConflict null", () => {
    const text = "DÔKAZ 06 – Výsluch obvineného Dimitriho Cohena, nar. 03.07.1987, začatý 13.08.2026 o 23:40";
    const meta = parseSourceMetadata(text);
    expect(meta.dateConflict).toBeNull();
    expect(meta.documentDate).toBe("13.08.2026");
  });

  it("text obsahujúci viacero dátumov nákupov → dateConflict null", () => {
    const text = "Svedok uviedol, že dňa 10.01.2024 objednal materiál, dňa 15.02.2024 ho prevzal a dňa 01.03.2024 uhradil faktúru.";
    const result = detectDateConflict(text, "12.08.2025", null);
    expect(result.dateConflict).toBeNull();
    expect(result.documentDate).toBe("12.08.2025");
  });
});

describe("derived_index nie je skutkový dôkaz", () => {
  it("register, timeline, AI summary a SOURCE OF TRUTH sú neprípustné", () => {
    expect(isNonAdmissibleDerived("Hlavný register osôb")).toBe(true);
    expect(isNonAdmissibleDerived("Časová os prípadu")).toBe(true);
    expect(isNonAdmissibleDerived("AI súhrn výpovedí")).toBe(true);
    expect(isNonAdmissibleDerived("00A SOURCE OF TRUTH — tri otázky")).toBe(true);
    expect(classifySourceKind({ title: "04 – Register spisov, listín a dôkazov", documentType: "register" })).toBe("derived_index");
    expect(classifySourceKind({ title: "05 – Časová os a hlavný súhrn", documentType: "časová os" })).toBe("derived_index");
    expect(classifySourceKind({ title: "00 – Hlavný index" })).toBe("derived_index");
    expect(isNonAdmissibleDerived("04 – Register spisov, listín a dôkazov", "register")).toBe(true);

    const gaps = admissibilityGaps({
      title: "04 – Register spisov",
      text: "osoba: x\ntyp dokumentu: register\ndátum: 1.1.2020\núplnosť: úplný",
      metadata: parseSourceMetadata("osoba: x\ntyp dokumentu: register\ndátum: 1.1.2020\núplnosť: úplný"),
      hasAttachment: true,
    });
    expect(Array.isArray(gaps)).toBe(true);
  });
});

describe("source_group deduplikácia", () => {
  it("OCR, prepis a originál z jednej zápisnice majú rovnaké source_group_id", () => {
    const group = sourceGroupId("issue-plch", null);
    const orig = ev({
      quote: "originál zápisnice",
      linear_issue_id: "issue-plch",
      attachment_id: "pdf-1",
      source_group_id: group,
    });
    const ocr = ev({
      quote: "ocr zápisnice",
      linear_issue_id: "issue-plch",
      attachment_id: "ocr-1",
      source_group_id: group,
    });
    const transcript = ev({
      quote: "textový prepis zápisnice",
      linear_issue_id: "issue-plch",
      attachment_id: null,
      source_group_id: group,
    });
    expect(orig.source_group_id).toBe(ocr.source_group_id);
    expect(ocr.source_group_id).toBe(transcript.source_group_id);
    expect(independentOrigins([orig, ocr, transcript])).toEqual([`group:${group}`]);
    expect(independentEvidence([orig, ocr, transcript])).toHaveLength(1);
  });
});

describe("klasifikácia prepisu", () => {
  it("textový prepis ako príloha nie je original_attachment", () => {
    expect(
      classifySourceKind({
        title: "Textový prepis výsluchu Marek Plch",
        isAttachment: true,
        filename: "prepis-plch.txt",
        mime: "text/plain",
      })
    ).toBe("verified_transcript");

    expect(
      classifySourceKind({
        title: "OCR pracovný prepis",
        isAttachment: true,
        filename: "ocr.txt",
        mime: "text/plain",
      })
    ).toBe("working_ocr");

    expect(
      classifySourceKind({
        title: "Zápisnica scan",
        isAttachment: true,
        filename: "zapisnica.pdf",
        mime: "application/pdf",
      })
    ).toBe("original_attachment");
  });
});

describe("reálne spracovanie Linear attachmentu", () => {
  it("stiahne prílohu a vyplní text, takže fetchLinearEvidence ju nezaradí ako prázdnu", async () => {
    const attachmentBody = "Toto je obsah originálnej prílohy zápisnice o výsluchu Mareka Plcha, strana 1.";
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      const href = String(url);
      if (href.includes("api.linear.app/graphql")) {
        return jsonResponse({
          data: {
            project: {
              id: PROJECT_ID,
              name: "UBOK",
              issues: {
                pageInfo: { hasNextPage: false, endCursor: null },
                nodes: [
                  {
                    id: "issue-plch",
                    identifier: "UBOK-1",
                    title: "Zápisnica o výsluchu Mareka Plcha",
                    description:
                      "osoba: Marek Plch\ntyp dokumentu: zápisnica o výsluchu\ndátum: 12.01.2026/2025\núplnosť: čiastočná\nhash: deadbeef",
                    url: "https://linear.app/issue/UBOK-1",
                    labels: { nodes: [] },
                    attachments: {
                      nodes: [
                        {
                          id: "att-1",
                          title: "zapisnica-plch.pdf",
                          url: "https://uploads.linear.app/att-1",
                        },
                      ],
                    },
                  },
                ],
              },
            },
          },
        });
      }
      if (href.includes("uploads.linear.app/att-1")) {
        return new Response(attachmentBody, {
          status: 200,
          headers: { "Content-Type": "application/pdf" },
        });
      }
      return jsonResponse({
        data: {
          documents: {
            pageInfo: { hasNextPage: false, endCursor: null },
            nodes: [],
          },
        },
      });
    });

    const catalog = await loadLinearCatalog({
      apiKey: "lin_api_test",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const attachment = catalog.sources.find((s) => s.attachment_id === "att-1");
    expect(attachment).toBeTruthy();
    expect(attachment?.text).toContain("originálnej prílohy");
    expect(attachment?.text.length).toBeGreaterThan(20);
    expect(attachment?.source_kind).toBe("original_attachment");
    expect(attachment?.source_group_id).toBe("issue-plch");
    expect(attachment?.metadata.dateConflict).toBe("12.01.2026/2025");

    expect(attachment?.admissible).toBe(true);
    const passedFilter =
      Boolean(attachment) &&
      attachment!.admissible &&
      attachment!.source_kind !== "derived_index" &&
      (attachment!.text.trim().length >= 20 ||
        Boolean(attachment!.bytes && attachment!.bytes.byteLength > 32));
    expect(passedFilter).toBe(true);
  });
});
