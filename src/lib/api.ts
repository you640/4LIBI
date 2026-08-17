import type { Analysis } from "../types";

export type AnalysisSummary = {
  id: string;
  name: string;
  status: string;
  createdAt: string;
};

export type AnalysisRecord = AnalysisSummary & {
  data: Analysis | null;
  errorMessage?: string | null;
};

async function readApiError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: unknown };
    if (typeof body.error === "string" && body.error.trim()) {
      return body.error;
    }
  } catch {
    /* ignore non-JSON errors */
  }
  return `HTTP ${res.status}`;
}

export async function analyzeViaApi(files: File[]): Promise<AnalysisRecord> {
  const form = new FormData();
  for (const file of files) {
    form.append("files", file);
  }

  const res = await fetch("/api/analyze", { method: "POST", body: form });
  if (!res.ok) {
    throw new Error(await readApiError(res));
  }
  return (await res.json()) as AnalysisRecord;
}

export async function listAnalyses(): Promise<AnalysisSummary[]> {
  const res = await fetch("/api/analyses");
  if (!res.ok) {
    throw new Error(await readApiError(res));
  }
  return (await res.json()) as AnalysisSummary[];
}

export async function getAnalysis(id: string): Promise<AnalysisRecord> {
  const res = await fetch(`/api/analyses/${encodeURIComponent(id)}`);
  if (!res.ok) {
    throw new Error(await readApiError(res));
  }
  return (await res.json()) as AnalysisRecord;
}
