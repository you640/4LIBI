import type {
  ForensicDocumentAnalysis,
  ForensicEvidence,
  ForensicCaseResult,
} from "../../src/lib/forensic/types";
import { emptyForensicDocumentAnalysis } from "../../src/lib/forensic/types";

export function ev(partial: Partial<ForensicEvidence> & { quote: string }): ForensicEvidence {
  return {
    document_id: partial.document_id ?? "1-faktura.pdf",
    page: partial.page === undefined ? 2 : partial.page,
    quote: partial.quote,
    evidence_type: partial.evidence_type ?? "direct_evidence",
    linear_project_id:
      partial.linear_project_id ?? "cf930d36-765a-4e6f-b170-2d8a2da83f0b",
    linear_issue_id: partial.linear_issue_id ?? "issue-test",
    linear_document_id: partial.linear_document_id ?? null,
    attachment_id: partial.attachment_id ?? null,
    ...(partial.source_group_id !== undefined
      ? { source_group_id: partial.source_group_id }
      : {}),
  };
}

export function validForensicAnalysis(
  overrides: Partial<ForensicDocumentAnalysis> = {}
): ForensicDocumentAnalysis {
  const base = emptyForensicDocumentAnalysis("1-faktura.pdf", "abc123");
  base.language = "sk";
  return {
    ...base,
    ...overrides,
    questions: {
      ...base.questions,
      ...(overrides.questions || {}),
    },
  };
}

export function directWeaponsAnalysis(quote: string): ForensicDocumentAnalysis {
  return validForensicAnalysis({
    questions: {
      weapons_flow: {
        answer:
          "Ján Novák objednal zbrane, zaplatil faktúru FA-2023-441 a fyzicky ich prevzal.",
        actors: [
          {
            name: "Ján Novák",
            entity: null,
            role: "orderer",
            found_in_text: true,
            inferred: false,
            confidence: 0.9,
            evidence: [ev({ quote, evidence_type: "direct_evidence", page: 2 })],
            contradicting_evidence: [],
          },
          {
            name: "Ján Novák",
            entity: null,
            role: "physical_receiver",
            found_in_text: true,
            inferred: false,
            confidence: 0.9,
            evidence: [ev({ quote, evidence_type: "direct_evidence", page: 2 })],
            contradicting_evidence: [],
          },
        ],
        missing_evidence: [],
      },
      plan_author: emptyForensicDocumentAnalysis("x").questions.plan_author,
      financing: emptyForensicDocumentAnalysis("x").questions.financing,
    },
  });
}

export function forensicCaseFromAnalysis(
  analysis: ForensicDocumentAnalysis,
  status: ForensicCaseResult["status"] = "ready"
): ForensicCaseResult {
  return {
    status,
    prompt_version: "1.0.0",
    model: "mistral-large-latest",
    analyzed_at: "2026-01-15T12:00:00.000Z",
    documents: [
      {
        status: "ready",
        meta: {
          document_id: analysis.document_id,
          document_hash: analysis.document_hash,
          prompt_version: "1.0.0",
          model: "mistral-large-latest",
          analyzed_at: "2026-01-15T12:00:00.000Z",
        },
        result: analysis,
        diagnostics: null,
      },
    ],
    case_level: analysis,
    diagnostics: null,
  };
}
