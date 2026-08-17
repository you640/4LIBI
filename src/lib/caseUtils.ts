import type { Analysis, TimelineEvent } from "../types";

export function isContradiction(event: TimelineEvent): boolean {
  if (!event) return false;

  // 1. Tagy (case-insensitive)
  const hasTag = (event.tags || []).some((t) => {
    const norm = t.toLowerCase().trim();
    return (
      norm === "rozpor" ||
      norm === "alibi" ||
      norm === "alibi_konflikt" ||
      norm.includes("rozpor") ||
      norm.includes("konflikt")
    );
  });
  if (hasTag) return true;

  // 2. Kľúčové slová v popise alebo názve
  const combinedText = `${event.title || ""} ${event.description || ""}`.toLowerCase();
  if (
    combinedText.includes("nesúlad") ||
    combinedText.includes("odporuje") ||
    combinedText.includes("rozpor") ||
    combinedText.includes("nemožné alibi") ||
    combinedText.includes("konflikt")
  ) {
    return true;
  }

  return false;
}

export function contradictionEvents(analysis: Analysis): TimelineEvent[] {
  if (!analysis || !Array.isArray(analysis.timeline)) return [];
  return analysis.timeline.filter(isContradiction);
}

export function riskScore(analysis: Analysis): number {
  const n = contradictionEvents(analysis).length;
  if (n === 0) return 18;
  return Math.min(98, 40 + n * 18);
}

export function riskLabel(score: number): string {
  if (score >= 70) return "VYSOKÉ";
  if (score >= 40) return "STREDNÉ";
  return "NÍZKE";
}

export function formatCaseDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("sk-SK", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatEventTime(iso: string | null): string {
  if (!iso) return "Neznámy čas";
  return new Date(iso).toLocaleString("sk-SK", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const LAST_CASE_KEY = "alibi:last-case-id";

export function rememberLastCaseId(id: string): void {
  try {
    localStorage.setItem(LAST_CASE_KEY, id);
  } catch {
    /* ignore */
  }
}

export function getLastCaseId(): string | null {
  try {
    return localStorage.getItem(LAST_CASE_KEY);
  } catch {
    return null;
  }
}
