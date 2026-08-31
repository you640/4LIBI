// === Sherlock AI & ForenzDetectiv — kompletné typy ===

export interface AnalysisMetadata {
  document_name: string;
  language: "sk" | "cs" | "en";
  page_count: number | null;
  upload_date: string;
}

export type PersonRole =
  | "obvinený"
  | "podozrivý"
  | "svedok"
  | "obete"
  | "obeť"
  | "alibi"
  | "policajt"
  | "advokat"
  | "sudca"
  | "ine";

export type PersonType = 'podozrivý' | 'svedok' | 'obeť' | 'alibi';

export interface Person {
  id: string;
  name: string;
  role: string;
  type?: PersonType;
  description: string | null;
  details?: string;
  aliases?: string[];
  document_id?: string;
  document_title?: string;
  pageRankScore?: number;
  degree?: number;
  isKeyHub?: boolean;
  nodeRadius?: number;
}

export type EvidenceType =
  | "document"
  | "photo"
  | "video"
  | "testimony"
  | "audio"
  | "other";

export interface Evidence {
  id: string;
  type: EvidenceType;
  content: string;
  source: string;
  relevance_score: number; // 1-10
}

export interface Relationship {
  person1_id: string;
  person2_id: string;
  type: string;
  description: string;
  evidence_supporting: string[];
  page?: number;
}

export interface TimelineEvent {
  id: string;
  timestamp: string | null; // ISO 8601 alebo null
  title: string;
  description: string;
  location: string | null;
  persons_involved: string[];
  evidence_links: string[];
  tags: string[];
  source_text: string;
  confidence: number; // 0-1
  approximate: boolean;
  page?: number;
}

export type ContradictionType =
  | 'time_conflict'
  | 'location_conflict'
  | 'location_time_conflict'
  | 'factual_conflict'
  | 'identity_conflict'
  | 'event_participation_conflict';

export type Severity = 'critical' | 'high' | 'medium' | 'low';
export type ContradictionStatus = 'possible' | 'confirmed' | 'dismissed';

export interface ForensicClaim {
  id: string;
  document_id?: string;
  document_title?: string;
  subject: string;
  predicate: string;
  object: string;
  event_date?: string;
  event_time?: string;
  approximate_time?: boolean;
  time_start?: string;
  time_end?: string;
  location?: string;
  confidence: number;
  source_quote?: string;
}

export interface Contradiction {
  id: string;
  case_id?: string;
  title?: string;
  claim_a_id?: string;
  claim_b_id?: string;
  document_a_id?: string;
  document_b_id?: string;
  entity_ref?: string;
  type?: ContradictionType | string;
  contradiction_type?: ContradictionType | string;
  severity: Severity;
  confidence?: number;
  explanation?: string;
  status?: ContradictionStatus;
  document_id?: string;
  document_title?: string;
  page?: number;
}

export interface GeoLocation {
  lat: number;
  lng: number;
}

export interface TravelFeasibilityResult {
  isFeasible: boolean;
  distanceKm: number;
  travelMinutesAvailable: number;
  minTravelMinutesRequired: number;
  requiredSpeedKmh: number;
  severity: 'normal' | 'high' | 'critical';
  explanation: string;
  locationA: string;
  locationB: string;
}

export interface CrossExamQuestion {
  id: string;
  question: string;
  rationale: string;
  targetPerson: string;
  contradictionRef?: string;
  citation: {
    documentTitle: string;
    passage: string;
    page?: number | null;
    line?: number | null;
  };
  suggestedFollowUps: string[];
}

export interface ForenzDocument {
  id: string;
  title: string;
  file_name?: string;
  image_url?: string;
  status: 'pending' | 'analyzing' | 'done' | 'error';
  error?: string;
  summary?: string;
  person_count: number;
  relationship_count: number;
  red_flag_count: number;
  claims?: ForensicClaim[];
  created_at?: string;
  updated_at?: string;
}

export interface Analysis {
  metadata: AnalysisMetadata;
  persons: Person[];
  evidence: Evidence[];
  relationships: Relationship[];
  timeline: TimelineEvent[];
  claims?: ForensicClaim[];
  contradictions?: Contradiction[];
  red_flags?: string[];
  forensic?: import("./lib/forensic/types").ForensicCaseResult;
}
