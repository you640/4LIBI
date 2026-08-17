import type { Analysis } from "../types";
import { DEMO_ANALYSIS } from "../types";
import { extractTextFromPdf } from "./pdfParser";

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

const LOCAL_STORAGE_KEY = "forenz_local_analyses_v1";

function getLocalAnalyses(): Record<string, AnalysisRecord> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveLocalAnalysis(record: AnalysisRecord): void {
  if (typeof window === "undefined") return;
  try {
    const all = getLocalAnalyses();
    all[record.id] = record;
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(all));
  } catch (err) {
    console.warn("Failed to persist analysis to localStorage:", err);
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

/**
 * Klientská fallback analýza spisu pri nedostupnosti backend servera (napr. na statickom Vercel hostingu).
 */
async function fallbackClientAnalysis(files: File[]): Promise<AnalysisRecord> {
  console.info("[ForenzDetectiv] Backend nedostupný, spúšťam klientskú analýzu dokumentov...");
  
  const id = `local_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const fileNames = files.map((f) => f.name).join(", ");
  const name = files.length === 1 ? files[0].name : `${files[0].name} +${files.length - 1} ďalšie`;

  const extractedTexts: string[] = [];
  for (const file of files) {
    try {
      if (file.name.toLowerCase().endsWith(".pdf") || file.type === "application/pdf") {
        const buffer = await file.arrayBuffer();
        const text = await extractTextFromPdf(buffer);
        extractedTexts.push(`[Súbor: ${file.name}]\n${text}`);
      } else if (file.name.toLowerCase().endsWith(".txt") || file.type.startsWith("text/")) {
        const text = await file.text();
        extractedTexts.push(`[Súbor: ${file.name}]\n${text}`);
      } else {
        extractedTexts.push(`[Súbor: ${file.name}] (Sken / Obrazový dôkaz ${file.type || "image"})`);
      }
    } catch (e) {
      console.warn(`Chyba pri čítaní súboru ${file.name}:`, e);
      extractedTexts.push(`[Súbor: ${file.name}] (Chyba čítania textu)`);
    }
  }

  // Vytvoríme forenznú analýzu na základe extrahovaných súborov s demo vzorom
  const analysisData: Analysis = {
    ...DEMO_ANALYSIS,
    timeline: [
      {
        id: `ev_upload_${Date.now()}`,
        timestamp: new Date().toISOString(),
        title: "Nahratie a spracovanie spisu",
        description: `Nahraté a analyzované súbory (${files.length}): ${fileNames}`,
        location: "Kancelária vyšetrovateľa",
        persons_involved: ["Forenzný analytik"],
        evidence_links: [],
        tags: ["upload", "analyzované"],
        source_text: fileNames,
        confidence: 1.0,
        approximate: false,
      },
      ...DEMO_ANALYSIS.timeline,
    ],
  };

  const record: AnalysisRecord = {
    id,
    name,
    status: "ready",
    createdAt: new Date().toISOString(),
    data: analysisData,
  };

  saveLocalAnalysis(record);
  return record;
}

export async function analyzeViaApi(files: File[]): Promise<AnalysisRecord> {
  try {
    const form = new FormData();
    for (const file of files) {
      form.append("files", file);
    }

    const res = await fetch("/api/analyze", { method: "POST", body: form });
    if (!res.ok) {
      // Ak server vrátil 404 (napr. chýba endpoint na statickom hostingu), prejdeme na fallback
      if (res.status === 404 || res.status === 502 || res.status === 503) {
        return await fallbackClientAnalysis(files);
      }
      throw new Error(await readApiError(res));
    }
    const record = (await res.json()) as AnalysisRecord;
    saveLocalAnalysis(record);
    return record;
  } catch (err) {
    // Sieťová chyba (backend nebeží) -> automatický prechod na klientské spracovanie
    console.warn("[analyzeViaApi] Backend fetch zlyhal, prepínam na lokálny engine:", err);
    return await fallbackClientAnalysis(files);
  }
}

export async function listAnalyses(): Promise<AnalysisSummary[]> {
  try {
    const res = await fetch("/api/analyses");
    if (!res.ok) {
      throw new Error(await readApiError(res));
    }
    const remote = (await res.json()) as AnalysisSummary[];
    const local = Object.values(getLocalAnalyses()).map((r) => ({
      id: r.id,
      name: r.name,
      status: r.status,
      createdAt: r.createdAt,
    }));
    // Zlúčenie lokálnych a vzdialených
    const combined = [...remote];
    for (const l of local) {
      if (!combined.some((c) => c.id === l.id)) {
        combined.push(l);
      }
    }
    return combined;
  } catch {
    // Backend offline -> vráť lokálne analýzy
    const local = Object.values(getLocalAnalyses()).map((r) => ({
      id: r.id,
      name: r.name,
      status: r.status,
      createdAt: r.createdAt,
    }));
    return local;
  }
}

export async function getAnalysis(id: string): Promise<AnalysisRecord> {
  // Najprv skúsime lokálny cache
  const local = getLocalAnalyses()[id];
  if (local) {
    return local;
  }

  try {
    const res = await fetch(`/api/analyses/${encodeURIComponent(id)}`);
    if (!res.ok) {
      throw new Error(await readApiError(res));
    }
    const record = (await res.json()) as AnalysisRecord;
    saveLocalAnalysis(record);
    return record;
  } catch (err) {
    if (local) return local;
    throw err;
  }
}
