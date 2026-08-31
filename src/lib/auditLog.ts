// Forenzný Audit Log (PostgreSQL + Local Fallback)
import { apiFetch } from "./apiFetch";
// Zaznamenáva kritické akcie: case create, alibi check, PDF export, HITL zmeny.

export interface AuditEntry {
  id: string;
  action: string;
  userId?: string;
  timestamp: number;
  details?: Record<string, unknown>;
}

interface ServerAuditLogRecord {
  id: string;
  action: string;
  userId?: string | null;
  timestamp: string | Date;
  details?: Record<string, unknown> | null;
}

const STORAGE_KEY = "forenz_audit_log";

function getStorage(): Storage | null {
  if (typeof localStorage !== "undefined") return localStorage;
  if (typeof globalThis !== "undefined" && "localStorage" in globalThis) {
    return (globalThis as unknown as { localStorage: Storage }).localStorage;
  }
  return null;
}

function loadLog(): AuditEntry[] {
  const storage = getStorage();
  if (!storage) return [];
  try {
    return JSON.parse(storage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveLog(entries: AuditEntry[]): void {
  const storage = getStorage();
  if (!storage) return;
  const trimmed = entries.slice(-200);
  storage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
}

export function logAction(
  action: string,
  details?: Record<string, unknown>,
  userId?: string
): void {
  const sanitized = details ? sanitizeDetails(details) : undefined;
  const entry: AuditEntry = {
    id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    action,
    userId,
    timestamp: Date.now(),
    details: sanitized,
  };

  const log = loadLog();
  log.push(entry);
  saveLog(log);

  // Asynchrónna perzistencia do PostgreSQL na serveri (iba v browseri)
  if (typeof window !== "undefined" && typeof fetch === "function") {
    apiFetch("/api/audit-logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        userId,
        details: sanitized,
      }),
    }).catch((err) => {
      console.warn("[Audit] Server log sync warning:", err);
    });
  }

  console.log(`[Audit] ${action}`, entry);
}

function sanitizeDetails(details: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  const sensitiveKeys = ["password", "token", "secret", "apikey"];

  for (const [key, value] of Object.entries(details)) {
    if (sensitiveKeys.some((s) => key.toLowerCase().includes(s))) {
      sanitized[key] = "[REDACTED]";
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

export function getAuditLog(): AuditEntry[] {
  const log = loadLog();
  // Vráť v reverznom poradí (najnovšie záznamy prvé)
  return log.slice().reverse();
}

export async function fetchServerAuditLogs(limit = 100): Promise<AuditEntry[]> {
  if (typeof window === "undefined" || typeof fetch === "undefined") return getAuditLog();
  try {
    const res = await apiFetch(`/api/audit-logs?limit=${limit}`);
    if (!res.ok) return getAuditLog();
    const data = (await res.json()) as { logs?: ServerAuditLogRecord[] };
    if (data && Array.isArray(data.logs)) {
      return data.logs.map((l: ServerAuditLogRecord) => ({
        id: l.id,
        action: l.action,
        userId: l.userId || undefined,
        timestamp: new Date(l.timestamp).getTime(),
        details: l.details || undefined,
      }));
    }
  } catch (err) {
    console.warn("[Audit] Failed to fetch server audit logs:", err);
  }
  return getAuditLog();
}

export function clearAuditLog(): void {
  const storage = getStorage();
  if (!storage) return;
  storage.removeItem(STORAGE_KEY);
}

export function auditCaseCreate(details: { fileCount: number; source: string }) {
  logAction("case_create", details);
}

export function auditAlibiCheck(details: {
  caseId?: string;
  result: string;
  locA?: string;
  locB?: string;
}) {
  logAction("alibi_check", details);
}

export function auditHitlChange(details: {
  caseId: string;
  eventId: string;
  status: "confirmed" | "dismissed";
}) {
  logAction(`hitl_${details.status}`, details);
}

export function auditPdfExport(details: { format: string; caseId?: string }) {
  logAction("pdf_export", details);
}
