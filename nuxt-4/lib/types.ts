// types.ts — Nuxt 4 / Vue 3 kompatibilné typy
// Prenesené z React verzie (src/types.ts).

export interface AnalysisMetadata {
  document_name: string
  language: 'sk' | 'cs' | 'en'
  page_count: number | null
  upload_date: string
}

export interface Person {
  id: string
  name: string
  role: string
  description: string | null
  aliases?: string[]
}

export type EvidenceType =
  | 'document'
  | 'photo'
  | 'video'
  | 'testimony'
  | 'audio'
  | 'other'

export interface Evidence {
  id: string
  type: EvidenceType
  content: string
  source: string
  relevance_score: number
}

export interface Relationship {
  person1_id: string
  person2_id: string
  type: string
  description: string
  evidence_supporting: string[]
}

export interface TimelineEvent {
  id: string
  timestamp: string | null
  title: string
  description: string
  location: string | null
  persons_involved: string[]
  evidence_links: string[]
  tags: string[]
  source_text: string
  confidence: number
  approximate: boolean
}

export interface Analysis {
  metadata: AnalysisMetadata
  persons: Person[]
  evidence: Evidence[]
  relationships: Relationship[]
  timeline: TimelineEvent[]
}
