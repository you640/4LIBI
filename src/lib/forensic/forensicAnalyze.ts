import { callMistralApi } from "../mistralApi";
import { chunkDocument } from "../documentChunker";
import {
  FORENSIC_SYSTEM_PROMPT,
  buildForensicRetryPrompt,
  buildForensicUserPrompt,
} from "./forensicPrompt";
import { FORENSIC_JSON_SCHEMA } from "./forensicSchema";
import { hashDocumentBytes } from "./hashDocument";
import {
  groundForensicResult,
  parseAndValidateForensicResponse,
} from "./validateForensic";
import { aggregateForensicDocuments, mergeAnalyses } from "./forensicAggregate";
import {
  FORENSIC_MODEL_DEFAULT,
  FORENSIC_PROMPT_VERSION,
  linearUnavailableForensicResult,
  type ForensicCaseResult,
  type ForensicDiagnostics,
  type ForensicDocumentAnalysis,
  type ForensicDocumentRecord,
} from "./types";
import { isAllowedLinearProjectId } from "./sourceOfTruth";

export interface ForensicSourceDocument {
  name: string;
  mime?: string;
  bytes: ArrayBuffer;
  text: string;
  linearMeta?: {
    linear_project_id: string;
    linear_issue_id?: string;
    linear_document_id?: string;
    attachment_id?: string;
    source_group_id?: string;
  };
}

function stampSourceGroup(
  analysis: ForensicDocumentAnalysis,
  groupId: string | null | undefined
) {
  if (!groupId) return;
  const stamp = (items: { source_group_id?: string | null }[]) => {
    for (const item of items) {
      if (!item.source_group_id) item.source_group_id = groupId;
    }
  };
  for (const actor of analysis.questions.weapons_flow.actors) {
    stamp(actor.evidence);
    stamp(actor.contradicting_evidence);
  }
  stamp(analysis.questions.plan_author.evidence);
  for (const c of analysis.questions.plan_author.candidates) {
    stamp(c.evidence);
    stamp(c.contradicting_evidence);
  }
  stamp(analysis.questions.financing.evidence);
  for (const p of analysis.questions.financing.payers) stamp(p.evidence);
  for (const s of analysis.questions.financing.funding_sources) stamp(s.evidence);
}

export function forensicDocumentId(name: string, index: number): string {
  const safe = name.replace(/[^\w.-]+/g, "_").slice(0, 80) || `document_${index + 1}`;
  return `${index + 1}-${safe}`;
}

async function callForensicModel(
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
  apiKey: string,
  model: string,
  temperature: number
): Promise<string> {
  try {
    return await callMistralApi(messages, {
      apiKey,
      model,
      temperature,
      maxTokens: 16000,
      jsonSchema: {
        name: "forensic_analysis",
        schema: FORENSIC_JSON_SCHEMA,
        strict: true,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/json_schema|response_format|unrecognized schema/i.test(message)) {
      return callMistralApi(messages, {
        apiKey,
        model,
        temperature,
        maxTokens: 16000,
        jsonObject: true,
      });
    }
    throw error;
  }
}

function failedRecord(input: {
  documentId: string;
  documentHash: string | null;
  model: string;
  analyzedAt: string;
  attempts: number;
  errors: string[];
  raw: string;
}): ForensicDocumentRecord {
  const diagnostics: ForensicDiagnostics = {
    attempts: input.attempts,
    validation_errors: input.errors,
    raw_response_excerpt: input.raw.slice(0, 1500),
    failed_at: input.analyzedAt,
  };
  return {
    status: "failed",
    meta: {
      document_id: input.documentId,
      document_hash: input.documentHash,
      prompt_version: FORENSIC_PROMPT_VERSION,
      model: input.model,
      analyzed_at: input.analyzedAt,
    },
    result: null,
    diagnostics,
  };
}

async function analyzeForensicChunk(input: {
  documentId: string;
  filename: string;
  documentHash: string | null;
  text: string;
  apiKey: string;
  model: string;
  linearMeta?: ForensicSourceDocument["linearMeta"];
}): Promise<{ result: ForensicDocumentAnalysis; raw: string } | { failed: ForensicDiagnostics; raw: string }> {
  const userContent = buildForensicUserPrompt({
    documentId: input.documentId,
    filename: input.filename,
    documentHash: input.documentHash,
    text: input.text,
    linearMeta: input.linearMeta,
  });
  const messages = [
    { role: "system" as const, content: FORENSIC_SYSTEM_PROMPT },
    { role: "user" as const, content: userContent },
  ];

  let raw = await callForensicModel(messages, input.apiKey, input.model, 0.1);
  let parsed = parseAndValidateForensicResponse(raw);
  let attempts = 1;

  if (!parsed.ok) {
    attempts = 2;
    raw = await callForensicModel(
      [
        ...messages,
        { role: "assistant", content: raw.slice(0, 4000) },
        { role: "user", content: buildForensicRetryPrompt() },
      ],
      input.apiKey,
      input.model,
      0.0
    );
    parsed = parseAndValidateForensicResponse(raw);
  }

  if (!parsed.ok) {
    return {
      failed: {
        attempts,
        validation_errors: parsed.errors,
        raw_response_excerpt: raw.slice(0, 1500),
        failed_at: new Date().toISOString(),
      },
      raw,
    };
  }

  return {
    result: groundForensicResult(parsed.value, input.text, {
      documentId: input.documentId,
      documentHash: input.documentHash,
    }),
    raw,
  };
}

export async function analyzeForensicDocument(
  doc: ForensicSourceDocument,
  apiKey: string,
  options: { index: number; model?: string; analyzedAt?: string } = { index: 0 }
): Promise<ForensicDocumentRecord> {
  const model = options.model || FORENSIC_MODEL_DEFAULT;
  const analyzedAt = options.analyzedAt || new Date().toISOString();
  const documentId = forensicDocumentId(doc.name, options.index);
  const documentHash = hashDocumentBytes(doc.bytes);

  const chunks = chunkDocument(doc.text);
  const chunkResults: ForensicDocumentAnalysis[] = [];

  for (const chunk of chunks.length ? chunks : [{ text: doc.text }]) {
    const outcome = await analyzeForensicChunk({
      documentId,
      filename: doc.name,
      documentHash,
      text: chunk.text,
      apiKey,
      model,
      linearMeta: doc.linearMeta,
    });
    if ("failed" in outcome) {
      return failedRecord({
        documentId,
        documentHash,
        model,
        analyzedAt,
        attempts: outcome.failed.attempts,
        errors: outcome.failed.validation_errors,
        raw: outcome.raw,
      });
    }
    chunkResults.push(outcome.result);
  }

  const merged =
    chunkResults.length === 1 ? chunkResults[0] : mergeAnalyses(chunkResults);
  merged.document_id = documentId;
  merged.document_hash = documentHash;
  stampSourceGroup(merged, doc.linearMeta?.source_group_id || doc.linearMeta?.linear_issue_id || doc.linearMeta?.linear_document_id || null);

  return {
    status: "ready",
    meta: {
      document_id: documentId,
      document_hash: documentHash,
      prompt_version: FORENSIC_PROMPT_VERSION,
      model,
      analyzed_at: analyzedAt,
    },
    result: merged,
    diagnostics: null,
  };
}

export async function analyzeForensicCase(
  documents: ForensicSourceDocument[],
  apiKey: string,
  options: { model?: string } = {}
): Promise<ForensicCaseResult> {
  const model = options.model || FORENSIC_MODEL_DEFAULT;
  const analyzedAt = new Date().toISOString();
  const admissible = documents.filter((doc) =>
    isAllowedLinearProjectId(doc.linearMeta?.linear_project_id)
  );

  if (admissible.length === 0) {
    return {
      ...linearUnavailableForensicResult(
        "Chýba validné Linear metadata alebo povolený project ID."
      ),
      status: "failed",
      analyzed_at: analyzedAt,
      case_level: null,
    };
  }

  const records: ForensicDocumentRecord[] = [];

  for (let i = 0; i < admissible.length; i++) {
    records.push(
      await analyzeForensicDocument(admissible[i], apiKey, {
        index: i,
        model,
        analyzedAt,
      })
    );
  }

  return aggregateForensicDocuments(records, { model, analyzedAt });
}
