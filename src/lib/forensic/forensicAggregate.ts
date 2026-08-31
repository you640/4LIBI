import { removeDiacritics } from "../forenzCore";
import {
  emptyForensicDocumentAnalysis,
  FORENSIC_PROMPT_VERSION,
  type ForensicActor,
  type ForensicCaseResult,
  type ForensicContradiction,
  type ForensicDocumentAnalysis,
  type ForensicDocumentRecord,
  type ForensicEntity,
  type ForensicEvidence,
  type ForensicTransaction,
  type PlanAuthorCandidate,
} from "./types";

/**
 * Case-level agregácia. Confidence sa nezvyšuje opakovaním toho istého tvrdenia
 * v odvodených dokumentoch. Dve listiny s rovnakým citátom nie sú nezávislé.
 */
export function aggregateForensicDocuments(
  documents: ForensicDocumentRecord[],
  options: { model: string; analyzedAt: string }
): ForensicCaseResult {
  const ready = documents.filter((d) => d.status === "ready" && d.result);
  const failed = documents.filter((d) => d.status === "failed");
  const status =
    failed.length === 0 && ready.length > 0
      ? "ready"
      : ready.length > 0
        ? "partial"
        : "failed";

  const analyses = ready.map((d) => d.result as ForensicDocumentAnalysis);
  const caseLevel =
    analyses.length > 0
      ? mergeAnalyses(analyses)
      : emptyForensicDocumentAnalysis("case", null);

  const diagnostics =
    failed.length > 0
      ? {
          attempts: failed.reduce(
            (sum, d) => sum + (d.diagnostics?.attempts ?? 0),
            0
          ),
          validation_errors: failed.flatMap(
            (d) => d.diagnostics?.validation_errors ?? []
          ),
          raw_response_excerpt: failed
            .map((d) => d.diagnostics?.raw_response_excerpt ?? "")
            .filter(Boolean)
            .join("\n---\n")
            .slice(0, 2000),
          failed_at: options.analyzedAt,
        }
      : null;

  return {
    status,
    prompt_version: FORENSIC_PROMPT_VERSION,
    model: options.model,
    analyzed_at: options.analyzedAt,
    documents,
    case_level: status === "failed" ? null : caseLevel,
    diagnostics,
  };
}

export function mergeAnalyses(
  analyses: ForensicDocumentAnalysis[]
): ForensicDocumentAnalysis {
  const merged = emptyForensicDocumentAnalysis("case", null);
  if (analyses.length === 0) return merged;

  const languages = analyses.map((a) => a.language);
  merged.language = majorityLanguage(languages);
  merged.warnings = unique(analyses.flatMap((a) => a.warnings));
  merged.contradictions = mergeContradictions(
    analyses.flatMap((a) => a.contradictions)
  );
  merged.entities = mergeEntities(analyses.flatMap((a) => a.entities));
  merged.transactions = mergeTransactions(analyses.flatMap((a) => a.transactions));

  merged.questions.weapons_flow.actors = mergeActors(
    analyses.flatMap((a) => a.questions.weapons_flow.actors)
  );
  merged.questions.weapons_flow.missing_evidence = unique(
    analyses.flatMap((a) => a.questions.weapons_flow.missing_evidence)
  );
  merged.questions.weapons_flow.answer = pickAnswer(
    analyses.map((a) => a.questions.weapons_flow.answer),
    merged.questions.weapons_flow.actors.flatMap((a) => a.evidence)
  );

  merged.questions.plan_author.candidates = mergeCandidates(
    analyses.flatMap((a) => a.questions.plan_author.candidates)
  );
  merged.questions.plan_author.evidence = dedupeEvidence(
    analyses.flatMap((a) => a.questions.plan_author.evidence)
  );
  merged.questions.plan_author.alternative_explanations = unique(
    analyses.flatMap((a) => a.questions.plan_author.alternative_explanations)
  );
  merged.questions.plan_author.missing_evidence = unique(
    analyses.flatMap((a) => a.questions.plan_author.missing_evidence)
  );
  merged.questions.plan_author.confidence = maxIndependentConfidence(
    merged.questions.plan_author.evidence
  );
  merged.questions.plan_author.answer = pickAnswer(
    analyses.map((a) => a.questions.plan_author.answer),
    merged.questions.plan_author.evidence
  );

  merged.questions.financing.payers = mergePayers(
    analyses.flatMap((a) => a.questions.financing.payers)
  );
  merged.questions.financing.funding_sources = mergeFundingSources(
    analyses.flatMap((a) => a.questions.financing.funding_sources)
  );
  merged.questions.financing.evidence = dedupeEvidence(
    analyses.flatMap((a) => a.questions.financing.evidence)
  );
  merged.questions.financing.missing_evidence = unique(
    analyses.flatMap((a) => a.questions.financing.missing_evidence)
  );
  merged.questions.financing.confidence = maxIndependentConfidence(
    merged.questions.financing.evidence
  );
  merged.questions.financing.answer = pickAnswer(
    analyses.map((a) => a.questions.financing.answer),
    merged.questions.financing.evidence
  );

  addCrossDocumentContradictions(merged, analyses);
  return merged;
}

function mergeActors(actors: ForensicActor[]): ForensicActor[] {
  const map = new Map<string, ForensicActor>();
  for (const actor of actors) {
    const key = `${normName(actor.name)}|${actor.role}`;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        ...actor,
        evidence: [...actor.evidence],
        contradicting_evidence: [...actor.contradicting_evidence],
        confidence: maxIndependentConfidence(actor.evidence),
      });
      continue;
    }
    existing.evidence = dedupeEvidence([...existing.evidence, ...actor.evidence]);
    existing.contradicting_evidence = dedupeEvidence([
      ...existing.contradicting_evidence,
      ...actor.contradicting_evidence,
    ]);
    existing.confidence = maxIndependentConfidence(existing.evidence);
    if (actor.found_in_text) existing.found_in_text = true;
    if (actor.inferred && !existing.found_in_text) existing.inferred = true;
    if (actor.found_in_text) existing.inferred = existing.inferred && actor.inferred;
  }
  return [...map.values()];
}

function mergeCandidates(candidates: PlanAuthorCandidate[]): PlanAuthorCandidate[] {
  const map = new Map<string, PlanAuthorCandidate>();
  for (const c of candidates) {
    const key = `${normName(c.name)}|${c.role}`;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        ...c,
        evidence: [...c.evidence],
        contradicting_evidence: [...c.contradicting_evidence],
        confidence: maxIndependentConfidence(c.evidence),
      });
      continue;
    }
    existing.evidence = dedupeEvidence([...existing.evidence, ...c.evidence]);
    existing.contradicting_evidence = dedupeEvidence([
      ...existing.contradicting_evidence,
      ...c.contradicting_evidence,
    ]);
    existing.confidence = maxIndependentConfidence(existing.evidence);
  }
  return [...map.values()];
}

function mergePayers(
  payers: ForensicDocumentAnalysis["questions"]["financing"]["payers"]
) {
  const map = new Map<string, (typeof payers)[number]>();
  for (const p of payers) {
    const key = `${normName(p.name)}|${p.role}`;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        ...p,
        evidence: [...p.evidence],
        confidence: maxIndependentConfidence(p.evidence),
      });
      continue;
    }
    existing.evidence = dedupeEvidence([...existing.evidence, ...p.evidence]);
    existing.confidence = maxIndependentConfidence(existing.evidence);
  }
  return [...map.values()];
}

function mergeFundingSources(
  sources: ForensicDocumentAnalysis["questions"]["financing"]["funding_sources"]
) {
  const map = new Map<string, (typeof sources)[number]>();
  for (const s of sources) {
    const key = normName(s.name);
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        ...s,
        evidence: [...s.evidence],
        confidence: maxIndependentConfidence(s.evidence),
      });
      continue;
    }
    existing.evidence = dedupeEvidence([...existing.evidence, ...s.evidence]);
    existing.confidence = maxIndependentConfidence(existing.evidence);
    if (s.distinct_from_invoice_payer) existing.distinct_from_invoice_payer = true;
  }
  return [...map.values()];
}

function mergeEntities(entities: ForensicEntity[]): ForensicEntity[] {
  const map = new Map<string, ForensicEntity>();
  for (const e of entities) {
    const key = normName(e.name);
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        ...e,
        identifiers: [...e.identifiers],
        aliases: [...e.aliases],
      });
      continue;
    }
    existing.identifiers = unique([...existing.identifiers, ...e.identifiers]);
    existing.aliases = unique([...existing.aliases, ...e.aliases]);
  }
  return [...map.values()];
}

function mergeTransactions(items: ForensicTransaction[]): ForensicTransaction[] {
  const map = new Map<string, ForensicTransaction>();
  for (const t of items) {
    const key = [
      t.invoice_number || "",
      t.serial_number || "",
      t.date || "",
      t.amount || "",
      t.payer || "",
    ].join("|");
    const existing = map.get(key);
    if (!existing) {
      map.set(key, { ...t, evidence: [...t.evidence] });
      continue;
    }
    existing.evidence = dedupeEvidence([...existing.evidence, ...t.evidence]);
  }
  return [...map.values()];
}

function mergeContradictions(
  items: ForensicContradiction[]
): ForensicContradiction[] {
  const seen = new Set<string>();
  const out: ForensicContradiction[] = [];
  for (const c of items) {
    const key = `${c.field}|${c.value_a}|${c.value_b}|${c.source_a}|${c.source_b}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}

function addCrossDocumentContradictions(
  merged: ForensicDocumentAnalysis,
  analyses: ForensicDocumentAnalysis[]
) {
  const byInvoice = new Map<string, ForensicTransaction[]>();
  for (const analysis of analyses) {
    for (const tx of analysis.transactions) {
      if (!tx.invoice_number) continue;
      const list = byInvoice.get(tx.invoice_number) || [];
      list.push({ ...tx });
      byInvoice.set(tx.invoice_number, list);
    }
  }
  for (const [invoice, txs] of byInvoice) {
    const dates = unique(txs.map((t) => t.date).filter((d): d is string => !!d));
    if (dates.length > 1) {
      merged.contradictions.push({
        field: "transaction.date",
        value_a: dates[0],
        value_b: dates[1],
        source_a: txs[0].evidence[0]?.document_id || invoice,
        source_b: txs[1]?.evidence[0]?.document_id || invoice,
        description: `Rozporné dátumy pri faktúre ${invoice} — pôvodné hodnoty zachované.`,
      });
    }
  }

  const nameVariants = new Map<string, Set<string>>();
  for (const analysis of analyses) {
    for (const entity of analysis.entities) {
      const key = normName(entity.name);
      const set = nameVariants.get(key) || new Set<string>();
      set.add(entity.name);
      nameVariants.set(key, set);
    }
  }
  for (const variants of nameVariants.values()) {
    const names = [...variants];
    if (names.length > 1) {
      merged.contradictions.push({
        field: "entity.name",
        value_a: names[0],
        value_b: names[1],
        source_a: "case",
        source_b: "case",
        description: `Rozporné zápisy mena — pôvodné tvary zachované: ${names.join(", ")}.`,
      });
    }
  }
}

export function quoteFingerprint(quote: string): string {
  return removeDiacritics(quote).replace(/\s+/g, " ").trim().slice(0, 120);
}

export function quotesEquivalent(a: string, b: string): boolean {
  const fa = quoteFingerprint(a);
  const fb = quoteFingerprint(b);
  if (!fa || !fb) return false;
  return fa === fb || fa.includes(fb) || fb.includes(fa);
}

export function independentEvidence(items: ForensicEvidence[]): ForensicEvidence[] {
  const independent: ForensicEvidence[] = [];
  for (const item of items) {
    const derived = independent.some(
      (kept) =>
        quotesEquivalent(kept.quote, item.quote) ||
        kept.document_id === item.document_id
    );
    if (!derived) independent.push(item);
  }
  return independent;
}

export function maxIndependentConfidence(items: ForensicEvidence[]): number {
  const independent = independentEvidence(items);
  if (independent.length === 0) return 0;
  return Math.max(...independent.map((ev) => confidenceFromType(ev)));
}

function confidenceFromType(ev: ForensicEvidence): number {
  switch (ev.evidence_type) {
    case "direct_evidence":
      return 0.9;
    case "corroborated":
      return 0.85;
    case "testimony":
      return 0.55;
    case "inference":
      return 0.35;
    case "hypothesis":
      return 0.2;
    default:
      return 0;
  }
}

function dedupeEvidence(items: ForensicEvidence[]): ForensicEvidence[] {
  const out: ForensicEvidence[] = [];
  for (const item of items) {
    const dup = out.some(
      (kept) =>
        kept.document_id === item.document_id &&
        kept.page === item.page &&
        quotesEquivalent(kept.quote, item.quote)
    );
    if (!dup) out.push(item);
  }
  return out;
}

function pickAnswer(
  answers: Array<string | null>,
  evidence: ForensicEvidence[]
): string | null {
  const grounded = answers.filter((a): a is string => !!a && a.trim().length > 0);
  if (grounded.length === 0) return null;
  if (independentEvidence(evidence).length === 0) return null;
  return grounded[0];
}

function majorityLanguage(
  languages: ForensicDocumentAnalysis["language"][]
): ForensicDocumentAnalysis["language"] {
  const counts = new Map<string, number>();
  for (const lang of languages) counts.set(lang, (counts.get(lang) || 0) + 1);
  let best: ForensicDocumentAnalysis["language"] = "sk";
  let n = 0;
  for (const [lang, count] of counts) {
    if (count > n) {
      n = count;
      best = lang as ForensicDocumentAnalysis["language"];
    }
  }
  return best;
}

function normName(name: string): string {
  return removeDiacritics(name).replace(/\s+/g, " ").trim();
}

function unique(items: string[]): string[] {
  return [...new Set(items.filter((x) => x && x.trim()))];
}
