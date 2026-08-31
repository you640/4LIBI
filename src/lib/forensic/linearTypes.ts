export const FORENSIC_EVIDENCE_TYPES = [
  "direct_evidence",
  "testimony",
  "corroborated",
  "inference",
  "hypothesis",
  "contradiction",
] as const;

export type ForensicEvidenceType = (typeof FORENSIC_EVIDENCE_TYPES)[number];

export const WEAPON_ROLES = [
  "orderer",
  "buyer",
  "payer",
  "physical_receiver",
  "transporter",
  "storage_holder",
  "seller",
  "transferor",
  "final_holder",
  "unknown",
] as const;

export type WeaponRole = (typeof WEAPON_ROLES)[number];

export const SOURCE_KINDS = [
  "original_attachment",
  "verified_transcript",
  "working_ocr",
  "forensic_record",
  "derived_index",
] as const;

export type SourceKind = (typeof SOURCE_KINDS)[number];

export const QUESTION_STATUSES = [
  "answered",
  "insufficient_evidence",
  "linear_unavailable",
] as const;

export type QuestionStatus = (typeof QUESTION_STATUSES)[number];

export interface ForensicCitation {
  linear_project_id: string;
  linear_issue_id: string | null;
  linear_document_id: string | null;
  attachment_id: string | null;
  source_group_id?: string | null;
  document_id: string;
  page: number | null;
  quote: string;
  evidence_type: ForensicEvidenceType;
  source_kind: SourceKind;
}

export interface WeaponActor {
  name: string;
  entity: string | null;
  role: WeaponRole;
  found_in_text: boolean;
  inferred: boolean;
  confidence: number;
  evidence: ForensicCitation[];
  contradicting_evidence: ForensicCitation[];
}

export interface ForensicQuestionBase {
  answer: string | null;
  confidence: number;
  status: QuestionStatus;
  evidence: ForensicCitation[];
  missing_evidence: string[];
}

export interface WeaponsFlowQuestion extends ForensicQuestionBase {
  actors: WeaponActor[];
}

export interface PlanAuthorQuestion extends ForensicQuestionBase {
  candidates: WeaponActor[];
  alternative_explanations: string[];
}

export interface FinancingQuestion extends ForensicQuestionBase {
  payers: WeaponActor[];
  funding_sources: string[];
}

export interface ForensicEntity {
  name: string;
  type: string;
  evidence: ForensicCitation[];
}

export interface ForensicTransaction {
  date: string | null;
  amount: string | null;
  payer: string | null;
  payee: string | null;
  reference: string | null;
  evidence: ForensicCitation[];
}

export interface ForensicContradiction {
  summary: string;
  left: ForensicCitation;
  right: ForensicCitation;
}

export interface ForensicDocumentAnalysis {
  document_id: string;
  document_hash: string | null;
  language: "sk" | "cs" | "en" | "other";
  prompt_version: string;
  model: string;
  analyzed_at: string;
  linear_project_id: string;
  questions: {
    weapons_flow: WeaponsFlowQuestion;
    plan_author: PlanAuthorQuestion;
    financing: FinancingQuestion;
  };
  entities: ForensicEntity[];
  transactions: ForensicTransaction[];
  contradictions: ForensicContradiction[];
  warnings: string[];
}

export interface ForensicCaseAnalysis extends ForensicDocumentAnalysis {
  source_count: number;
  admissible_count: number;
  incomplete_sources: string[];
}

export interface LinearSourceMetadata {
  personOrEntity: string | null;
  documentType: string | null;
  documentDate: string | null;
  dateConflict: string | null;
  completeness: string | null;
  hash: string | null;
}

export interface LinearEvidenceSource {
  linear_project_id: string;
  linear_issue_id: string | null;
  linear_document_id: string | null;
  attachment_id: string | null;
  source_group_id: string;
  identifier: string;
  title: string;
  url: string | null;
  source_kind: SourceKind;
  is_framework: boolean;
  admissible: boolean;
  missing_fields: string[];
  metadata: LinearSourceMetadata;
  text: string;
  content_hash: string | null;
  mime: string | null;
  bytes?: ArrayBuffer;
}

export interface LinearCatalog {
  project_id: string;
  project_name: string;
  loaded_at: string;
  sources: LinearEvidenceSource[];
}

export interface LinearStatus {
  configured: boolean;
  reachable: boolean;
  project_id: string;
  project_name: string | null;
  issue_count: number | null;
  document_count: number | null;
  admissible_count: number | null;
  error: string | null;
}
