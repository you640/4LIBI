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

  it("osoba a firma s rovnakým menom dostanú person: a company: a nezlúčia sa", () => {
    const analysis = validForensicAnalysis({
      document_id: "test.pdf",
      questions: {
        weapons_flow: {
          answer: null,
          confirmed_answer: null,
          best_supported_candidates: [],
          missing_confirmation: [],
          status: "insufficient_evidence",
          actors: [
            {
              entity_id: "person:alfa-trans",
              name: "Alfa Trans",
              entity: null,
              entity_kind: "person",
              role: "physical_receiver",
              found_in_text: true,
              inferred: false,
              confidence: 0.8,
              evidence: [ev({ quote: "Alfa Trans prevzal tovar osobne", evidence_type: "direct_evidence" })],
              contradicting_evidence: [],
            },
            {
              entity_id: "company:alfa-trans",
              name: "Alfa Trans",
              entity: null,
              entity_kind: "company",
              role: "buyer_entity",
              found_in_text: true,
              inferred: false,
              confidence: 0.9,
              evidence: [ev({ quote: "Alfa Trans s.r.o. objednala tovar", evidence_type: "direct_evidence" })],
              contradicting_evidence: [],
            },
          ],
          missing_evidence: [],
        },
        plan_author: emptyForensicDocumentAnalysis("x").questions.plan_author,
        financing: emptyForensicDocumentAnalysis("x").questions.financing,
      },
    });

    const res = aggregateForensicDocuments(
      [
        {
          status: "ready",
          meta: {
            document_id: "test.pdf",
            document_hash: "h1",
            prompt_version: "1.0.0",
            model: "mistral-large-latest",
            analyzed_at: "2026-01-15T12:00:00.000Z",
          },
          result: analysis,
          diagnostics: null,
        },
      ],
      { model: "mistral-large-latest", analyzedAt: "2026-01-15T12:00:00.000Z" }
    );

    const actors = res.case_level?.questions.weapons_flow.actors || [];
    expect(actors).toHaveLength(2);
    const person = actors.find((a) => a.entity_kind === "person");
    const company = actors.find((a) => a.entity_kind === "company");
    expect(person?.entity_id).toBe("person:alfa-trans");
    expect(company?.entity_id).toBe("company:alfa-trans");
  });

  it("buyer_entity vždy vygeneruje company: ID aj keď model dodá person", () => {
    const analysis = validForensicAnalysis({
      document_id: "test.pdf",
      questions: {
        weapons_flow: {
          answer: null,
          confirmed_answer: null,
          best_supported_candidates: [],
          missing_confirmation: [],
          status: "insufficient_evidence",
          actors: [
            {
              entity_id: "person:marek-plch",
              name: "Marek Plch",
              entity: null,
              entity_kind: "person",
              role: "buyer_entity",
              found_in_text: true,
              inferred: false,
              confidence: 0.9,
              evidence: [ev({ quote: "Kupujúci: Marek Plch", evidence_type: "direct_evidence" })],
              contradicting_evidence: [],
            },
          ],
          missing_evidence: [],
        },
        plan_author: emptyForensicDocumentAnalysis("x").questions.plan_author,
        financing: emptyForensicDocumentAnalysis("x").questions.financing,
      },
    });

    const res = aggregateForensicDocuments(
      [
        {
          status: "ready",
          meta: {
            document_id: "test.pdf",
            document_hash: "h1",
            prompt_version: "1.0.0",
            model: "mistral-large-latest",
            analyzed_at: "2026-01-15T12:00:00.000Z",
          },
          result: analysis,
          diagnostics: null,
        },
      ],
      { model: "mistral-large-latest", analyzedAt: "2026-01-15T12:00:00.000Z" }
    );

    const actor = res.case_level?.questions.weapons_flow.actors[0];
    expect(actor?.entity_kind).toBe("company");
    expect(actor?.entity_id).toBe("company:marek-plch");
  });

  it("mergePayers zlúči záznamy iba pri zhode entity_id + role", () => {
    const analysisA = validForensicAnalysis({
      document_id: "docA.pdf",
      questions: {
        weapons_flow: emptyForensicDocumentAnalysis("x").questions.weapons_flow,
        plan_author: emptyForensicDocumentAnalysis("x").questions.plan_author,
        financing: {
          answer: null,
          confirmed_answer: null,
          best_supported_candidates: [],
          missing_confirmation: [],
          status: "insufficient_evidence",
          payers: [
            {
              entity_id: "company:arms-sk",
              name: "Arms SK",
              entity: null,
              entity_kind: "company",
              role: "invoice_payer",
              found_in_text: true,
              inferred: false,
              confidence: 0.9,
              evidence: [ev({ document_id: "docA.pdf", quote: "Platiteľ: Arms SK faktúra 1" })],
            },
            {
              entity_id: "company:arms-sk",
              name: "Arms SK",
              entity: null,
              entity_kind: "company",
              role: "cash_payer",
              found_in_text: true,
              inferred: false,
              confidence: 0.7,
              evidence: [ev({ document_id: "docA.pdf", quote: "Arms SK zaplatil v hotovosti" })],
            },
          ],
          funding_sources: [],
          confidence: 0.9,
          evidence: [],
          missing_evidence: [],
        },
      },
    });

    const analysisB = validForensicAnalysis({
      document_id: "docB.pdf",
      questions: {
        weapons_flow: emptyForensicDocumentAnalysis("x").questions.weapons_flow,
        plan_author: emptyForensicDocumentAnalysis("x").questions.plan_author,
        financing: {
          answer: null,
          confirmed_answer: null,
          best_supported_candidates: [],
          missing_confirmation: [],
          status: "insufficient_evidence",
          payers: [
            {
              entity_id: "company:arms-sk",
              name: "Arms SK",
              entity: null,
              entity_kind: "company",
              role: "invoice_payer",
              found_in_text: true,
              inferred: false,
              confidence: 0.9,
              evidence: [ev({ document_id: "docB.pdf", quote: "Platiteľ: Arms SK faktúra 2" })],
            },
            {
              entity_id: "person:arms-sk",
              name: "Arms SK",
              entity: null,
              entity_kind: "person",
              role: "invoice_payer",
              found_in_text: true,
              inferred: false,
              confidence: 0.6,
              evidence: [ev({ document_id: "docB.pdf", quote: "Pán Arms SK uhradil osobne" })],
            },
          ],
          funding_sources: [],
          confidence: 0.9,
          evidence: [],
          missing_evidence: [],
        },
      },
    });

    const res = aggregateForensicDocuments(
      [
        {
          status: "ready",
          meta: {
            document_id: "docA.pdf",
            document_hash: "h1",
            prompt_version: "1.0.0",
            model: "mistral-large-latest",
            analyzed_at: "2026-01-15T12:00:00.000Z",
          },
          result: analysisA,
          diagnostics: null,
        },
        {
          status: "ready",
          meta: {
            document_id: "docB.pdf",
            document_hash: "h2",
            prompt_version: "1.0.0",
            model: "mistral-large-latest",
            analyzed_at: "2026-01-15T12:00:00.000Z",
          },
          result: analysisB,
          diagnostics: null,
        },
      ],
      { model: "mistral-large-latest", analyzedAt: "2026-01-15T12:00:00.000Z" }
    );

    const payers = res.case_level?.questions.financing.payers || [];
    // company:arms-sk|invoice_payer (merged from docA & docB), company:arms-sk|cash_payer, person:arms-sk|invoice_payer
    expect(payers).toHaveLength(3);
    const invoiceCompany = payers.find((p) => p.entity_id === "company:arms-sk" && p.role === "invoice_payer");
    expect(invoiceCompany?.evidence).toHaveLength(2);
  });

  it("hypothesis ani samotná testimony nepotvrdia answer", () => {
    const analysis = validForensicAnalysis({
      document_id: "test.pdf",
      questions: {
        weapons_flow: emptyForensicDocumentAnalysis("x").questions.weapons_flow,
        plan_author: {
          answer: "Peter Kováč navrhol plán",
          confirmed_answer: "Peter Kováč navrhol plán",
          best_supported_candidates: [],
          missing_confirmation: [],
          status: "sufficient",
          candidates: [
            {
              entity_id: "person:peter-kovac",
              name: "Peter Kováč",
              entity: null,
              entity_kind: "person",
              role: "designer",
              found_in_text: true,
              inferred: false,
              confidence: 0.55,
              evidence: [
                ev({
                  quote: "Svedok vypovedal že plán vymyslel Peter Kováč",
                  evidence_type: "testimony",
                  source_group_id: "group-1",
                }),
              ],
              contradicting_evidence: [],
            },
          ],
          confidence: 0.55,
          evidence: [
            ev({
              quote: "Svedok vypovedal že plán vymyslel Peter Kováč",
              evidence_type: "testimony",
              source_group_id: "group-1",
            }),
          ],
          alternative_explanations: [],
          missing_evidence: [],
        },
        financing: emptyForensicDocumentAnalysis("x").questions.financing,
      },
    });

    const res = aggregateForensicDocuments(
      [
        {
          status: "ready",
          meta: {
            document_id: "test.pdf",
            document_hash: "h1",
            prompt_version: "1.0.0",
            model: "mistral-large-latest",
            analyzed_at: "2026-01-15T12:00:00.000Z",
          },
          result: analysis,
          diagnostics: null,
        },
      ],
      { model: "mistral-large-latest", analyzedAt: "2026-01-15T12:00:00.000Z" }
    );

    const q = res.case_level?.questions.plan_author;
    expect(q?.confirmed_answer).toBeNull();
    expect(q?.answer).toBeNull();
    expect(q?.status).toBe("insufficient_evidence");
    expect(q?.best_supported_candidates).toHaveLength(1);
  });

  it("2 nezávislé source_group s direct_evidence/corroborated potvrdia answer", () => {
    const analysis = validForensicAnalysis({
      document_id: "test.pdf",
      questions: {
        weapons_flow: emptyForensicDocumentAnalysis("x").questions.weapons_flow,
        plan_author: {
          answer: "Peter Kováč navrhol plán",
          confirmed_answer: null,
          best_supported_candidates: [],
          missing_confirmation: [],
          status: "insufficient_evidence",
          candidates: [
            {
              entity_id: "person:peter-kovac",
              name: "Peter Kováč",
              entity: null,
              entity_kind: "person",
              role: "designer",
              found_in_text: true,
              inferred: false,
              confidence: 0.85,
              evidence: [
                ev({
                  quote: "Dôkaz A o návrhu plánu",
                  evidence_type: "corroborated",
                  source_group_id: "group-1",
                }),
                ev({
                  quote: "Dôkaz B o návrhu plánu",
                  evidence_type: "corroborated",
                  source_group_id: "group-2",
                }),
              ],
              contradicting_evidence: [],
            },
          ],
          confidence: 0.85,
          evidence: [
            ev({
              quote: "Dôkaz A o návrhu plánu",
              evidence_type: "corroborated",
              source_group_id: "group-1",
            }),
            ev({
              quote: "Dôkaz B o návrhu plánu",
              evidence_type: "corroborated",
              source_group_id: "group-2",
            }),
          ],
          alternative_explanations: [],
          missing_evidence: [],
        },
        financing: emptyForensicDocumentAnalysis("x").questions.financing,
      },
    });

    const res = aggregateForensicDocuments(
      [
        {
          status: "ready",
          meta: {
            document_id: "test.pdf",
            document_hash: "h1",
            prompt_version: "1.0.0",
            model: "mistral-large-latest",
            analyzed_at: "2026-01-15T12:00:00.000Z",
          },
          result: analysis,
          diagnostics: null,
        },
      ],
      { model: "mistral-large-latest", analyzedAt: "2026-01-15T12:00:00.000Z" }
    );

    const q = res.case_level?.questions.plan_author;
    expect(q?.confirmed_answer).toBe("Peter Kováč navrhol plán");
    expect(q?.answer).toBe("Peter Kováč navrhol plán");
    expect(q?.status).toBe("sufficient");
  });

  it("best_supported_candidates pre financing obsahuje aj funding_sources", () => {
    const analysis = validForensicAnalysis({
      document_id: "test.pdf",
      questions: {
        weapons_flow: emptyForensicDocumentAnalysis("x").questions.weapons_flow,
        plan_author: emptyForensicDocumentAnalysis("x").questions.plan_author,
        financing: {
          answer: null,
          confirmed_answer: null,
          best_supported_candidates: [],
          missing_confirmation: [],
          status: "insufficient_evidence",
          payers: [
            {
              entity_id: "company:arms-sk",
              name: "Arms SK s.r.o.",
              entity: null,
              entity_kind: "company",
              role: "invoice_payer",
              found_in_text: true,
              inferred: false,
              confidence: 0.9,
              evidence: [ev({ quote: "Platiteľ faktúry: Arms SK" })],
            },
          ],
          funding_sources: [
            {
              entity_id: "person:tajny-investor",
              name: "Tajný Investor",
              entity: null,
              entity_kind: "person",
              origin: "hotovosť",
              distinct_from_invoice_payer: true,
              confidence: 0.7,
              evidence: [ev({ quote: "Peniaze v hotovosti dodal Tajný Investor" })],
            },
          ],
          confidence: 0.9,
          evidence: [],
          missing_evidence: [],
        },
      },
    });

    const res = aggregateForensicDocuments(
      [
        {
          status: "ready",
          meta: {
            document_id: "test.pdf",
            document_hash: "h1",
            prompt_version: "1.0.0",
            model: "mistral-large-latest",
            analyzed_at: "2026-01-15T12:00:00.000Z",
          },
          result: analysis,
          diagnostics: null,
        },
      ],
      { model: "mistral-large-latest", analyzedAt: "2026-01-15T12:00:00.000Z" }
    );

    const candidates = res.case_level?.questions.financing.best_supported_candidates || [];
    expect(candidates).toHaveLength(2);
    expect(candidates.map((c) => c.name)).toContain("Arms SK s.r.o.");
    expect(candidates.map((c) => c.name)).toContain("Tajný Investor");
  });
});
