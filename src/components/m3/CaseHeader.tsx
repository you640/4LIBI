import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Analysis } from "../../types";
import {
  contradictionEvents,
  formatCaseDate,
  riskLabel,
  riskScore,
} from "../../lib/caseUtils";
import { PdfExportDialog } from "../case/PdfExportDialog";

interface CaseHeaderProps {
  analysis: Analysis;
  analysisId: string;
}

export function CaseHeader({ analysis, analysisId }: CaseHeaderProps) {
  const navigate = useNavigate();
  const [exportOpen, setExportOpen] = useState(false);
  const score = riskScore(analysis);
  const contradictions = contradictionEvents(analysis).length;
  const label = riskLabel(score);

  return (
    <>
      <div className="m3-case-header px-4 pb-3.5 pt-2.5 border-b border-outline-variant bg-surface">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-outline mb-1">
          Vyšetrovací spis
        </p>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold text-surface-on truncate leading-snug">
              {analysis.metadata.document_name}
            </h2>
            <p className="text-[11px] text-outline mt-0.5">
              {formatCaseDate(analysis.metadata.upload_date)}
            </p>
          </div>
          <div className="flex-shrink-0 text-center px-2.5 py-1.5 rounded-lg bg-error-container text-error-on-container border border-error/15">
            <span className="block text-base font-bold leading-none">{score}</span>
            <span className="text-[9.5px] font-semibold uppercase tracking-tight">{label}</span>
          </div>
        </div>

        <p
          className="text-[11px] text-outline mt-2 mb-0 italic"
          data-testid="trust-disclaimer"
        >
          Rozhodnutia ostávajú na vás — AI len navrhuje.
        </p>

        <div className="flex gap-1.5 mt-2.5 flex-wrap">
          <button
            type="button"
            className="px-3 py-1.5 rounded-md text-xs font-semibold bg-primary text-primary-on border-0 hover:bg-blue-800 transition-colors shadow-xs"
            data-testid="case-otazky-btn"
            onClick={() => navigate(`/spisy/${analysisId}/otazky`)}
          >
            Tri otázky
          </button>
          <button
            type="button"
            className="px-3 py-1.5 rounded-md text-xs font-semibold bg-primary-container text-primary-on-container border border-primary/20 hover:bg-blue-100 transition-colors"
            data-testid="case-export-btn"
            onClick={() => setExportOpen(true)}
          >
            Export protokolu
          </button>
          <button
            type="button"
            className="px-3 py-1.5 rounded-md text-xs font-medium bg-surface-lowest border border-outline-variant text-surface-on hover:bg-surface-low transition-colors"
            data-testid="case-audit-btn"
            onClick={() => navigate(`/spisy/${analysisId}/audit`)}
          >
            Audit
          </button>
        </div>

        <div className="grid grid-cols-4 gap-1.5 mt-3">
          {[
            { val: contradictions, lbl: "Rozpory" },
            { val: analysis.timeline.length, lbl: "Udalosti" },
            { val: analysis.persons.length, lbl: "Osoby" },
            { val: analysis.evidence.length, lbl: "Dôkazy" },
          ].map((s) => (
            <div
              key={s.lbl}
              className="text-center px-1.5 py-1.5 rounded-md bg-surface-lowest border border-outline-variant/80 shadow-xs"
            >
              <span className="block text-[13px] font-bold text-surface-on leading-none mb-0.5">{s.val}</span>
              <span className="text-[9.5px] font-medium text-outline uppercase tracking-tight">{s.lbl}</span>
            </div>
          ))}
        </div>
      </div>

      <PdfExportDialog
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        analysis={analysis}
        caseId={analysisId}
      />
    </>
  );
}
