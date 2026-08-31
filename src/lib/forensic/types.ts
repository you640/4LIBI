import { ALLOWED_LINEAR_PROJECT_ID } from "./sourceOfTruth";

export const FORENSIC_PROMPT_VERSION = "1.0.0";
export const FORENSIC_MODEL_DEFAULT = "mistral-large-latest";

export type ForensicEvidenceType =
  | "direct_evidence"
  | "testimony"
  | "corroborated"
  | "inference"
  | "hypothesis";

export type ForensicQuestionStatus = "sufficient" | "insufficient_evidence";

export type ForensicCaseStatus = "ready" | "partial" | "failed" | "linear_unavailable";

export interface ForensicEvidence {
  document_id: string;
  page: number | null;
  quote: string;
  evidence_type: ForensicEvidenceType;
  linear_project_id: string;
  linear_issue_id: string | null;
  linear_document_id: string | null;
  attachment_id: string | null;
}

export interface ForensicActor {
  name: string;
  entity: string | null;
  role:
    | "orderer"
    | "buyer"
    | "payer"
    | "physical_receiver"
    | "transporter"
    | "storage_holder"
    | "seller"
    | "transferor"
    | "final_holder"
    | "unknown";
  found_in_text: boolean;
  inferred: boolean;
  confidence: number;
  evidence: ForensicEvidence[];
  contradicting_evidence: ForensicEvidence[];
}

export interface PlanAuthorCandidate {
  name: string;
  entity: string | null;
  role: "designer" | "director" | "coordinator" | "unknown";
  found_in_text: boolean;
  inferred: boolean;
  confidence: number;
  evidence: ForensicEvidence[];
  contradicting_evidence: ForensicEvidence[];
}

export interface ForensicPayer {
  name: string;
  entity: string | null;
  role: "invoice_payer" | "funding_source" | "unknown";
  found_in_text: boolean;
  inferred: boolean;
  confidence: number;
  evidence: ForensicEvidence[];
}

export interface ForensicFundingSource {
  name: string;
  entity: string | null;
  origin: string | null;
  distinct_from_invoice_payer: boolean;
  confidence: number;
  evidence: ForensicEvidence[];
}

export interface ForensicEntity {
  name: string;
  type: string;
  identifiers: string[];
  aliases: string[];
}

export interface ForensicTransaction {
  date: string | null;
  amount: string | null;
  currency: string | null;
  invoice_number: string | null;
  license_number: string | null;
  serial_number: string | null;
  payer: string | null;
  payee: string | null;
  purpose: string | null;
  evidence: ForensicEvidence[];
}

export interface ForensicContradiction {
  field: string;
  value_a: string;
  value_b: string;
  source_a: string;
  source_b: string;
  description: string;
}

export interface ForensicDocumentAnalysis {
  document_id: string;
  document_hash: string | null;
  language: "sk" | "cs" | "en" | "other";
  questions: {
    weapons_flow: {
      answer: string | null;
      status: ForensicQuestionStatus;
      actors: ForensicActor[];
      missing_evidence: string[];
    };
    plan_author: {
      answer: string | null;
      status: ForensicQuestionStatus;
      candidates: PlanAuthorCandidate[];
      confidence: number;
      evidence: ForensicEvidence[];
      alternative_explanations: string[];
      missing_evidence: string[];
    };
    financing: {
      answer: string | null;
      status: ForensicQuestionStatus;
      payers: ForensicPayer[];
      funding_sources: ForensicFundingSource[];
      confidence: number;
      evidence: ForensicEvidence[];
      missing_evidence: string[];
    };
  };
  entities: ForensicEntity[];
  transactions: ForensicTransaction[];
  missing_evidence: string[];
  contradicting_evidence: ForensicEvidence[];
  contradictions: ForensicContradiction[];
  warnings: string[];
}

export interface ForensicDiagnostics {
  attempts: number;
  validation_errors: string[];
  raw_response_excerpt: string;
  failed_at: string;
}

export interface ForensicDocumentMeta {
  document_id: string;
  document_hash: string | null;
  prompt_version: string;
  model: string;
  analyzed_at: string;
}

export interface ForensicDocumentRecord {
  status: "ready" | "failed";
  meta: ForensicDocumentMeta;
  result: ForensicDocumentAnalysis | null;
  diagnostics: ForensicDiagnostics | null;
}

export interface ForensicCaseResult {
  status: ForensicCaseStatus;
  prompt_version: string;
  model: string;
  analyzed_at: string;
  documents: ForensicDocumentRecord[];
  case_level: ForensicDocumentAnalysis | null;
  diagnostics: ForensicDiagnostics | null;
}

export function emptyEvidenceQuote(quote = "", documentId = "case"): ForensicEvidence {
  return {
    document_id: documentId,
    page: null,
    quote,
    evidence_type: "hypothesis",
    linear_project_id: ALLOWED_LINEAR_PROJECT_ID,
    linear_issue_id: null,
    linear_document_id: null,
    attachment_id: null,
  };
}

export function emptyForensicDocumentAnalysis(
  documentId: string,
  documentHash: string | null = null
): ForensicDocumentAnalysis {
  return {
    document_id: documentId,
    document_hash: documentHash,
    language: "sk",
    questions: {
      weapons_flow: {
        answer: null,
        status: "insufficient_evidence",
        actors: [],
        missing_evidence: [],
      },
      plan_author: {
        answer: null,
        status: "insufficient_evidence",
        candidates: [],
        confidence: 0,
        evidence: [],
        alternative_explanations: [],
        missing_evidence: [],
      },
      financing: {
        answer: null,
        status: "insufficient_evidence",
        payers: [],
        funding_sources: [],
        confidence: 0,
        evidence: [],
        missing_evidence: [],
      },
    },
    entities: [],
    transactions: [],
    missing_evidence: [],
    contradicting_evidence: [],
    contradictions: [],
    warnings: [],
  };
}

export function linearUnavailableForensicResult(reason: string): ForensicCaseResult {
  const analyzedAt = new Date().toISOString();
  const caseLevel = emptyForensicDocumentAnalysis("case", null);
  const missing = [
    "Linear projekt sa nepodarilo načítať. Analýza troch vyšetrovacích otázok je zastavená.",
    reason,
  ];
  caseLevel.missing_evidence = missing;
  caseLevel.questions.weapons_flow.missing_evidence = missing;
  caseLevel.questions.plan_author.missing_evidence = missing;
  caseLevel.questions.financing.missing_evidence = missing;
  caseLevel.warnings = [missing[0]];
  return {
    status: "linear_unavailable",
    prompt_version: FORENSIC_PROMPT_VERSION,
    model: "none",
    analyzed_at: analyzedAt,
    documents: [],
    case_level: caseLevel,
    diagnostics: {
      attempts: 0,
      validation_errors: missing,
      raw_response_excerpt: "",
      failed_at: analyzedAt,
    },
  };
}
