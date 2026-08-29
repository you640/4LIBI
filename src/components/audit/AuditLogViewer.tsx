import { useEffect, useState } from "react";
import { fetchServerAuditLogs, type AuditEntry } from "../../lib/auditLog";

const ACTION_LABELS: Record<string, string> = {
  case_create: "Vytvorenie spisu",
  case_renamed: "Premenovanie spisu",
  alibi_check: "Geospatial alibi check",
  pdf_export: "Export protokolu",
  hitl_confirmed: "Potvrdenie rozporu (HITL)",
  hitl_dismissed: "Zamietnutie rozporu (HITL)",
  case_view: "Zobrazenie spisu",
};

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString("sk-SK", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function labelForAction(action: string): string {
  return ACTION_LABELS[action] || action;
}

interface AuditLogViewerProps {
  caseId?: string;
  limit?: number;
}

export function AuditLogViewer({ caseId, limit = 50 }: AuditLogViewerProps) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchServerAuditLogs(limit)
      .then((rows) => {
        if (cancelled) return;
        const filtered = caseId
          ? rows.filter((e) => {
              const d = e.details || {};
              return (
                d.caseId === caseId ||
                d.id === caseId ||
                (typeof d.caseId === "string" && d.caseId === caseId)
              );
            })
          : rows;
        setEntries(filtered);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [caseId, limit]);

  if (loading) {
    return (
      <p className="text-sm text-outline py-4" data-testid="audit-log-loading">
        Načítavam audit záznamy…
      </p>
    );
  }

  if (entries.length === 0) {
    return (
      <p className="text-sm text-outline text-center py-8" data-testid="audit-log-empty">
        {caseId
          ? "Pre tento spis zatiaľ nie sú audit záznamy."
          : "Zatiaľ žiadne audit záznamy."}
      </p>
    );
  }

  return (
    <section data-testid="audit-log-viewer">
      <p className="text-xs text-outline mb-3">
        Rozhodnutia ostávajú na vás — AI len navrhuje. Audit zaznamenáva export,
        alibi check a HITL akcie.
      </p>
      <ul className="space-y-2">
        {entries.map((entry) => (
          <li
            key={entry.id}
            className="m3-card-outlined p-3"
            data-testid="audit-log-entry"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="text-sm font-medium text-surface-on">
                {labelForAction(entry.action)}
              </span>
              <span className="text-[11px] text-outline flex-shrink-0">
                {formatTime(entry.timestamp)}
              </span>
            </div>
            {entry.details && Object.keys(entry.details).length > 0 && (
              <p className="text-[11px] text-outline mt-1 mb-0 font-mono break-all">
                {JSON.stringify(entry.details)}
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
