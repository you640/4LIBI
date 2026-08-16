// Alibi Impossible share card (Issue S10.4 — wow funkcia)
// Virálna karta pre zdieľanie na LinkedIn / sociálne siete.
// Renderuje sa ako vizuálna karta + tlačidlo pre share / download.

import { useRef, useState } from "react";
import type { Analysis } from "../../types";
import { AlertIcon, CheckIcon } from "../Icons";

interface AlibiShareCardProps {
  analysis: Analysis;
  onClose: () => void;
}

export function AlibiShareCard({ analysis, onClose }: AlibiShareCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  // Najdi rozpor v timeline
  const contradiction = analysis.timeline.find((e) =>
    e.tags.includes("rozpor")
  );

  // Najdi alibi event
  const alibiEvent = analysis.timeline.find((e) =>
    e.tags.includes("alibi")
  );

  // Obvinený
  const accused = analysis.persons.find((p) => p.role === "obvinený");

  const shareText = `🚨 ${accused?.name || "Obvinený"} tvrdí, že bol na inom mieste — ale AI našla rozpor v spise.

${contradiction?.title || "Rozpor vo výpovedi"}

ForenzDetectiv — AI, ktorá nájde rozpor za sekundu.`;

  const handleShare = async () => {
    // Native share API (mobil)
    if (navigator.share) {
      try {
        await navigator.share({
          title: "ForenzDetectiv — Alibi Impossible",
          text: shareText,
          url: window.location.href,
        });
      } catch {
        // User zrušil share
      }
    } else {
      // Fallback — kopíruj do schránky
      try {
        await navigator.clipboard.writeText(shareText);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        console.error("Kopírovanie zlyhalo");
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
         style={{ height: "100dvh" }}
         onClick={onClose}>
      {/* Karta */}
      <div
        ref={cardRef}
        className="bg-bg-surface border border-white/10 rounded-3xl overflow-hidden max-w-sm w-full"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header — gradient */}
        <div className="bg-gradient-to-br from-danger/20 to-bg-surface p-5 pb-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-danger/20 flex items-center justify-center">
              <AlertIcon className="w-5 h-5 text-danger" />
            </div>
            <span className="text-xs font-bold text-danger uppercase tracking-wide">
              Alibi Impossible
            </span>
          </div>
          <h2 className="text-lg font-bold text-slate-100 leading-tight">
            {accused?.name || "Obvinený"} tvrdí, že bol inde.
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            AI našla rozpor v spise.
          </p>
        </div>

        {/* Rozpor */}
        {contradiction && (
          <div className="p-5">
            <div className="bg-danger/10 border border-danger/20 rounded-xl p-4 mb-3">
              <p className="text-[10px] uppercase tracking-wide text-danger font-bold mb-1">
                Rozpor
              </p>
              <p className="text-sm text-slate-100 font-medium mb-2">
                {contradiction.title}
              </p>
              <p className="text-xs text-slate-400 leading-relaxed">
                {contradiction.description}
              </p>
              {contradiction.source_text && (
                <p className="text-[11px] text-slate-500 italic mt-2">
                  „{contradiction.source_text}"
                </p>
              )}
            </div>

            {/* Alibi vs fakt */}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-accent/10 border border-accent/20 rounded-xl p-3">
                <p className="text-[10px] uppercase tracking-wide text-accent font-bold mb-1">
                  Alibi
                </p>
                <p className="text-xs text-slate-300">
                  {alibiEvent?.title || "Bol inde"}
                </p>
              </div>
              <div className="bg-danger/10 border border-danger/20 rounded-xl p-3">
                <p className="text-[10px] uppercase tracking-wide text-danger font-bold mb-1">
                  Fakt
                </p>
                <p className="text-xs text-slate-300">
                  {contradiction.title}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Footer — branding + CTA */}
        <div className="px-5 pb-5">
          <div className="flex items-center justify-between mb-4 pt-3 border-t border-white/5">
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-5 rounded bg-cta/10 flex items-center justify-center">
                <span className="text-[8px] font-bold text-cta">FD</span>
              </div>
              <span className="text-[11px] text-slate-500 font-medium">
                ForenzDetectiv
              </span>
            </div>
            <span className="text-[10px] text-slate-600">
              AI rozpory vo výpovediach
            </span>
          </div>

          {/* Tlačidlá */}
          <button
            onClick={handleShare}
            className="btn-primary flex items-center justify-center gap-2 mb-2"
          >
            {copied ? (
              <>
                <CheckIcon className="w-5 h-5" />
                Skopírované!
              </>
            ) : (
              "Zdieľať"
            )}
          </button>
          <button
            onClick={onClose}
            className="btn-secondary"
          >
            Zavrieť
          </button>
        </div>
      </div>
    </div>
  );
}
