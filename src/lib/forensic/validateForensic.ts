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
      if (!(key in obj)) errors.push(`${path}.${key}: chýba povinné pole`);
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

  grounded.questions.weapons_flow.actors = grounded.questions.weapons_flow.actors.map((actor) => ({
    ...actor,
    evidence: filterEvidence(actor.evidence),
    contradicting_evidence: filterEvidence(actor.contradicting_evidence),
    name: actor.name,
  }));

  const wfEvidence = grounded.questions.weapons_flow.actors.flatMap((a) => a.evidence);
  if (grounded.questions.weapons_flow.answer && wfEvidence.length === 0) {
    grounded.questions.weapons_flow.missing_evidence = unique([
      ...grounded.questions.weapons_flow.missing_evidence,
      "Chýba citácia z dokumentu pre tok zbraní.",
    ]);
    grounded.questions.weapons_flow.answer = null;
  }

  grounded.questions.plan_author.evidence = filterEvidence(grounded.questions.plan_author.evidence);
  grounded.questions.plan_author.candidates = grounded.questions.plan_author.candidates.map((c) => ({
    ...c,
    evidence: filterEvidence(c.evidence),
    contradicting_evidence: filterEvidence(c.contradicting_evidence),
  }));
  const paEvidence = [
    ...grounded.questions.plan_author.evidence,
    ...grounded.questions.plan_author.candidates.flatMap((c) => c.evidence),
  ];
  if (grounded.questions.plan_author.answer && paEvidence.length === 0) {
    grounded.questions.plan_author.answer = null;
    grounded.questions.plan_author.confidence = 0;
    grounded.questions.plan_author.missing_evidence = unique([
      ...grounded.questions.plan_author.missing_evidence,
      "Chýba citácia z dokumentu pre autora/koordinátora plánu.",
    ]);
  }

  grounded.questions.financing.evidence = filterEvidence(grounded.questions.financing.evidence);
  grounded.questions.financing.payers = grounded.questions.financing.payers.map((p) => ({
    ...p,
    evidence: filterEvidence(p.evidence),
  }));
  grounded.questions.financing.funding_sources = grounded.questions.financing.funding_sources.map(
    (s) => ({ ...s, evidence: filterEvidence(s.evidence) })
  );
  const finEvidence = [
    ...grounded.questions.financing.evidence,
    ...grounded.questions.financing.payers.flatMap((p) => p.evidence),
    ...grounded.questions.financing.funding_sources.flatMap((s) => s.evidence),
  ];
  if (grounded.questions.financing.answer && finEvidence.length === 0) {
    grounded.questions.financing.answer = null;
    grounded.questions.financing.confidence = 0;
    grounded.questions.financing.missing_evidence = unique([
      ...grounded.questions.financing.missing_evidence,
      "Chýba citácia z dokumentu pre financovanie.",
    ]);
  }

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
