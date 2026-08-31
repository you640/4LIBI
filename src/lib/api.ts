import type { Analysis } from "../types";
import { apiPath } from "./apiBase";
import { storage, type StoredAnalysis } from "./db";

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

export type AnalysisProgressUpdate = {
  status: string;
  message: string;
  progress?: number;
};

export type AnalyzeViaApiOptions = {
  onProgress?: (update: AnalysisProgressUpdate) => void;
};

const ANALYSIS_POLL_INTERVAL_MS = 1500;
const ANALYSIS_TIMEOUT_MS = 10 * 60 * 1000;

function toAnalysisRecord(row: StoredAnalysis): AnalysisRecord {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    createdAt: row.createdAt,
    data: (row.data as Analysis | null) ?? null,
    errorMessage: row.errorMessage ?? null,
  };
}

async function getLocalAnalysesMap(): Promise<Record<string, AnalysisRecord>> {
  if (typeof window === "undefined") return {};
  try {
    const rows = await storage.getAllAnalyses();
    const map: Record<string, AnalysisRecord> = {};
    for (const row of rows) {
      map[row.id] = toAnalysisRecord(row);
    }
    return map;
  } catch (err) {
    console.warn("Failed to read analyses from IndexedDB:", err);
    return {};
  }
}

async function saveLocalAnalysis(record: AnalysisRecord): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    await storage.saveAnalysis(record.id, {
      id: record.id,
      name: record.name,
      status: record.status,
      createdAt: record.createdAt,
      data: record.data,
      errorMessage: record.errorMessage ?? null,
    });
  } catch (err) {
    console.warn("Failed to persist analysis to IndexedDB:", err);
  }
}

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

function isPendingStatus(status: string): boolean {
  return status === "queued" || status === "processing" || status === "analyzing";
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForAnalysis(
  id: string,
  onProgress?: (update: AnalysisProgressUpdate) => void
): Promise<AnalysisRecord> {
  const deadline = Date.now() + ANALYSIS_TIMEOUT_MS;

  while (Date.now() < deadline) {
    try {
      const progRes = await fetch(
        apiPath(`/api/analyses/${encodeURIComponent(id)}/progress`)
      );
      if (progRes.ok) {
        const prog = (await progRes.json()) as {
          status?: string;
          progress?: { message?: string; progress?: number } | number;
        };
        const nested = prog.progress;
        const message =
          typeof nested === "object" && nested?.message
            ? nested.message
            : prog.status === "queued"
              ? "Analýza vo fronte…"
              : "Analyzujem spis…";
        const progressPct =
          typeof nested === "object" && typeof nested.progress === "number"
            ? nested.progress
            : typeof nested === "number"
              ? nested
              : undefined;
        onProgress?.({
          status: prog.status || "processing",
          message,
          progress: progressPct,
        });
      }
    } catch {
      /* progress endpoint optional */
    }

    const res = await fetch(apiPath(`/api/analyses/${encodeURIComponent(id)}`));
    if (!res.ok) {
      throw new Error(await readApiError(res));
    }

    const record = (await res.json()) as AnalysisRecord;
    if (record.status === "ready") {
      if (!record.data) {
        throw new Error("Dokončená analýza neobsahuje výsledné dáta.");
      }
      return record;
    }
    if (record.status === "error") {
      throw new Error(record.errorMessage || "Analýza zlyhala.");
    }
    if (!isPendingStatus(record.status)) {
      throw new Error(`Neznámy stav analýzy: ${record.status}`);
    }

    await wait(ANALYSIS_POLL_INTERVAL_MS);
  }

  throw new Error("Analýza prekročila časový limit 10 minút.");
}

/**
 * Klientská fallback analýza spisu pri nedostupnosti backend servera (napr. na statickom Vercel hostingu).
 */
async function fallbackClientAnalysis(_files: File[]): Promise<AnalysisRecord> {
  throw new Error(
    "API je nedostupné. Sherlock analýza vyžaduje bežiaci Hono server (port 5176) s Postgres a Redis. Prázdny lokálny výsledok sa nepovažuje za úspech."
  );
}

export async function analyzeViaApi(
  files: File[],
  options?: AnalyzeViaApiOptions
): Promise<AnalysisRecord> {
  let res: Response;

  options?.onProgress?.({ status: "uploading", message: "Nahrávam dokumenty…" });

  try {
    const form = new FormData();
    for (const file of files) {
      form.append("files", file);
    }

    res = await fetch(apiPath("/api/analyze"), { method: "POST", body: form });
  } catch (err) {
    console.warn("[analyzeViaApi] Backend fetch zlyhal:", err);
    return await fallbackClientAnalysis(files);
  }

  // Statický Vercel frontend / proxy bez Hono API — nie je to úspešná Sherlock analýza.
  if (res.status === 404 || res.status === 502 || res.status === 503) {
    return await fallbackClientAnalysis(files);
  }
  if (!res.ok) {
    throw new Error(await readApiError(res));
  }

  const initialRecord = (await res.json()) as AnalysisRecord;
  if (isPendingStatus(initialRecord.status)) {
    options?.onProgress?.({
      status: initialRecord.status,
      message:
        initialRecord.status === "queued"
          ? "Analýza zaradená do fronty…"
          : "Analyzujem spis…",
    });
  }

  const record = isPendingStatus(initialRecord.status)
    ? await waitForAnalysis(initialRecord.id, options?.onProgress)
    : initialRecord;

  if (!record.data) {
    throw new Error("Server nevrátil dáta analýzy.");
  }
  await saveLocalAnalysis(record);
  return record;
}


export type LinearStatusResponse = {
  configured: boolean;
  reachable: boolean;
  project_id: string;
  project_name: string | null;
  issue_count: number | null;
  document_count: number | null;
  admissible_count: number | null;
  error: string | null;
};

export async function getLinearStatus(): Promise<LinearStatusResponse> {
  const res = await fetch(apiPath("/api/linear/status"));
  if (!res.ok) {
    throw new Error(await readApiError(res));
  }
  return (await res.json()) as LinearStatusResponse;
}

export async function analyzeLinearViaApi(
  options?: AnalyzeViaApiOptions
): Promise<AnalysisRecord> {
  options?.onProgress?.({
    status: "uploading",
    message: "Načítavam dôkazy z Linear projektu…",
  });
  let res: Response;
  try {
    res = await fetch(apiPath("/api/analyses/linear"), { method: "POST" });
  } catch (err) {
    console.warn("[analyzeLinearViaApi] Backend fetch zlyhal:", err);
    throw new Error(
      "Linear projekt sa nepodarilo načítať. Analýza troch vyšetrovacích otázok je zastavená."
    );
  }
  if (res.status === 503) {
    throw new Error(await readApiError(res));
  }
  if (!res.ok) {
    throw new Error(await readApiError(res));
  }
  const initialRecord = (await res.json()) as AnalysisRecord;
  if (isPendingStatus(initialRecord.status)) {
    options?.onProgress?.({
      status: initialRecord.status,
      message: "Linear dôkazy zaradené do forenznej analýzy…",
    });
  }
  const record = isPendingStatus(initialRecord.status)
    ? await waitForAnalysis(initialRecord.id, options?.onProgress)
    : initialRecord;
  if (!record.data) {
    throw new Error("Server nevrátil dáta analýzy.");
  }
  await saveLocalAnalysis(record);
  return record;
}

export async function listAnalyses(): Promise<AnalysisSummary[]> {
  try {
    const res = await fetch(apiPath("/api/analyses"));
    if (!res.ok) {
      throw new Error(await readApiError(res));
    }
    const remote = (await res.json()) as AnalysisSummary[];
    const localMap = await getLocalAnalysesMap();
    const local = Object.values(localMap).map((r) => ({
      id: r.id,
      name: r.name,
      status: r.status,
      createdAt: r.createdAt,
    }));
    const combined = [...remote];
    for (const l of local) {
      if (!combined.some((c) => c.id === l.id)) {
        combined.push(l);
      }
    }
    return combined;
  } catch {
    const localMap = await getLocalAnalysesMap();
    return Object.values(localMap).map((r) => ({
      id: r.id,
      name: r.name,
      status: r.status,
      createdAt: r.createdAt,
    }));
  }
}

export async function getAnalysis(id: string): Promise<AnalysisRecord> {
  const localMap = await getLocalAnalysesMap();
  const local = localMap[id];
  if (local) {
    return local;
  }

  try {
    const res = await fetch(apiPath(`/api/analyses/${encodeURIComponent(id)}`));
    if (!res.ok) {
      throw new Error(await readApiError(res));
    }
    const record = (await res.json()) as AnalysisRecord;
    await saveLocalAnalysis(record);
    return record;
  } catch (err) {
    if (local) return local;
    throw err;
  }
}

export async function deleteLocalAnalysis(id: string): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    await storage.deleteAnalysis(id);
    if (localStorage.getItem("forenz_last_case_id") === id) {
      localStorage.removeItem("forenz_last_case_id");
    }
  } catch (err) {
    console.warn("Failed to delete local analysis:", err);
  }
}

export async function clearAllLocalAnalyses(): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    await storage.clearAll();
    localStorage.removeItem("forenz_last_case_id");
    localStorage.removeItem("forenz_audit_logs_v1");
  } catch (err) {
    console.warn("Failed to clear local analyses:", err);
  }
}

export async function renameAnalysis(id: string, name: string): Promise<AnalysisSummary> {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("Názov spisu nemôže byť prázdny.");
  }

  const localMap = await getLocalAnalysesMap();
  const local = localMap[id];
  if (local) {
    await saveLocalAnalysis({ ...local, name: trimmed });
  }

  try {
    const res = await fetch(apiPath(`/api/analyses/${encodeURIComponent(id)}`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmed }),
    });
    if (!res.ok) {
      throw new Error(await readApiError(res));
    }
    return (await res.json()) as AnalysisSummary;
  } catch (err) {
    if (local) {
      return {
        id: local.id,
        name: trimmed,
        status: local.status,
        createdAt: local.createdAt,
      };
    }
    throw err;
  }
}

export async function deleteAnalysis(id: string): Promise<void> {
  await deleteLocalAnalysis(id);
  try {
    const res = await fetch(apiPath(`/api/analyses/${encodeURIComponent(id)}`), {
      method: "DELETE",
    });
    if (!res.ok && res.status !== 404) {
      console.warn("Failed to delete remote analysis:", await readApiError(res));
    }
  } catch (err) {
    console.warn("Server delete call failed (offline or static):", err);
  }
}

export async function deleteAllAnalyses(): Promise<void> {
  await clearAllLocalAnalyses();
  try {
    const res = await fetch(apiPath("/api/analyses"), {
      method: "DELETE",
    });
    if (!res.ok && res.status !== 404) {
      console.warn("Failed to delete all remote analyses:", await readApiError(res));
    }
  } catch (err) {
    console.warn("Server delete all call failed (offline or static):", err);
  }
}
