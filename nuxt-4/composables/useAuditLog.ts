// useAuditLog.ts — Nuxt 4 composable pre forenzný audit log
// Chain of Custody — zaznamenáva kto, čo, kedy.
// Akcie: case_created, contradiction_viewed, alibi_checked, pdf_exported.

interface AuditEntry {
  id: string
  action: string
  userId?: string
  timestamp: number
  details?: Record<string, any>
}

const STORAGE_KEY = 'forenz_audit_log'

function loadLog(): AuditEntry[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  } catch {
    return []
  }
}

function saveLog(entries: AuditEntry[]): void {
  if (typeof window === 'undefined') return
  const trimmed = entries.slice(-100)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed))
}

function sanitizeDetails(details: Record<string, any>): Record<string, any> {
  const sanitized: Record<string, any> = {}
  const sensitive = ['email', 'phone', 'password', 'name']
  for (const [key, value] of Object.entries(details)) {
    if (sensitive.some((s) => key.toLowerCase().includes(s))) {
      sanitized[key] = '[REDACTED]'
    } else {
      sanitized[key] = value
    }
  }
  return sanitized
}

export function useAuditLog() {
  function logAction(action: string, details?: Record<string, any>): void {
    const entry: AuditEntry = {
      id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      action,
      timestamp: Date.now(),
      details: details ? sanitizeDetails(details) : undefined,
    }
    const log = loadLog()
    log.push(entry)
    saveLog(log)
    console.log(`[Audit] ${action}`, entry)
  }

  function getAuditLog(): AuditEntry[] {
    return loadLog().sort((a, b) => b.timestamp - a.timestamp)
  }

  function clearAuditLog(): void {
    if (typeof window === 'undefined') return
    localStorage.removeItem(STORAGE_KEY)
  }

  // Špecifické helpery pre kritické akcie (Chain of Custody)
  function auditCaseCreate(details: { fileCount: number; source: string }) {
    logAction('case_created', details)
  }

  function auditContradictionViewed(details: { contradictionId?: string }) {
    logAction('contradiction_viewed', details)
  }

  function auditAlibiCheck(details: { caseId?: string; result: string }) {
    logAction('alibi_checked', details)
  }

  function auditPdfExport(details: { format: string; caseId?: string }) {
    logAction('pdf_exported', details)
  }

  return {
    logAction,
    getAuditLog,
    clearAuditLog,
    auditCaseCreate,
    auditContradictionViewed,
    auditAlibiCheck,
    auditPdfExport,
  }
}
