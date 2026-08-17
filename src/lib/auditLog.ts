// Audit log v2 (Issue #5 — S1.5)
// useAuditStore — zaznamenáva kritické akcie: case create, alibi check, PDF export.
// LEA compliance — kto, čo, kedy.

interface AuditEntry {
  id: string;
  action: string;
  userId?: string;
  timestamp: number;
  details?: Record<string, any>;
}

const STORAGE_KEY = "forenz_audit_log";

// Načítaj audit log z localStorage
function loadLog(): AuditEntry[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

// Ulož audit log do localStorage
function saveLog(entries: AuditEntry[]): void {
  if (typeof window === "undefined") return;
  // Uchovaj len posledných 100 záznamov
  const trimmed = entries.slice(-100);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
}

// S1.5.1 — logAction() — zaznamená akciu
export function logAction(
  action: string,
  details?: Record<string, any>
): void {
  const entry: AuditEntry = {
    id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    action,
    timestamp: Date.now(),
    details: details ? sanitizeDetails(details) : undefined,
  };

  const log = loadLog();
  log.push(entry);
  saveLog(log);

  console.log(`[Audit] ${action}`, entry);
}

// PII sanitizácia pre audit log
function sanitizeDetails(details: Record<string, any>): Record<string, any> {
  const sanitized: Record<string, any> = {};
  const sensitiveKeys = ["email", "phone", "password", "name"];

  for (const [key, value] of Object.entries(details)) {
    if (sensitiveKeys.some((s) => key.toLowerCase().includes(s))) {
      sanitized[key] = "[REDACTED]";
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

// Získaj všetky audit záznamy
export function getAuditLog(): AuditEntry[] {
  return loadLog().sort((a, b) => b.timestamp - a.timestamp);
}

// Vyčistí audit log
export function clearAuditLog(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

// Špecifické helpery pre kritické akcie
export function auditCaseCreate(details: { fileCount: number; source: string }) {
  logAction("case_create", details);
}

export function auditAlibiCheck(details: { caseId?: string; result: string }) {
  logAction("alibi_check", details);
}

export function auditPdfExport(details: { format: string; caseId?: string }) {
  logAction("pdf_export", details);
}
