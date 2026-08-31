import { apiFetch } from "./apiFetch";

export type HitlStatus = "open" | "confirmed" | "dismissed";

function key(analysisId: string, eventId: string): string {
  return `contradiction-status:${analysisId}:${eventId}`;
}

function getStorage(): Storage | null {
  if (typeof localStorage !== "undefined") return localStorage;
  if (typeof globalThis !== "undefined" && "localStorage" in globalThis) {
    return (globalThis as unknown as { localStorage: Storage }).localStorage;
  }
  return null;
}

export function getHitlStatus(analysisId: string, eventId: string): HitlStatus {
  try {
    const storage = getStorage();
    const raw = storage?.getItem(key(analysisId, eventId));
    if (raw === "confirmed" || raw === "dismissed" || raw === "open") return raw;
  } catch {
    /* ignore */
  }
  return "open";
}

export function setHitlStatus(
  analysisId: string,
  eventId: string,
  status: HitlStatus
): void {
  try {
    const storage = getStorage();
    storage?.setItem(key(analysisId, eventId), status);
  } catch {
    /* ignore */
  }

  // Asynchrónna synchronizácia do PostgreSQL (iba v browser prostredí)
  if (typeof window !== "undefined" && analysisId) {
    apiFetch(`/api/analyses/${encodeURIComponent(analysisId)}/hitl`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId, status }),
    }).catch((err) => {
      console.warn("[HITL] Server sync warning:", err);
    });
  }
}

export async function syncHitlFromServer(analysisId: string): Promise<Record<string, HitlStatus>> {
  if (typeof window === "undefined" || !analysisId) return {};

  try {
    const res = await apiFetch(`/api/analyses/${encodeURIComponent(analysisId)}/hitl`);
    if (!res.ok) return {};
    const data = await res.json();
    if (data && data.statuses && typeof data.statuses === "object") {
      const storage = getStorage();
      for (const [eventId, status] of Object.entries(data.statuses)) {
        if (status === "confirmed" || status === "dismissed" || status === "open") {
          storage?.setItem(key(analysisId, eventId), status as HitlStatus);
        }
      }
      return data.statuses;
    }
  } catch (err) {
    console.warn("[HITL] Failed to fetch server statuses:", err);
  }
  return {};
}

export function getAllHitlForAnalysis(
  analysisId: string,
  eventIds: string[]
): Record<string, HitlStatus> {
  const out: Record<string, HitlStatus> = {};
  for (const id of eventIds) {
    out[id] = getHitlStatus(analysisId, id);
  }
  return out;
}
