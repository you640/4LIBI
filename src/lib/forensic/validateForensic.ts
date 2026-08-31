import { extractJson } from "../sherlockPrompt";
import { FORENSIC_JSON_SCHEMA } from "./forensicSchema";
import {
  ALLOWED_LINEAR_PROJECT_ID,
  FOREIGN_SOURCE_WARNING,
  isAllowedLinearProjectId,
} from "./sourceOfTruth";
import type { ForensicDocumentAnalysis } from "./types";

export interface ValidationSuccess {
  ok: true;
  value: ForensicDocumentAnalysis;
}

export interface ValidationFailure {
  ok: false;
  errors: string[];
}

export type ValidationResult = ValidationSuccess | ValidationFailure;

const INSTRUCTION_RE =
  /ignore (all |previous |the )?(instructions|prompt)|zabudni (predchádzajúce|všetky) (inštrukcie|pokyny)|you are now|system prompt|return only|namiesto schémy/i;

export function validateJsonSchema(
  data: unknown,
  schema: Record<string, unknown> = FORENSIC_JSON_SCHEMA,
  path = "$"
): string[] {
  return validateNode(data, schema, path, schema);
}

function validateNode(
  data: unknown,
  schema: Record<string, unknown>,
  path: string,
  root: Record<string, unknown>
): string[] {
  const errors: string[] = [];
  const types = normalizeTypes(schema.type);

  if (isNullable(types) && data === null) return errors;

  if (types.length > 0 && data !== null && !types.includes(jsonType(data))) {
    if (!(jsonType(data) === "integer" && types.includes("number"))) {
      errors.push(`${path}: očakávaný typ ${types.join("|")}, prišlo ${jsonType(data)}`);
      return errors;
    }
  }

  if (schema.enum && Array.isArray(schema.enum) && !schema.enum.includes(data as never)) {
    errors.push(`${path}: hodnota nie je v enum`);
  }

  if (typeof schema.minimum === "number" && typeof data === "number" && data < schema.minimum) {
    errors.push(`${path}: pod minimom ${schema.minimum}`);
  }
  if (typeof schema.maximum === "number" && typeof data === "number" && data > schema.maximum) {
    errors.push(`${path}: nad maximom ${schema.maximum}`);
  }

  if (types.includes("object") && data !== null && typeof data === "object" && !Array.isArray(data)) {
    const obj = data as Record<string, unknown>;
    const properties = (schema.properties || {}) as Record<string, Record<string, unknown>>;
    const required = (schema.required || []) as string[];
    for (const key of required) {
      if (!(key in obj)) errors.push(`${path}.${key}: chýba povinné pole (required field missing)`);
    }
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(obj)) {
        if (!(key in properties)) errors.push(`${path}.${key}: extra pole`);
      }
    }
    for (const [key, propSchema] of Object.entries(properties)) {
      if (key in obj) {
        errors.push(...validateNode(obj[key], propSchema, `${path}.${key}`, root));
      }
    }
  }

  if (types.includes("array") && Array.isArray(data)) {
    const items = schema.items as Record<string, unknown> | undefined;
    if (items) {
      data.forEach((item, i) => {
        errors.push(...validateNode(item, items, `${path}[${i}]`, root));
      });
    }
  }

  return errors;
}

function normalizeTypes(type: unknown): string[] {
  if (typeof type === "string") return [type];
  if (Array.isArray(type)) return type.filter((t): t is string => typeof t === "string");
  return [];
}

function isNullable(types: string[]): boolean {
  return types.includes("null");
}

function jsonType(data: unknown): string {
  if (data === null) return "null";
  if (Array.isArray(data)) return "array";
  if (typeof data === "number") return Number.isInteger(data) ? "integer" : "number";
  return typeof data;
}

export function parseAndValidateForensicResponse(raw: string): ValidationResult {
  let parsed: unknown;
  try {
    parsed = extractJson(raw);
  } catch {
    return { ok: false, errors: ["Odpoveď nie je validné JSON"] };
  }
  const errors = validateJsonSchema(parsed, FORENSIC_JSON_SCHEMA);
  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, value: parsed as ForensicDocumentAnalysis };
}

export function quoteInDocument(quote: string, documentText: string): boolean {
  const q = normalizeText(quote);
  const t = normalizeText(documentText);
  if (q.length < 8) return t.includes(q) && q.length > 0;
  return t.includes(q);
}

export function isInstructionLike(text: string): boolean {
  return INSTRUCTION_RE.test(text);
}

import {
  canConfirmAnswer,
} from "./forensicAggregate";
import {
  inferEntityKind,
  normalizeEntityId,
} from "./types";

export function groundForensicResult(
  analysis: ForensicDocumentAnalysis,
  documentText: string,
  meta: { documentId: string; documentHash: string | null }
): ForensicDocumentAnalysis {
  const warnings = [...analysis.warnings];
  const grounded = structuredClone(analysis);
  grounded.document_id = meta.documentId;
  grounded.document_hash = meta.documentHash;

  const filterEvidence = (items: typeof analysis.questions.plan_author.evidence) =>
    items.filter((ev) => {
      if (!ev.quote || !ev.quote.trim()) {
        return false;
      }
      if (ev.linear_project_id && !isAllowedLinearProjectId(ev.linear_project_id)) {
        if (!warnings.includes(FOREIGN_SOURCE_WARNING)) {
          warnings.push(FOREIGN_SOURCE_WARNING);
        }
        return false;
      }
      if (isInstructionLike(ev.quote)) {
        warnings.push("Citácia vyzerá ako pokyn pre model, nie ako skutkový dôkaz.");
        return false;
      }
      if (!quoteInDocument(ev.quote, documentText)) {
        warnings.push(`Citácia sa nenašla v dokumente ${meta.documentId}.`);
        return false;
      }
      if (!ev.linear_project_id) {
        ev.linear_project_id = ALLOWED_LINEAR_PROJECT_ID;
      }
      return true;
    });

  // Normalize entities
  grounded.entities = (grounded.entities || [])
    .filter((e) => e.name && e.name.trim().length > 0)
    .map((e) => {
      const kind = inferEntityKind(undefined, e.name, e.type);
      return {
        ...e,
        type: kind,
        entity_id: normalizeEntityId(kind, e.name, e.entity_id),
      };
    });

  const knownEntityIds = new Set(grounded.entities.map((e) => e.entity_id));

  // Normalize actors
  grounded.questions.weapons_flow.actors = (grounded.questions.weapons_flow.actors || [])
    .filter((actor) => actor.name && actor.name.trim().length > 0)
    .map((actor) => {
      const kind = inferEntityKind(actor.role, actor.name, actor.entity_kind);
      const entity_id = normalizeEntityId(kind, actor.name, actor.entity_id);
      knownEntityIds.add(entity_id);
      return {
        ...actor,
        entity_kind: kind,
        entity_id,
        evidence: filterEvidence(actor.evidence || []),
        contradicting_evidence: filterEvidence(actor.contradicting_evidence || []),
      };
    });

  const wfEvidence = grounded.questions.weapons_flow.actors.flatMap((a) => a.evidence);
  if (!canConfirmAnswer(wfEvidence)) {
    grounded.questions.weapons_flow.confirmed_answer = null;
    grounded.questions.weapons_flow.answer = null;
    grounded.questions.weapons_flow.status = "insufficient_evidence";
    if (wfEvidence.length === 0) {
      grounded.questions.weapons_flow.missing_evidence = unique([
        ...grounded.questions.weapons_flow.missing_evidence,
        "Chýba citácia z dokumentu pre tok zbraní.",
      ]);
    }
  }

  // Normalize candidates
  grounded.questions.plan_author.evidence = filterEvidence(grounded.questions.plan_author.evidence || []);
  grounded.questions.plan_author.candidates = (grounded.questions.plan_author.candidates || [])
    .filter((c) => c.name && c.name.trim().length > 0)
    .map((c) => {
      const kind = inferEntityKind(c.role, c.name, c.entity_kind);
      const entity_id = normalizeEntityId(kind, c.name, c.entity_id);
      knownEntityIds.add(entity_id);
      return {
        ...c,
        entity_kind: kind,
        entity_id,
        evidence: filterEvidence(c.evidence || []),
        contradicting_evidence: filterEvidence(c.contradicting_evidence || []),
      };
    });
  const paEvidence = [
    ...grounded.questions.plan_author.evidence,
    ...grounded.questions.plan_author.candidates.flatMap((c) => c.evidence),
  ];
  if (!canConfirmAnswer(paEvidence)) {
    grounded.questions.plan_author.confirmed_answer = null;
    grounded.questions.plan_author.answer = null;
    grounded.questions.plan_author.confidence = 0;
    grounded.questions.plan_author.status = "insufficient_evidence";
    if (paEvidence.length === 0) {
      grounded.questions.plan_author.missing_evidence = unique([
        ...grounded.questions.plan_author.missing_evidence,
        "Chýba citácia z dokumentu pre autora/koordinátora plánu.",
      ]);
    }
  }

  // Normalize payers & funding sources
  grounded.questions.financing.evidence = filterEvidence(grounded.questions.financing.evidence || []);
  grounded.questions.financing.payers = (grounded.questions.financing.payers || [])
    .filter((p) => p.name && p.name.trim().length > 0)
    .map((p) => {
      const kind = inferEntityKind(p.role, p.name, p.entity_kind);
      const entity_id = normalizeEntityId(kind, p.name, p.entity_id);
      knownEntityIds.add(entity_id);
      return {
        ...p,
        entity_kind: kind,
        entity_id,
        evidence: filterEvidence(p.evidence || []),
      };
    });
  grounded.questions.financing.funding_sources = (grounded.questions.financing.funding_sources || [])
    .filter((s) => s.name && s.name.trim().length > 0)
    .map((s) => {
      const kind = inferEntityKind("funding_source", s.name, s.entity_kind);
      const entity_id = normalizeEntityId(kind, s.name, s.entity_id);
      knownEntityIds.add(entity_id);
      return {
        ...s,
        entity_kind: kind,
        entity_id,
        evidence: filterEvidence(s.evidence || []),
      };
    });
  const finEvidence = [
    ...grounded.questions.financing.evidence,
    ...grounded.questions.financing.payers.flatMap((p) => p.evidence),
    ...grounded.questions.financing.funding_sources.flatMap((s) => s.evidence),
  ];
  if (!canConfirmAnswer(finEvidence)) {
    grounded.questions.financing.confirmed_answer = null;
    grounded.questions.financing.answer = null;
    grounded.questions.financing.confidence = 0;
    grounded.questions.financing.status = "insufficient_evidence";
    if (finEvidence.length === 0) {
      grounded.questions.financing.missing_evidence = unique([
        ...grounded.questions.financing.missing_evidence,
        "Chýba citácia z dokumentu pre financovanie.",
      ]);
    }
  }

  // Validate transaction_edges
  grounded.transaction_edges = (grounded.transaction_edges || [])
    .map((edge) => ({
      ...edge,
      evidence: filterEvidence(edge.evidence || []),
    }))
    .filter((edge) => {
      if (edge.evidence.length === 0) return false;
      if (!edge.from_entity_id || !edge.to_entity_id) return false;
      if (edge.from_entity_id === edge.to_entity_id) return false; // discard self-edge
      if (!knownEntityIds.has(edge.from_entity_id) || !knownEntityIds.has(edge.to_entity_id)) {
        return false;
      }
      return true;
    })
    .map((edge) => ({
      ...edge,
      edge_id: `${edge.from_entity_id}->${edge.to_entity_id}:${edge.role}:${edge.date || "nodate"}`,
    }));

  grounded.warnings = unique(warnings);
  return grounded;
}

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function unique(items: string[]): string[] {
  return [...new Set(items.filter(Boolean))];
}
