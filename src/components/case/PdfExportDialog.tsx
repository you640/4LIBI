import { useEffect, useState } from "react";
import type { Analysis } from "../../types";
import {
  buildCourtDossierExport,
  downloadTextFile,
  openPrintableDossier,
} from "../../lib/dossierExport";
import { auditPdfExport } from "../../lib/auditLog";
import { trackPdfExported } from "../../lib/analytics";

interface PdfExportDialogProps {
  open: boolean;
  onClose: () => void;
  analysis: Analysis;
  caseId: string;
}

export function PdfExportDialog({
  open,
  onClose,
  analysis,
  caseId,
}: PdfExportDialogProps) {
  const [hash, setHash] = useState<string | null>(null);
  const [markdown, setMarkdown] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    buildCourtDossierExport(analysis)
      .then(({ markdown: md, hash: h }) => {
        if (cancelled) return;
        setMarkdown(md);
        setHash(h);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Export zlyhal.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, analysis]);

  if (!open) return null;

  const safeName = analysis.metadata.document_name
    .replace(/[^\w\s-]/g, "")
    .trim()
    .slice(0, 40);

  const handleMarkdownDownload = () => {
    auditPdfExport({ format: "markdown", caseId });
    trackPdfExported({ format: "markdown" });
    downloadTextFile(`forenz-spis-${safeName || caseId}.md`, markdown);
  };

  const handlePrint = () => {
    auditPdfExport({ format: "print", caseId });
    trackPdfExported({ format: "print" });
    openPrintableDossier(
      markdown,
      `Forenzná správa — ${analysis.metadata.document_name}`
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-stone-900/40 p-4"
      style={{ height: "100dvh" }}
      onClick={onClose}
      data-testid="pdf-export-dialog"
    >
      <div
        className="m3-card-outlined w-full max-w-md max-h-[85dvh] overflow-y-auto p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-semibold text-surface-on m-0 mb-1">
          Export súdneho protokolu
        </h3>
        <p className="text-xs text-outline mb-4">
          Markdown s SHA-256 hashom pre overenie integrity.
        </p>

        {loading && (
          <p className="text-sm text-outline" data-testid="pdf-export-loading">
            Počítam hash…
          </p>
        )}
        {error && (
          <p className="text-sm text-error mb-3">{error}</p>
        )}

        {hash && (
          <div
            className="mb-4 p-3 rounded-lg bg-surface-low border border-outline-variant"
            data-testid="pdf-export-hash"
          >
            <p className="text-[11px] text-outline m-0 mb-1">SHA-256</p>
            <p className="text-[10px] font-mono text-surface-on break-all m-0">
              {hash}
            </p>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <button
            type="button"
            className="m3-btn-filled"
            disabled={!markdown || loading}
            data-testid="pdf-export-markdown"
            onClick={handleMarkdownDownload}
          >
            Stiahnuť Markdown
          </button>
          <button
            type="button"
            className="m3-btn-outlined"
            disabled={!markdown || loading}
            data-testid="pdf-export-print"
            onClick={handlePrint}
          >
            Tlačiť / Uložiť ako PDF
          </button>
          <button type="button" className="m3-btn-text m3-btn-text-muted" onClick={onClose}>
            Zavrieť
          </button>
        </div>
      </div>
    </div>
  );
}
