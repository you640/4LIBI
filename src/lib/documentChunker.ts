// Inteligentný Document Chunker & Multi-Page RAG Synthesizer pre forenzné spisy
import type { Analysis, Person, Evidence, Relationship, TimelineEvent } from "../types";

export interface DocumentChunk {
  index: number;
  totalChunks: number;
  text: string;
  charStart: number;
  charEnd: number;
  estimatedTokens: number;
}

export interface ChunkerOptions {
  maxChunkChars?: number;
  overlapChars?: number;
}

const DEFAULT_MAX_CHUNK_CHARS = 24000; // ~6,000 tokenov na chunk (bezpečné pre LLM kontext)
const DEFAULT_OVERLAP_CHARS = 2500;    // ~600 tokenov prekrytie pre zachovanie časových súvislostí

/**
 * Rozdelí dlhý spis/text na logické bloky podľa odsekov/strán s kontextovým prekrytím.
 */
export function chunkDocument(
  text: string,
  options: ChunkerOptions = {}
): DocumentChunk[] {
  const {
    maxChunkChars = DEFAULT_MAX_CHUNK_CHARS,
    overlapChars = DEFAULT_OVERLAP_CHARS,
  } = options;

  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  if (normalized.length <= maxChunkChars) {
    return [
      {
        index: 0,
        totalChunks: 1,
        text: normalized,
        charStart: 0,
        charEnd: normalized.length,
        estimatedTokens: Math.ceil(normalized.length / 4),
      },
    ];
  }

  const chunks: DocumentChunk[] = [];
  let cursor = 0;

  while (cursor < normalized.length) {
    let targetEnd = cursor + maxChunkChars;

    if (targetEnd >= normalized.length) {
      targetEnd = normalized.length;
    } else {
      // Hľadáme prirodzené hranice (koniec strany, odsek, veta)
      const lookbackLimit = Math.max(cursor + maxChunkChars / 2, targetEnd - 1500);
      const windowText = normalized.slice(lookbackLimit, targetEnd);

      const paragraphBreak = windowText.lastIndexOf("\n\n");
      const pageBreak = windowText.lastIndexOf("--- STRANA");
      const sentenceBreak = Math.max(
        windowText.lastIndexOf(". "),
        windowText.lastIndexOf("!\n"),
        windowText.lastIndexOf("?\n")
      );

      if (pageBreak !== -1) {
        targetEnd = lookbackLimit + pageBreak;
      } else if (paragraphBreak !== -1) {
        targetEnd = lookbackLimit + paragraphBreak + 2;
      } else if (sentenceBreak !== -1) {
        targetEnd = lookbackLimit + sentenceBreak + 2;
      }
    }

    const chunkText = normalized.slice(cursor, targetEnd).trim();
    if (chunkText) {
      chunks.push({
        index: chunks.length,
        totalChunks: 0, // doplní sa po skončení cyklu
        text: chunkText,
        charStart: cursor,
        charEnd: targetEnd,
        estimatedTokens: Math.ceil(chunkText.length / 4),
      });
    }

    if (targetEnd >= normalized.length) break;

    // Posun o krok vpred s odpočtom overlapu
    cursor = Math.max(cursor + 1, targetEnd - overlapChars);
  }

  // Nastavíme celkový počet chunkov
  for (const chunk of chunks) {
    chunk.totalChunks = chunks.length;
  }

  return chunks;
}

/**
 * Zjednotí parciálne analýzy z jednotlivých chunkov do jedného celistvého spisu.
 */
export function mergeAnalysisResults(
  analyses: Analysis[],
  documentName: string
): Analysis {
  if (analyses.length === 0) {
    return {
      metadata: {
        document_name: documentName,
        language: "sk",
        page_count: 0,
        upload_date: new Date().toISOString(),
      },
      persons: [],
      evidence: [],
      relationships: [],
      timeline: [],
    };
  }

  if (analyses.length === 1) {
    return analyses[0];
  }

  // 1. Zjednotenie a dedup osôb
  const personMap = new Map<string, Person>();
  const nameToId = new Map<string, string>();

  for (const analysis of analyses) {
    for (const p of analysis.persons) {
      const normName = normalizePersonName(p.name);
      if (!normName) continue;

      if (!nameToId.has(normName)) {
        const id = p.id || `p_${personMap.size + 1}`;
        nameToId.set(normName, id);
        personMap.set(id, {
          id,
          name: p.name.trim(),
          role: p.role || "svedok",
          description: p.description || null,
          aliases: Array.isArray(p.aliases) ? [...p.aliases] : [],
        });
      } else {
        const existingId = nameToId.get(normName)!;
        const existing = personMap.get(existingId)!;
        if (!existing.description && p.description) {
          existing.description = p.description;
        }
        if (p.aliases && p.aliases.length > 0) {
          const combinedAliases = new Set([...(existing.aliases || []), ...p.aliases]);
          existing.aliases = Array.from(combinedAliases);
        }
      }
    }
  }

  // 2. Zjednotenie dôkazov
  const evidenceMap = new Map<string, Evidence>();
  for (const analysis of analyses) {
    for (const ev of analysis.evidence) {
      const key = `${ev.type}:${ev.content.trim().toLowerCase()}`;
      if (!evidenceMap.has(key)) {
        const id = ev.id || `ev_${evidenceMap.size + 1}`;
        evidenceMap.set(key, { ...ev, id });
      }
    }
  }

  // 3. Zjednotenie vzťahov
  const relationshipList: Relationship[] = [];
  const relSeen = new Set<string>();

  for (const analysis of analyses) {
    for (const rel of analysis.relationships) {
      const p1 = resolvePersonId(rel.person1_id, analysis.persons, nameToId);
      const p2 = resolvePersonId(rel.person2_id, analysis.persons, nameToId);
      if (!p1 || !p2 || p1 === p2) continue;

      const key = [p1, p2].sort().join("<->") + `:${rel.type}`;
      if (!relSeen.has(key)) {
        relSeen.add(key);
        relationshipList.push({
          person1_id: p1,
          person2_id: p2,
          type: rel.type,
          description: rel.description,
          evidence_supporting: rel.evidence_supporting || [],
        });
      }
    }
  }

  // 4. Zjednotenie a usporiadanie časovej osi
  const timelineEvents: TimelineEvent[] = [];
  const eventSeen = new Set<string>();

  for (const analysis of analyses) {
    for (const ev of analysis.timeline) {
      const normTitle = ev.title.trim().toLowerCase();
      const normTime = ev.timestamp || "no_time";
      const key = `${normTime}:${normTitle}`;

      if (!eventSeen.has(key)) {
        eventSeen.add(key);
        const resolvedPersons = (ev.persons_involved || []).map((nameOrId) => {
          const norm = normalizePersonName(nameOrId);
          return nameToId.get(norm) || nameOrId;
        });

        timelineEvents.push({
          ...ev,
          id: ev.id || `event_${timelineEvents.length + 1}`,
          persons_involved: resolvedPersons,
        });
      }
    }
  }

  // Usporiadanie chronologicky
  timelineEvents.sort((a, b) => {
    if (!a.timestamp && !b.timestamp) return 0;
    if (!a.timestamp) return 1;
    if (!b.timestamp) return -1;
    return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
  });

  return {
    metadata: {
      document_name: documentName,
      language: analyses[0]?.metadata?.language || "sk",
      page_count: analyses.reduce((acc, curr) => acc + (curr.metadata?.page_count || 1), 0),
      upload_date: new Date().toISOString(),
    },
    persons: Array.from(personMap.values()),
    evidence: Array.from(evidenceMap.values()),
    relationships: relationshipList,
    timeline: timelineEvents,
  };
}

function normalizePersonName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, "")
    .trim();
}

function resolvePersonId(
  rawIdOrName: string,
  chunkPersons: Person[],
  nameToIdMap: Map<string, string>
): string | null {
  const fromChunk = chunkPersons.find((p) => p.id === rawIdOrName);
  if (fromChunk) {
    const norm = normalizePersonName(fromChunk.name);
    return nameToIdMap.get(norm) || rawIdOrName;
  }
  const normDirect = normalizePersonName(rawIdOrName);
  return nameToIdMap.get(normDirect) || rawIdOrName;
}
