import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useCaseContext } from "../../lib/caseContext";
import { formatEventTime, resolveEventPage } from "../../lib/caseUtils";
import { PageBadge } from "./PageBadge";

export function TimelineTab() {
  const { analysis, analysisId, search } = useCaseContext();
  const navigate = useNavigate();

  const events = useMemo(() => {
    const sorted = [...analysis.timeline].sort((a, b) => {
      if (!a.timestamp) return 1;
      if (!b.timestamp) return -1;
      return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
    });
    if (!search.trim()) return sorted;
    const q = search.toLowerCase();
    return sorted.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q) ||
        e.source_text.toLowerCase().includes(q)
    );
  }, [analysis.timeline, search]);

  return (
    <div className="pb-4">
      <p className="text-sm text-outline mb-4">
        Geopriestorová časová os — klik na rozpor otvorí kartu
      </p>
      <div className="relative pl-7">
        <div className="absolute left-[7px] top-2 bottom-2 w-0.5 bg-outline-variant" />
        {events.map((event) => {
          const conflict = event.tags.includes("rozpor");
          return (
            <button
              key={event.id}
              type="button"
              className="relative block w-full text-left mb-5 bg-transparent border-0 p-0"
              onClick={() => {
                if (conflict) navigate(`/spisy/${analysisId}/rozpory`);
              }}
            >
              <span
                className={`absolute -left-7 top-1 w-4 h-4 rounded-full border-[3px] border-surface ${
                  conflict ? "bg-error" : "bg-primary"
                }`}
                style={{
                  boxShadow: conflict
                    ? "0 0 0 2px var(--md-sys-color-error-container)"
                    : "0 0 0 2px var(--md-sys-color-primary-container)",
                }}
              />
              <p className="text-[11px] text-outline m-0 mb-1 flex items-center gap-2 flex-wrap">
                {formatEventTime(event.timestamp)}
                {event.location ? ` · ${event.location}` : ""}
                <PageBadge page={resolveEventPage(event)} />
              </p>
              <h3 className="text-base font-semibold m-0 mb-1 text-surface-on">
                {event.title}
              </h3>
              <p className="text-sm text-surface-on m-0">{event.description}</p>
              {conflict && (
                <div className="mt-2 p-3 rounded-xl bg-surface-container border border-outline-variant text-sm">
                  <strong className="block mb-1">Konflikt alibi</strong>
                  {event.source_text}
                  <span className="block mt-2 text-lg font-bold text-error">
                    Spoľahlivosť {(event.confidence * 100).toFixed(0)}%
                  </span>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
