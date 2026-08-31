import { describe, expect, it } from "vitest";
import {
  aggregateForensicDocuments,
  independentEvidence,
  maxIndependentConfidence,
} from "../../src/lib/forensic/forensicAggregate";
import { emptyForensicDocumentAnalysis } from "../../src/lib/forensic/types";
import { ev, validForensicAnalysis } from "../fixtures/forensic";

describe("forensic aggregate", () => {
  it("nezvýši confidence opakovaním rovnakého tvrdenia v odvodenom dokumente", () => {
    const quote = "Ján Novák zaplatil faktúru FA-2023-441";
    const evidenceA = ev({
      document_id: "1-faktura.pdf",
      quote,
      evidence_type: "direct_evidence",
    });
    const evidenceCopy = ev({
      document_id: "2-kopia-faktury.pdf",
      quote,
      evidence_type: "direct_evidence",
    });
    const independent = independentEvidence([evidenceA, evidenceCopy]);
    expect(independent).toHaveLength(1);
    expect(maxIndependentConfidence([evidenceA, evidenceCopy])).toBe(
      maxIndependentConfidence([evidenceA])
    );
  });

  it("dve listiny s rovnakým citátom nepovažuje za nezávislé potvrdenie", () => {
    const quote = "Zbrane prevzal Ján Novák, preberací protokol č. 17";
    const a = validForensicAnalysis({
      document_id: "1-protokol.pdf",
      questions: {
        weapons_flow: {
          answer: "Ján Novák fyzicky prevzal zbrane.",
          actors: [
            {
              name: "Ján Novák",
              entity: null,
              role: "physical_receiver",
              found_in_text: true,
              inferred: false,
              confidence: 0.9,
              evidence: [ev({ document_id: "1-protokol.pdf", quote })],
              contradicting_evidence: [],
            },
          ],
          missing_evidence: [],
        },
        plan_author: emptyForensicDocumentAnalysis("x").questions.plan_author,
        financing: emptyForensicDocumentAnalysis("x").questions.financing,
      },
    });
    const b = validForensicAnalysis({
      document_id: "2-odpis-protokolu.pdf",
      questions: {
        weapons_flow: {
          answer: "Ján Novák fyzicky prevzal zbrane.",
          actors: [
            {
              name: "Ján Novák",
              entity: null,
              role: "physical_receiver",
              found_in_text: true,
              inferred: false,
              confidence: 0.9,
              evidence: [ev({ document_id: "2-odpis-protokolu.pdf", quote })],
              contradicting_evidence: [],
            },
          ],
          missing_evidence: [],
        },
        plan_author: emptyForensicDocumentAnalysis("x").questions.plan_author,
        financing: emptyForensicDocumentAnalysis("x").questions.financing,
      },
    });

    const caseResult = aggregateForensicDocuments(
      [
        {
          status: "ready",
          meta: {
            document_id: a.document_id,
            document_hash: "h1",
            prompt_version: "1.0.0",
            model: "mistral-large-latest",
            analyzed_at: "2026-01-15T12:00:00.000Z",
          },
          result: a,
          diagnostics: null,
        },
        {
          status: "ready",
          meta: {
            document_id: b.document_id,
            document_hash: "h2",
            prompt_version: "1.0.0",
            model: "mistral-large-latest",
            analyzed_at: "2026-01-15T12:00:00.000Z",
          },
          result: b,
          diagnostics: null,
        },
      ],
      { model: "mistral-large-latest", analyzedAt: "2026-01-15T12:00:00.000Z" }
    );

    const actor = caseResult.case_level?.questions.weapons_flow.actors[0];
    expect(actor?.confidence).toBeLessThanOrEqual(0.9);
  });

  it("eviduje rozporné dátumy pri rovnakej faktúre bez opravy", () => {
    const tx = (id: string, date: string) =>
      validForensicAnalysis({
        document_id: id,
        transactions: [
          {
            date,
            amount: "14 500 EUR",
            currency: "EUR",
            invoice_number: "FA-2023-441",
            license_number: "ZNV-12/2022",
            serial_number: "SN-998877",
            payer: "Arms SK s.r.o.",
            payee: "Supply CZ a.s.",
            purpose: "nákup",
            evidence: [ev({ document_id: id, quote: `Faktúra FA-2023-441 zo dňa ${date}` })],
          },
        ],
      });

    const result = aggregateForensicDocuments(
      [
        {
          status: "ready",
          meta: {
            document_id: "1-a.pdf",
            document_hash: "h1",
            prompt_version: "1.0.0",
            model: "mistral-large-latest",
            analyzed_at: "2026-01-15T12:00:00.000Z",
          },
          result: tx("1-a.pdf", "12.03.2023"),
          diagnostics: null,
        },
        {
          status: "ready",
          meta: {
            document_id: "2-b.pdf",
            document_hash: "h2",
            prompt_version: "1.0.0",
            model: "mistral-large-latest",
            analyzed_at: "2026-01-15T12:00:00.000Z",
          },
          result: tx("2-b.pdf", "13.03.2023"),
          diagnostics: null,
        },
      ],
      { model: "mistral-large-latest", analyzedAt: "2026-01-15T12:00:00.000Z" }
    );

    const dates = result.case_level?.contradictions.filter(
      (c) => c.field === "transaction.date"
    );
    expect(dates?.length).toBeGreaterThan(0);
    expect(dates?.[0].value_a).toBe("12.03.2023");
    expect(dates?.[0].value_b).toBe("13.03.2023");
    const invoices = result.case_level?.transactions.map((t) => t.invoice_number);
    expect(invoices).toContain("FA-2023-441");
  });

  it("pri zlyhaní všetkých dokumentov vráti failed a diagnostiku", () => {
    const result = aggregateForensicDocuments(
      [
        {
          status: "failed",
          meta: {
            document_id: "1-x.pdf",
            document_hash: "h",
            prompt_version: "1.0.0",
            model: "mistral-large-latest",
            analyzed_at: "2026-01-15T12:00:00.000Z",
          },
          result: null,
          diagnostics: {
            attempts: 2,
            validation_errors: ["Odpoveď nie je validné JSON"],
            raw_response_excerpt: "{nope",
            failed_at: "2026-01-15T12:00:00.000Z",
          },
        },
      ],
      { model: "mistral-large-latest", analyzedAt: "2026-01-15T12:00:00.000Z" }
    );
    expect(result.status).toBe("failed");
    expect(result.case_level).toBeNull();
    expect(result.diagnostics?.validation_errors[0]).toMatch(/JSON/);
  });
});
