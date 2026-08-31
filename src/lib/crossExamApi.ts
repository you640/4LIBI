import type { Contradiction, CrossExamQuestion } from "../types";
import {
  buildLocalCrossExamQuestions,
  generateCrossExamWithMistral,
} from "./crossExamination";
import { apiFetch } from "./apiFetch";
import { logAction } from "./auditLog";

export type CrossExamSource = "mistral" | "local";

export interface CrossExamResponse {
  questions: CrossExamQuestion[];
  source: CrossExamSource;
}

export function auditCrossExam(details: {
  caseId?: string;
  eventId?: string;
  source: CrossExamSource;
  count: number;
}) {
  logAction("cross_exam", details);
}

/** Prefer server (MISTRAL_API_KEY); fall back to local templates. */
export async function requestCrossExam(options: {
  contradictions: Contradiction[];
  contextText: string;
  mode?: "mild" | "aggressive" | "alibi";
  caseId?: string;
  eventId?: string;
}): Promise<CrossExamResponse> {
  const mode = options.mode || "alibi";

  if (typeof fetch === "function") {
    try {
      const res = await apiFetch("/api/cross-exam", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contradictions: options.contradictions,
          contextText: options.contextText,
          mode,
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as {
          questions?: CrossExamQuestion[];
          source?: CrossExamSource;
        };
        if (data.questions && data.questions.length > 0) {
          const source = data.source || "local";
          auditCrossExam({
            caseId: options.caseId,
            eventId: options.eventId,
            source,
            count: data.questions.length,
          });
          return { questions: data.questions, source };
        }
      }
    } catch {
      /* offline */
    }
  }

  const questions = await generateCrossExamWithMistral(
    options.contradictions,
    options.contextText,
    "",
    mode
  );
  const fallback =
    questions.length > 0
      ? questions
      : buildLocalCrossExamQuestions(options.contradictions, mode);

  auditCrossExam({
    caseId: options.caseId,
    eventId: options.eventId,
    source: "local",
    count: fallback.length,
  });

  return { questions: fallback, source: "local" };
}
