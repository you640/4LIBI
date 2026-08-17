export type HitlStatus = "open" | "confirmed" | "dismissed";

function key(analysisId: string, eventId: string): string {
  return `contradiction-status:${analysisId}:${eventId}`;
}

export function getHitlStatus(analysisId: string, eventId: string): HitlStatus {
  try {
    const raw = localStorage.getItem(key(analysisId, eventId));
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
    localStorage.setItem(key(analysisId, eventId), status);
  } catch {
    /* ignore */
  }
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
