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
      <div className="m3-case-header px-4 pb-3 pt-2 border-b border-outline-variant bg-gradient-to-b from-surface-low to-surface">
        <p className="text-[11px] font-medium uppercase tracking-wide text-outline mb-1">
          Prípad
        </p>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-surface-on truncate">
              {analysis.metadata.document_name}
            </h2>
            <p className="text-[11px] text-outline mt-1">
              {formatCaseDate(analysis.metadata.upload_date)}
            </p>
          </div>
          <div className="flex-shrink-0 text-center px-3 py-2 rounded-xl bg-error-container text-error-on-container">
            <span className="block text-lg font-bold leading-none">{score}</span>
            <span className="text-[10px] font-medium">{label}</span>
          </div>
        </div>

        <p
          className="text-[11px] text-outline mt-2 mb-0 italic"
          data-testid="trust-disclaimer"
        >
          Rozhodnutia ostávajú na vás — AI len navrhuje.
        </p>

        <div className="flex gap-2 mt-2 flex-wrap">
          <button
            type="button"
            className="px-3 py-1.5 rounded-full text-xs font-semibold bg-primary text-primary-on border-0"
            data-testid="case-otazky-btn"
            onClick={() => navigate(`/spisy/${analysisId}/otazky`)}
          >
            Tri otázky
          </button>
          <button
            type="button"
            className="px-3 py-1.5 rounded-full text-xs font-semibold bg-primary-container text-primary-on-container border-0"
            data-testid="case-export-btn"
            onClick={() => setExportOpen(true)}
          >
            Export protokolu
          </button>
          <button
            type="button"
            className="px-3 py-1.5 rounded-full text-xs font-medium bg-surface-lowest border border-outline-variant text-surface-on"
            data-testid="case-audit-btn"
            onClick={() => navigate(`/spisy/${analysisId}/audit`)}
          >
            Audit
          </button>
        </div>

        <div className="flex gap-2 mt-3 flex-wrap">
          {[
            { val: contradictions, lbl: "Rozpory" },
            { val: analysis.timeline.length, lbl: "Udalosti" },
            { val: analysis.persons.length, lbl: "Osoby" },
            { val: analysis.evidence.length, lbl: "Dôkazy" },
          ].map((s) => (
            <div
              key={s.lbl}
              className="flex-1 min-w-[68px] text-center px-2 py-2 rounded-lg bg-surface-lowest border border-outline-variant"
            >
              <span className="block text-sm font-bold text-surface-on">{s.val}</span>
              <span className="text-[10px] text-outline">{s.lbl}</span>
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
