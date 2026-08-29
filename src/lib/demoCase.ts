import { DEMO_ANALYSIS, type Analysis } from "../types";

/** Stable route id for the offline BA-KE demo spis. */
export const DEMO_CASE_ID = "demo";

export const DEMO_LOADING_MS = 1500;

export const QUICK_TIP_STORAGE_KEY = "forenz_quick_tip_seen";

export function isDemoCaseId(id: string | undefined): boolean {
  return id === DEMO_CASE_ID;
}

export function getDemoAnalysis(): Analysis {
  return DEMO_ANALYSIS;
}

export function getDemoContradictionCount(): number {
  return DEMO_ANALYSIS.timeline.filter((e) =>
    (e.tags || []).some((t) => t.toLowerCase().includes("rozpor"))
  ).length;
}

export function hasSeenQuickTip(): boolean {
  if (typeof localStorage === "undefined") return true;
  return localStorage.getItem(QUICK_TIP_STORAGE_KEY) === "1";
}

export function markQuickTipSeen(): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(QUICK_TIP_STORAGE_KEY, "1");
}
