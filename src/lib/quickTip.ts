export const QUICK_TIP_STORAGE_KEY = "forenz_quick_tip_seen";

export function hasSeenQuickTip(): boolean {
  if (typeof localStorage === "undefined") return true;
  return localStorage.getItem(QUICK_TIP_STORAGE_KEY) === "1";
}

export function markQuickTipSeen(): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(QUICK_TIP_STORAGE_KEY, "1");
}
