import type { ForensicCitation, SourceKind } from "./linearTypes";

const SOURCE_RANK: Record<SourceKind, number> = {
  original_attachment: 1,
  verified_transcript: 2,
  working_ocr: 3,
  forensic_record: 4,
  derived_index: 5,
};

export function sourceRank(kind: SourceKind): number {
  return SOURCE_RANK[kind] ?? 99;
}

/** Same original Linear record — transcript/register/timeline must not count thrice. */
export function originKey(citation: Pick<
  ForensicCitation,
  "linear_issue_id" | "linear_document_id" | "attachment_id"
>): string {
  if (citation.attachment_id) {
    const parent =
      citation.linear_issue_id || citation.linear_document_id || "unknown";
    return `att:${parent}:${citation.attachment_id}`;
  }
  if (citation.linear_issue_id) return `issue:${citation.linear_issue_id}`;
  if (citation.linear_document_id) return `doc:${citation.linear_document_id}`;
  return "unknown";
}

export function preferOriginal(
  a: ForensicCitation,
  b: ForensicCitation
): ForensicCitation {
  const ra = sourceRank(a.source_kind);
  const rb = sourceRank(b.source_kind);
  if (ra !== rb) return ra < rb ? a : b;
  if (a.quote && !b.quote) return a;
  if (b.quote && !a.quote) return b;
  return a;
}

export function dedupeCitations(citations: ForensicCitation[]): ForensicCitation[] {
  const byOrigin = new Map<string, ForensicCitation>();
  for (const citation of citations) {
    const key = originKey(citation);
    const existing = byOrigin.get(key);
    if (!existing) {
      byOrigin.set(key, citation);
      continue;
    }
    byOrigin.set(key, preferOriginal(existing, citation));
  }
  return [...byOrigin.values()];
}

export function independentOrigins(
  citations: Array<
    Pick<ForensicCitation, "linear_issue_id" | "linear_document_id" | "attachment_id"> & {
      source_kind?: SourceKind;
    }
  >
): string[] {
  const origins = new Set<string>();
  for (const citation of citations) {
    if (citation.source_kind === "derived_index") continue;
    const key = originKey(citation);
    if (key !== "unknown") origins.add(key);
  }
  return [...origins];
}

export function canCorroborate(citations: ForensicCitation[]): boolean {
  const factual = citations.filter(
    (c) =>
      c.evidence_type === "direct_evidence" ||
      c.evidence_type === "testimony" ||
      c.evidence_type === "corroborated"
  );
  return independentOrigins(factual).length >= 2;
}

export function hasDirectEvidence(citations: ForensicCitation[]): boolean {
  return citations.some(
    (c) =>
      c.evidence_type === "direct_evidence" && c.source_kind !== "derived_index"
  );
}

export function isFactuallySufficient(citations: ForensicCitation[]): boolean {
  return hasDirectEvidence(citations) || canCorroborate(citations);
}
