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

  const contradiction = analysis.timeline.find((e) =>
    e.tags.includes("rozpor")
  );
  const alibiEvent = analysis.timeline.find((e) => e.tags.includes("alibi"));
  const accused = analysis.persons.find((p) => p.role === "obvinený");

  const shareText = `${accused?.name || "Obvinený"} tvrdí, že bol na inom mieste — ale AI našla rozpor v spise.

${contradiction?.title || "Rozpor vo výpovedi"}

ForenzDetectiv — AI, ktorá nájde rozpor za sekundu.`;

  const handleShare = async () => {
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/20 backdrop-blur-md p-4"
      style={{ height: "100dvh" }}
      onClick={onClose}
    >
      <div
        ref={cardRef}
        className="glass rounded-3xl overflow-hidden max-w-sm w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 pb-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertIcon className="w-5 h-5 text-danger" />
            <span className="text-xs font-semibold text-danger uppercase tracking-wide">
              Alibi Impossible
            </span>
          </div>
          <h2 className="text-lg font-semibold text-stone-800 leading-tight tracking-tight">
            {accused?.name || "Obvinený"} tvrdí, že bol inde.
          </h2>
          <p className="text-sm text-stone-500 mt-1">AI našla rozpor v spise.</p>
        </div>

        {contradiction && (
          <div className="px-5 pb-4">
            <div className="rounded-xl bg-white/50 p-4 mb-3">
              <p className="text-[10px] uppercase tracking-wide text-danger font-semibold mb-1">
                Rozpor
              </p>
              <p className="text-sm text-stone-800 font-medium mb-2">
                {contradiction.title}
              </p>
              <p className="text-xs text-stone-500 leading-relaxed">
                {contradiction.description}
              </p>
              {contradiction.source_text && (
                <p className="text-[11px] text-stone-400 italic mt-2">
                  „{contradiction.source_text}"
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-white/50 p-3">
                <p className="text-[10px] uppercase tracking-wide text-accent font-semibold mb-1">
                  Alibi
                </p>
                <p className="text-xs text-stone-600">
                  {alibiEvent?.title || "Bol inde"}
                </p>
              </div>
              <div className="rounded-xl bg-white/50 p-3">
                <p className="text-[10px] uppercase tracking-wide text-danger font-semibold mb-1">
                  Fakt
                </p>
                <p className="text-xs text-stone-600">{contradiction.title}</p>
              </div>
            </div>
          </div>
        )}

        <div className="px-5 pb-5">
          <p className="text-[11px] text-stone-400 mb-4">ForenzDetectiv</p>
          <button
            onClick={handleShare}
            className="btn-primary flex items-center justify-center gap-2 mb-2"
          >
            {copied ? (
              <>
                <CheckIcon className="w-5 h-5" />
                Skopírované
              </>
            ) : (
              "Zdieľať"
            )}
          </button>
          <button onClick={onClose} className="btn-secondary">
            Zavrieť
          </button>
        </div>
      </div>
    </div>
  );
}
