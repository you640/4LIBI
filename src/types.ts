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
}

// Demo dáta (BA-KE alibi) pre aha moment
export const DEMO_ANALYSIS: Analysis = {
  metadata: {
    document_name: "Vyšetrovací spis č. 123/2023 — BA-KE alibi",
    language: "sk",
    page_count: 3,
    upload_date: "2023-05-16T10:00:00Z",
  },
  persons: [
    {
      id: "P001",
      name: "Ján Novák",
      role: "obvinený",
      type: "podozrivý",
      description: "Nar. 1985, obvinený z krádeže v banke. Tvrdí, že bol v Košiciach.",
    },
    {
      id: "P002",
      name: "Petra Svobodová",
      role: "svedkyňa",
      type: "svedok",
      description: "Pokladníčka v banke. Videla obvineného odchádzať.",
    },
    {
      id: "P003",
      name: "Marek Horváth",
      role: "svedok",
      type: "alibi",
      description: "Kolega obvineného. Potvrdzuje alibi — boli spolu v Košiciach.",
    },
  ],
  evidence: [
    {
      id: "E001",
      type: "video",
      content: "Kamerový záznam: obvinený v banke od 14:25 do 14:35",
      source: "Kamera banky, str. 1",
      relevance_score: 10,
    },
    {
      id: "E002",
      type: "testimony",
      content: "Výpoveď: 'Videla som ho odchádzať z banky o 15:00.'",
      source: "Petra Svobodová, str. 2",
      relevance_score: 9,
    },
    {
      id: "E003",
      type: "testimony",
      content: "Výpoveď: 'S Jánom sme boli v Košiciach celý deň, od 8:00 do 20:00.'",
      source: "Marek Horváth, str. 3",
      relevance_score: 8,
    },
    {
      id: "E004",
      type: "document",
      content: "Mýtny lístok na diaľnici D1, smer Bratislava → Košice, čas 13:40",
      source: "Národná diaľničná spoločnosť, str. 3",
      relevance_score: 7,
    },
  ],
  relationships: [
    {
      person1_id: "P001",
      person2_id: "P002",
      type: "videla",
      description: "Petra Svobodová videla Jána Nováka odchádzať z banky",
      evidence_supporting: ["E002"],
    },
    {
      person1_id: "P001",
      person2_id: "P003",
      type: "kolega",
      description: "Spolupracovali, Marek potvrdzuje alibi",
      evidence_supporting: ["E003"],
    },
  ],
  timeline: [
    {
      id: "T001",
      timestamp: "2023-05-15T08:00:00Z",
      title: "Začiatok pracovného dňa v Košiciach",
      description: "Podľa obvineného a svedka Horvátha boli celý deň v Košiciach.",
      location: "Košice",
      persons_involved: ["P001", "P003"],
      evidence_links: ["E003"],
      tags: ["alibi"],
      source_text: "S Jánom sme boli v Košiciach celý deň, od 8:00 do 20:00.",
      confidence: 0.7,
      approximate: false,
    },
    {
      id: "T002",
      timestamp: "2023-05-15T13:40:00Z",
      title: "Mýtny lístok D1 smer BA → KE",
      description: "Obvinený prešiel mýtnou bránou smerom z Bratislavy do Košíc. To znamená, že o 14:25 nemohol byť v banke v Bratislave — alebo alibi neplatí.",
      location: "Diaľnica D1, Bratislava",
      persons_involved: ["P001"],
      evidence_links: ["E004"],
      tags: ["rozpor", "alibi"],
      source_text: "Mýtny lístok na diaľnici D1, smer Bratislava → Košice, čas 13:40",
      confidence: 1.0,
      approximate: false,
    },
    {
      id: "T003",
      timestamp: "2023-05-15T14:25:00Z",
      title: "Obvinený vstúpil do banky (kamera)",
      description: "Kamerový systém zaznamenal obvineného pri vstupe do banky.",
      location: "Banka na Hlavnej ulici, Bratislava",
      persons_involved: ["P001"],
      evidence_links: ["E001"],
      tags: ["krádež", "rozpor"],
      source_text: "Podľa kamerového systému bol Ján Novák v bance od 14:25 do 14:35.",
      confidence: 1.0,
      approximate: false,
    },
    {
      id: "T004",
      timestamp: "2023-05-15T14:30:00Z",
      title: "Krádež v banke",
      description: "Obvinený Ján Novák ukradol 50 000 € z banky.",
      location: "Banka na Hlavnej ulici, Bratislava",
      persons_involved: ["P001"],
      evidence_links: ["E001"],
      tags: ["krádež"],
      source_text: "Dňa 15. mája 2023 o 14:30 došlo ku krádeži v banke na Hlavnej ulici v Bratislave.",
      confidence: 1.0,
      approximate: false,
    },
    {
      id: "T005",
      timestamp: "2023-05-15T15:00:00Z",
      title: "Svedkyňa videla obvineného odchádzať",
      description: "Petra Svobodová videla obvineného Jána Nováka odchádzať z banky.",
      location: "Pred bankou na Hlavnej ulici, Bratislava",
      persons_involved: ["P001", "P002"],
      evidence_links: ["E002"],
      tags: ["svedectvo"],
      source_text: "Svedkyňa Petra Svobodová potvrdila, že videla obvineného o 15:00 odchádzať z banky.",
      confidence: 0.95,
      approximate: false,
    },
    {
      id: "T006",
      timestamp: "2023-05-15T20:00:00Z",
      title: "Koniec pracovného dňa (podľa alibi)",
      description: "Podľa obvineného a svedka skončili v Košiciach o 20:00.",
      location: "Košice",
      persons_involved: ["P001", "P003"],
      evidence_links: ["E003"],
      tags: ["alibi"],
      source_text: "S Jánom sme boli v Košiciach celý deň, od 8:00 do 20:00.",
      confidence: 0.7,
      approximate: false,
    },
  ],
};
