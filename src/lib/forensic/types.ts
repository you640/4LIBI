import { ALLOWED_LINEAR_PROJECT_ID } from "./sourceOfTruth";

export const FORENSIC_PROMPT_VERSION = "2.0.0";
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
  source_group_id?: string | null;
}

export type ForensicEntityKind = "person" | "company" | "other";

export type ForensicRole =
  | "orderer"
  | "buyer"
  | "buyer_entity"
  | "payer"
  | "invoice_payer"
  | "cash_payer"
  | "account_holder"
  | "funding_source"
  | "intermediary"
  | "physical_receiver"
  | "alleged_next_recipient"
  | "transporter"
  | "storage_holder"
  | "seller"
  | "transferor"
  | "final_holder"
  | "designer"
  | "director"
  | "coordinator"
  | "unknown";

export const COMPANY_INDICATORS = [
  "s.r.o.",
  "s. r. o.",
  "spol. s r.o.",
  "a.s.",
  "a. s.",
  "ltd",
  "inc",
  "corp",
  "gmbh",
  "d.o.o.",
  "enterprise",
  "factory",
  "tatragen",
  "petris",
  "tavira",
  "eb-eu",
  "bark factory",
  "magika",
  "remeta",
] as const;

export function inferEntityKind(
  role?: string | null,
  name?: string | null,
  explicitKind?: ForensicEntityKind | string | null
): ForensicEntityKind {
  if (role === "buyer_entity") return "company";
  if (explicitKind === "company" || explicitKind === "person" || explicitKind === "other") {
    return explicitKind;
  }
  const n = (name || "").toLowerCase();
  for (const ind of COMPANY_INDICATORS) {
    if (n.includes(ind)) return "company";
  }
  if (role === "physical_receiver" || role === "cash_payer") {
    return "person";
  }
  return "person";
}

export function entityKey(
  kind: ForensicEntityKind,
  name: string,
  entityId?: string | null
): string {
  return normalizeEntityId(kind, name, entityId);
}

export function makeEntityId(kind: ForensicEntityKind, name: string): string {
  const slug = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${kind}:${slug || "unknown"}`;
}

export function normalizeEntityId(
  kind: ForensicEntityKind,
  name: string,
  rawEntityId?: string | null
): string {
  const trimmed = (name || "").trim();
  if (!trimmed) {
    return `${kind}:unknown`;
  }
  const slug = trimmed
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  const expectedPrefix = `${kind}:`;
  if (rawEntityId && rawEntityId.startsWith(expectedPrefix) && rawEntityId.length > expectedPrefix.length) {
    return rawEntityId;
  }
  return `${kind}:${slug || "unknown"}`;
}

export interface ForensicActor {
  entity_id: string;
  name: string;
  entity: string | null;
  entity_kind: ForensicEntityKind;
  role: ForensicRole;
  found_in_text: boolean;
  inferred: boolean;
  confidence: number;
  evidence: ForensicEvidence[];
  contradicting_evidence: ForensicEvidence[];
}

export interface PlanAuthorCandidate {
  entity_id: string;
  name: string;
  entity: string | null;
  entity_kind: ForensicEntityKind;
  role: "designer" | "director" | "coordinator" | "unknown";
  found_in_text: boolean;
  inferred: boolean;
  confidence: number;
  evidence: ForensicEvidence[];
  contradicting_evidence: ForensicEvidence[];
}

export interface ForensicPayer {
  entity_id: string;
  name: string;
  entity: string | null;
  entity_kind: ForensicEntityKind;
  role: "invoice_payer" | "cash_payer" | "account_holder" | "funding_source" | "intermediary" | "unknown";
  found_in_text: boolean;
  inferred: boolean;
  confidence: number;
  evidence: ForensicEvidence[];
}

export interface ForensicFundingSource {
  entity_id: string;
  name: string;
  entity: string | null;
  entity_kind: ForensicEntityKind;
  origin: string | null;
  distinct_from_invoice_payer: boolean;
  confidence: number;
  evidence: ForensicEvidence[];
}

export interface ForensicEntity {
  entity_id: string;
  name: string;
  type: ForensicEntityKind | string;
  identifiers: string[];
  aliases: string[];
}

export interface ForensicTransactionEdge {
  edge_id: string;
  from_entity_id: string;
  to_entity_id: string;
  role: ForensicRole;
  date: string | null;
  amount: string | null;
  currency: string | null;
  instrument: "invoice" | "cash" | "account" | "unknown" | null;
  evidence: ForensicEvidence[];
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
      confirmed_answer: string | null;
      best_supported_candidates: ForensicActor[];
      missing_confirmation: string[];
      status: ForensicQuestionStatus;
      actors: ForensicActor[];
      missing_evidence: string[];
    };
    plan_author: {
      answer: string | null;
      confirmed_answer: string | null;
      best_supported_candidates: PlanAuthorCandidate[];
      missing_confirmation: string[];
      status: ForensicQuestionStatus;
      candidates: PlanAuthorCandidate[];
      confidence: number;
      evidence: ForensicEvidence[];
      alternative_explanations: string[];
      missing_evidence: string[];
    };
    financing: {
      answer: string | null;
      confirmed_answer: string | null;
      best_supported_candidates: Array<ForensicPayer | (ForensicFundingSource & { role?: string })>;
      missing_confirmation: string[];
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
  transaction_edges: ForensicTransactionEdge[];
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
        confirmed_answer: null,
        best_supported_candidates: [],
        missing_confirmation: [],
        status: "insufficient_evidence",
        actors: [],
        missing_evidence: [],
      },
      plan_author: {
        answer: null,
        confirmed_answer: null,
        best_supported_candidates: [],
        missing_confirmation: [],
        status: "insufficient_evidence",
        candidates: [],
        confidence: 0,
        evidence: [],
        alternative_explanations: [],
        missing_evidence: [],
      },
      financing: {
        answer: null,
        confirmed_answer: null,
        best_supported_candidates: [],
        missing_confirmation: [],
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
    transaction_edges: [],
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
