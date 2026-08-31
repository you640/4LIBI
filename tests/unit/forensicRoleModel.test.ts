import { describe, expect, it } from "vitest";
import {
  aggregateForensicDocuments,
  independentEvidence,
} from "../../src/lib/forensic/forensicAggregate";
import {
  emptyForensicDocumentAnalysis,
  makeEntityId,
  type ForensicDocumentAnalysis,
  type ForensicDocumentRecord,
} from "../../src/lib/forensic/types";
import { FORENSIC_JSON_SCHEMA } from "../../src/lib/forensic/forensicSchema";
import { validateJsonSchema } from "../../src/lib/forensic/validateForensic";
import { ev } from "../fixtures/forensic";

function record(analysis: ForensicDocumentAnalysis): ForensicDocumentRecord {
  return {
    status: "ready",
    meta: {
      document_id: analysis.document_id,
      document_hash: analysis.document_hash,
      prompt_version: "2.0.0",
      model: "m",
      analyzed_at: "t",
    },
    result: analysis,
    diagnostics: null,
  };
}

describe("forensic role and entity model", () => {
  it("oddeľuje entity_id osoby od entity_id firmy", () => {
    const personId = makeEntityId("person", "Ján Novák");
    const companyId = makeEntityId("company", "Ján Novák s.r.o.");
    expect(personId.startsWith("person:")).toBe(true);
    expect(companyId.startsWith("company:")).toBe(true);
    expect(personId).not.toBe(companyId);

    const analysis = emptyForensicDocumentAnalysis("1");
    analysis.entities = [
      { entity_id: personId, name: "Ján Novák", type: "person", identifiers: [], aliases: [] },
      {
        entity_id: companyId,
        name: "Ján Novák s.r.o.",
        type: "company",
        identifiers: [],
        aliases: [],
      },
    ];
    const merged = aggregateForensicDocuments([record(analysis)], {
      model: "m",
      analyzedAt: "t",
    });
    expect(merged.case_level?.entities).toHaveLength(2);
    expect(merged.case_level?.entities.map((e) => e.entity_id).sort()).toEqual(
      [companyId, personId].sort()
    );
  });

  it("zachová buyer_entity, invoice_payer, cash_payer, account_holder, funding_source, intermediary, physical_receiver, alleged_next_recipient", () => {
    const company = makeEntityId("company", "Arms SK s.r.o.");
    const person = makeEntityId("person", "Ján Novák");
    const funder = makeEntityId("person", "Neznámy sponzor");
    const next = makeEntityId("person", "Ďalší príjemca");
    const analysis = emptyForensicDocumentAnalysis("1");
    analysis.questions.weapons_flow.actors = [
      {
        entity_id: company,
        entity_kind: "company",
        name: "Arms SK s.r.o.",
        entity: "Arms SK s.r.o.",
        role: "buyer_entity",
        found_in_text: true,
        inferred: false,
        confidence: 0.8,
        evidence: [ev({ quote: "Odberateľ Arms SK s.r.o." })],
        contradicting_evidence: [],
      },
      {
        entity_id: person,
        entity_kind: "person",
        name: "Ján Novák",
        entity: "Arms SK s.r.o.",
        role: "physical_receiver",
        found_in_text: true,
        inferred: false,
        confidence: 0.8,
        evidence: [ev({ quote: "Zbrane prevzal Ján Novák" })],
        contradicting_evidence: [],
      },
      {
        entity_id: next,
        entity_kind: "person",
        name: "Ďalší príjemca",
        entity: null,
        role: "alleged_next_recipient",
        found_in_text: true,
        inferred: true,
        confidence: 0.3,
        evidence: [ev({ quote: "mal ich odovzdať ďalšiemu", evidence_type: "testimony" })],
        contradicting_evidence: [],
      },
    ];
    analysis.questions.financing.payers = [
      {
        entity_id: company,
        entity_kind: "company",
        name: "Arms SK s.r.o.",
        entity: "Arms SK s.r.o.",
        role: "invoice_payer",
        found_in_text: true,
        inferred: false,
        confidence: 0.7,
        evidence: [ev({ quote: "faktúru uhradila Arms SK" })],
      },
      {
        entity_id: person,
        entity_kind: "person",
        name: "Ján Novák",
        entity: null,
        role: "cash_payer",
        found_in_text: true,
        inferred: false,
        confidence: 0.4,
        evidence: [ev({ quote: "platba v hotovosti", evidence_type: "testimony" })],
      },
      {
        entity_id: company,
        entity_kind: "company",
        name: "Arms SK s.r.o.",
        entity: "Arms SK s.r.o.",
        role: "account_holder",
        found_in_text: true,
        inferred: false,
        confidence: 0.5,
        evidence: [ev({ quote: "účet vedený na Arms SK" })],
      },
      {
        entity_id: person,
        entity_kind: "person",
        name: "Sprostredkovateľ",
        entity: null,
        role: "intermediary",
        found_in_text: true,
        inferred: true,
        confidence: 0.2,
        evidence: [ev({ quote: "peniaze šli cez sprostredkovateľa", evidence_type: "hypothesis" })],
      },
    ];
    analysis.questions.financing.funding_sources = [
      {
        entity_id: funder,
        entity_kind: "person",
        name: "Neznámy sponzor",
        entity: null,
        origin: "hotovosť",
        distinct_from_invoice_payer: true,
        confidence: 0.2,
        evidence: [ev({ quote: "zdroj peňazí nie je doložený", evidence_type: "hypothesis" })],
      },
    ];
    analysis.transaction_edges = [
      {
        edge_id: "e1",
        from_entity_id: funder,
        to_entity_id: company,
        role: "funding_source",
        date: null,
        amount: null,
        currency: "EUR",
        instrument: "cash",
        evidence: [ev({ quote: "tok peňazí", evidence_type: "hypothesis" })],
      },
      {
        edge_id: "e2",
        from_entity_id: company,
        to_entity_id: person,
        role: "physical_receiver",
        date: "12.03.2023",
        amount: null,
        currency: null,
        instrument: "invoice",
        evidence: [ev({ quote: "prevzatie zbraní" })],
      },
    ];

    const merged = aggregateForensicDocuments([record(analysis)], {
      model: "m",
      analyzedAt: "t",
    });
    const roles = merged.case_level!.questions.weapons_flow.actors.map((a) => a.role);
    expect(roles).toEqual(
      expect.arrayContaining(["buyer_entity", "physical_receiver", "alleged_next_recipient"])
    );
    const payerRoles = merged.case_level!.questions.financing.payers.map((p) => p.role);
    expect(payerRoles).toEqual(
      expect.arrayContaining(["invoice_payer", "cash_payer", "account_holder", "intermediary"])
    );
    expect(merged.case_level!.questions.financing.funding_sources[0].distinct_from_invoice_payer).toBe(
      true
    );
    expect(merged.case_level!.transaction_edges).toHaveLength(2);
    expect(merged.case_level!.questions.weapons_flow.confirmed_answer !== undefined).toBe(true);
    expect(merged.case_level!.questions.weapons_flow.best_supported_candidates!.length).toBeGreaterThan(
      0
    );
    expect(merged.case_level!.questions.financing.missing_confirmation!.length).toBeGreaterThan(0);
  });

  it("source_group deduplikácia zabráni falošnému corroboration", () => {
    const group = "issue-plch";
    const a = ev({
      quote: "prevzal zbrane",
      source_group_id: group,
      linear_issue_id: group,
      attachment_id: "orig",
    });
    const b = ev({
      quote: "ocr prevzal zbrane",
      source_group_id: group,
      linear_issue_id: group,
      attachment_id: "ocr",
    });
    expect(independentEvidence([a, b])).toHaveLength(1);
  });

  it("schéma obsahuje nové polia", () => {
    const empty = emptyForensicDocumentAnalysis("schema-check");
    empty.questions.weapons_flow.confirmed_answer = null;
    empty.questions.weapons_flow.best_supported_candidates = [];
    empty.questions.weapons_flow.missing_confirmation = [];
    empty.transaction_edges = [];
    expect(validateJsonSchema(empty, FORENSIC_JSON_SCHEMA)).toEqual([]);
    const schema = FORENSIC_JSON_SCHEMA as {
      properties: Record<string, { properties?: Record<string, unknown> }>;
    };
    const wf = (schema.properties.questions as { properties: Record<string, { properties: Record<string, unknown> }> })
      .properties.weapons_flow.properties;
    expect(wf.confirmed_answer).toBeTruthy();
    expect(wf.best_supported_candidates).toBeTruthy();
    expect(wf.missing_confirmation).toBeTruthy();
    expect(schema.properties.transaction_edges).toBeTruthy();
  });

  it("1. mergePayers nepoužíva normName a oddeľuje osobu a firmu s rovnakým menom podľa entity_id + role", () => {
    const analysis = emptyForensicDocumentAnalysis("p1");
    analysis.questions.financing.payers = [
      {
        entity_id: "person:marek-plch",
        entity_kind: "person",
        name: "Marek Plch",
        entity: null,
        role: "cash_payer",
        found_in_text: true,
        inferred: false,
        confidence: 0.6,
        evidence: [ev({ quote: "Marek Plch platil v hotovosti", evidence_type: "testimony" })],
      },
      {
        entity_id: "company:marek-plch",
        entity_kind: "company",
        name: "Marek Plch",
        entity: "Marek Plch",
        role: "invoice_payer",
        found_in_text: true,
        inferred: false,
        confidence: 0.8,
        evidence: [ev({ quote: "Fakturované na Marek Plch", evidence_type: "direct_evidence" })],
      },
    ];

    const merged = aggregateForensicDocuments([record(analysis)], { model: "m", analyzedAt: "t" });
    const payers = merged.case_level!.questions.financing.payers;
    expect(payers).toHaveLength(2);
    expect(payers.map((p) => p.entity_id).sort()).toEqual(["company:marek-plch", "person:marek-plch"]);
  });

  it("2. mergeFundingSources kľúčuje podľa entity_id a nezlúči rôzne entity", () => {
    const analysis = emptyForensicDocumentAnalysis("f1");
    analysis.questions.financing.funding_sources = [
      {
        entity_id: "person:tatragen",
        entity_kind: "person",
        name: "Tatragen",
        entity: null,
        origin: "osobný vklad",
        distinct_from_invoice_payer: true,
        confidence: 0.5,
        evidence: [ev({ quote: "vklad od Tatragen" })],
      },
      {
        entity_id: "company:tatragen",
        entity_kind: "company",
        name: "Tatragen s.r.o.",
        entity: "Tatragen s.r.o.",
        origin: "firemný účet",
        distinct_from_invoice_payer: true,
        confidence: 0.9,
        evidence: [ev({ quote: "účet Tatragen s.r.o." })],
      },
    ];

    const merged = aggregateForensicDocuments([record(analysis)], { model: "m", analyzedAt: "t" });
    const sources = merged.case_level!.questions.financing.funding_sources;
    expect(sources).toHaveLength(2);
    expect(sources.map((s) => s.entity_id).sort()).toEqual(["company:tatragen", "person:tatragen"]);
  });

  it("3. mergeActors najprv určí entity_kind a buyer_entity dostane company: prefix", () => {
    const analysis = emptyForensicDocumentAnalysis("a1");
    analysis.questions.weapons_flow.actors = [
      {
        entity_id: "person:arms-sk", // model poslal zlý prefix
        entity_kind: "person",
        name: "Arms SK",
        entity: null,
        role: "buyer_entity",
        found_in_text: true,
        inferred: false,
        confidence: 0.8,
        evidence: [ev({ quote: "kupujúci Arms SK" })],
        contradicting_evidence: [],
      },
    ];

    const merged = aggregateForensicDocuments([record(analysis)], { model: "m", analyzedAt: "t" });
    const actor = merged.case_level!.questions.weapons_flow.actors[0];
    expect(actor.entity_kind).toBe("company");
    expect(actor.entity_id).toBe("company:arms-sk");
  });

  it("4. entityKey nikdy slepo nevracia surové entityId a opraví prefix podľa kind", () => {
    expect(makeEntityId("company", "Marek Plch")).toBe("company:marek-plch");
    expect(makeEntityId("person", "Arms SK s.r.o.")).toBe("person:arms-sk-s-r-o");
  });

  it("5. pickAnswer / pickConfirmedAnswer: hypothesis nikdy nepotvrdí answer", () => {
    const analysis = emptyForensicDocumentAnalysis("h1");
    analysis.questions.plan_author.answer = "Vinny Jan";
    analysis.questions.plan_author.candidates = [
      {
        entity_id: "person:vinny-jan",
        entity_kind: "person",
        name: "Vinny Jan",
        entity: null,
        role: "coordinator",
        found_in_text: true,
        inferred: true,
        confidence: 0.2,
        evidence: [ev({ quote: "mohol to byť Vinny Jan", evidence_type: "hypothesis" })],
        contradicting_evidence: [],
      },
    ];

    const merged = aggregateForensicDocuments([record(analysis)], { model: "m", analyzedAt: "t" });
    expect(merged.case_level!.questions.plan_author.confirmed_answer).toBeNull();
    expect(merged.case_level!.questions.plan_author.status).toBe("insufficient_evidence");
  });

  it("6. pickAnswer / pickConfirmedAnswer: inference nikdy nepotvrdí answer", () => {
    const analysis = emptyForensicDocumentAnalysis("i1");
    analysis.questions.weapons_flow.answer = "Dmitrij Marjov";
    analysis.questions.weapons_flow.actors = [
      {
        entity_id: "person:dmitrij-marjov",
        entity_kind: "person",
        name: "Dmitrij Marjov",
        entity: null,
        role: "physical_receiver",
        found_in_text: true,
        inferred: true,
        confidence: 0.35,
        evidence: [ev({ quote: "z kontextu vyplýva Marjov", evidence_type: "inference" })],
        contradicting_evidence: [],
      },
    ];

    const merged = aggregateForensicDocuments([record(analysis)], { model: "m", analyzedAt: "t" });
    expect(merged.case_level!.questions.weapons_flow.confirmed_answer).toBeNull();
    expect(merged.case_level!.questions.weapons_flow.status).toBe("insufficient_evidence");
  });

  it("7. pickAnswer: jedna výpoveď (testimony) z 1 source_group nestačí na potvrdenie", () => {
    const analysis = emptyForensicDocumentAnalysis("t1");
    analysis.questions.financing.answer = "Michal Žember";
    analysis.questions.financing.payers = [
      {
        entity_id: "person:michal-zember",
        entity_kind: "person",
        name: "Michal Žember",
        entity: null,
        role: "cash_payer",
        found_in_text: true,
        inferred: false,
        confidence: 0.55,
        evidence: [
          ev({
            quote: "videl som Žembera platiť",
            evidence_type: "testimony",
            source_group_id: "group-1",
          }),
        ],
      },
    ];

    const merged = aggregateForensicDocuments([record(analysis)], { model: "m", analyzedAt: "t" });
    expect(merged.case_level!.questions.financing.confirmed_answer).toBeNull();
    expect(merged.case_level!.questions.financing.status).toBe("insufficient_evidence");
  });

  it("8. pickAnswer: dve nezávislé výpovede z rôznych source_group potvrdia odpoveď", () => {
    const doc1 = emptyForensicDocumentAnalysis("t1");
    doc1.questions.plan_author.answer = "Marek Plch";
    doc1.questions.plan_author.candidates = [
      {
        entity_id: "person:marek-plch",
        entity_kind: "person",
        name: "Marek Plch",
        entity: null,
        role: "director",
        found_in_text: true,
        inferred: false,
        confidence: 0.7,
        evidence: [
          ev({
            quote: "Plch riadil celú akciu",
            evidence_type: "testimony",
            source_group_id: "group-witness-1",
            document_id: "doc1.pdf",
          }),
        ],
        contradicting_evidence: [],
      },
    ];

    const doc2 = emptyForensicDocumentAnalysis("t2");
    doc2.questions.plan_author.answer = "Marek Plch";
    doc2.questions.plan_author.candidates = [
      {
        entity_id: "person:marek-plch",
        entity_kind: "person",
        name: "Marek Plch",
        entity: null,
        role: "director",
        found_in_text: true,
        inferred: false,
        confidence: 0.7,
        evidence: [
          ev({
            quote: "Plch bol organizátor",
            evidence_type: "corroborated",
            source_group_id: "group-witness-2",
            document_id: "doc2.pdf",
          }),
        ],
        contradicting_evidence: [],
      },
    ];

    const merged = aggregateForensicDocuments([record(doc1), record(doc2)], { model: "m", analyzedAt: "t" });
    expect(merged.case_level!.questions.plan_author.confirmed_answer).toBe("Marek Plch");
    expect(merged.case_level!.questions.plan_author.status).toBe("sufficient");
  });

  it("9. validateForensic zahodí transakčnú hranu bez evidencie alebo s prázdnou citáciou", () => {
    const analysis = emptyForensicDocumentAnalysis("edge-empty");
    analysis.entities = [
      { entity_id: "company:a", name: "A s.r.o.", type: "company", identifiers: [], aliases: [] },
      { entity_id: "person:b", name: "B", type: "person", identifiers: [], aliases: [] },
    ];
    analysis.transaction_edges = [
      {
        edge_id: "e1",
        from_entity_id: "company:a",
        to_entity_id: "person:b",
        role: "payer",
        date: null,
        amount: null,
        currency: null,
        instrument: "cash",
        evidence: [], // no evidence
      },
      {
        edge_id: "e2",
        from_entity_id: "company:a",
        to_entity_id: "person:b",
        role: "payer",
        date: null,
        amount: null,
        currency: null,
        instrument: "cash",
        evidence: [ev({ quote: "   " })], // empty quote
      },
    ];

    const merged = aggregateForensicDocuments([record(analysis)], { model: "m", analyzedAt: "t" });
    expect(merged.case_level!.transaction_edges).toHaveLength(0);
  });

  it("10. validateForensic zahodí hranu s neexistujúcou entitou alebo self-edge", () => {
    const analysis = emptyForensicDocumentAnalysis("edge-unknown");
    analysis.entities = [
      { entity_id: "company:a", name: "A s.r.o.", type: "company", identifiers: [], aliases: [] },
    ];
    analysis.transaction_edges = [
      {
        edge_id: "e1",
        from_entity_id: "company:a",
        to_entity_id: "person:non-existent",
        role: "payer",
        date: null,
        amount: null,
        currency: null,
        instrument: "cash",
        evidence: [ev({ quote: "platba pre neznámeho" })],
      },
      {
        edge_id: "e2",
        from_entity_id: "company:a",
        to_entity_id: "company:a", // self-edge
        role: "payer",
        date: null,
        amount: null,
        currency: null,
        instrument: "cash",
        evidence: [ev({ quote: "platba sebe" })],
      },
    ];

    const merged = aggregateForensicDocuments([record(analysis)], { model: "m", analyzedAt: "t" });
    expect(merged.case_level!.transaction_edges).toHaveLength(0);
  });

  it("11. financing best_supported_candidates obsahuje payers aj funding_sources", () => {
    const analysis = emptyForensicDocumentAnalysis("fin-cand");
    analysis.questions.financing.payers = [
      {
        entity_id: "company:arms-sk",
        entity_kind: "company",
        name: "Arms SK s.r.o.",
        entity: "Arms SK s.r.o.",
        role: "invoice_payer",
        found_in_text: true,
        inferred: false,
        confidence: 0.8,
        evidence: [ev({ quote: "faktúra zaplatená Arms SK" })],
      },
    ];
    analysis.questions.financing.funding_sources = [
      {
        entity_id: "person:sponzor",
        entity_kind: "person",
        name: "Tajný sponzor",
        entity: null,
        origin: "hotovosť",
        distinct_from_invoice_payer: true,
        confidence: 0.7,
        evidence: [ev({ quote: "hotovosť od sponzora" })],
      },
    ];

    const merged = aggregateForensicDocuments([record(analysis)], { model: "m", analyzedAt: "t" });
    const candidates = merged.case_level!.questions.financing.best_supported_candidates;
    expect(candidates).toHaveLength(2);
    expect(candidates.some((c) => c.entity_id === "company:arms-sk")).toBe(true);
    expect(candidates.some((c) => c.entity_id === "person:sponzor")).toBe(true);
  });
});
