import {
  loadLinearCatalog,
  LinearUnavailableError,
  resolveLinearApiKey,
  resolveLinearProjectId,
} from "./forensic/linearClient";
import { ALLOWED_LINEAR_PROJECT_ID } from "./forensic/sourceOfTruth";
import type { ForensicSourceDocument } from "./forensic/forensicAnalyze";

export { ALLOWED_LINEAR_PROJECT_ID, LinearUnavailableError, resolveLinearApiKey };

export interface LinearEvidenceMetadata {
  linear_project_id: string;
  linear_issue_id?: string;
  linear_document_id?: string;
  attachment_id?: string;
  type:
    | "original"
    | "verified_transcript"
    | "ocr_transcript"
    | "accompanying_record"
    | "derived_summary";
}

/**
 * Načíta prípustné textové dôkazy z povoleného Linear projektu.
 * Framework dokument 00A a neprípustné záznamy sa nevrátia ako skutkový dôkaz.
 */
export async function fetchLinearEvidence(
  apiKey: string
): Promise<(ForensicSourceDocument & { linearMeta: LinearEvidenceMetadata })[]> {
  if (!apiKey) {
    throw new LinearUnavailableError("Chýba LINEAR_API_KEY na serveri.");
  }

  const projectId = resolveLinearProjectId();
  const catalog = await loadLinearCatalog({ apiKey, projectId });

  const evidenceList: (ForensicSourceDocument & {
    linearMeta: LinearEvidenceMetadata;
  })[] = [];

  for (const source of catalog.sources) {
    if (source.is_framework) continue;
    if (!source.admissible) continue;
    if (source.text.trim().length < 20) continue;

    const type: LinearEvidenceMetadata["type"] =
      source.source_kind === "original_attachment"
        ? "original"
        : source.source_kind === "verified_transcript"
          ? "verified_transcript"
          : source.source_kind === "working_ocr"
            ? "ocr_transcript"
            : source.source_kind === "derived_index"
              ? "derived_summary"
              : "accompanying_record";

    evidenceList.push({
      name: source.title,
      mime: "text/plain",
      bytes: new TextEncoder().encode(source.text).buffer as ArrayBuffer,
      text: source.text,
      linearMeta: {
        linear_project_id: source.linear_project_id,
        linear_issue_id: source.linear_issue_id ?? undefined,
        linear_document_id: source.linear_document_id ?? undefined,
        attachment_id: source.attachment_id ?? undefined,
        type,
      },
    });
  }

  return evidenceList;
}
