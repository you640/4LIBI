import { useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { useCaseContext } from "../../lib/caseContext";
import { contradictionEvents } from "../../lib/caseUtils";
import {
  getHitlStatus,
  setHitlStatus,
  type HitlStatus,
} from "../../lib/hitlStorage";
import { BottomSheet } from "../m3/BottomSheet";
import type { CaseOutletContext } from "../../pages/CaseLayout";
import type { TimelineEvent } from "../../types";

type Filter = "all" | "critical" | "confirmed" | "dismissed";

function severity(event: TimelineEvent): "high" | "medium" {
  return event.confidence >= 0.85 ? "high" : "medium";
}

export function RozporyTab() {
  const { analysis, analysisId, search } = useCaseContext();
  const { bumpHitl } = useOutletContext<CaseOutletContext>();
  const [filter, setFilter] = useState<Filter>("all");
  const [sheetEvent, setSheetEvent] = useState<TimelineEvent | null>(null);
  const [, setTick] = useState(0);

  const events = useMemo(() => contradictionEvents(analysis), [analysis]);

  const refresh = () => {
    setTick((n) => n + 1);
    bumpHitl();
  };

  const visible = events.filter((e) => {
    const status = getHitlStatus(analysisId, e.id);
    const sev = severity(e);
    if (filter === "critical") return status === "open" && sev === "high";
    if (filter === "confirmed") return status === "confirmed";
    if (filter === "dismissed") return status === "dismissed";
    return true;
  }).filter((e) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      e.title.toLowerCase().includes(q) ||
      e.description.toLowerCase().includes(q) ||
      e.source_text.toLowerCase().includes(q) ||
      (e.location || "").toLowerCase().includes(q)
    );
  });

  const openCount = events.filter(
    (e) => getHitlStatus(analysisId, e.id) === "open" && severity(e) === "high"
  ).length;

  const setStatus = (eventId: string, status: HitlStatus) => {
    setHitlStatus(analysisId, eventId, status);
    if (navigator.vibrate) navigator.vibrate(10);
    refresh();
  };

  const shareText = sheetEvent
    ? `Alibi Impossible — ${sheetEvent.title}\n${sheetEvent.source_text}\n${sheetEvent.description}`
    : "";

  return (
    <div className="pb-4">
      <div className="m3-card-filled mb-4">
        <span className="inline-flex items-center px-3 py-1.5 rounded-full bg-error-container text-error-on-container text-sm font-semibold">
          {openCount} Kritické Rozpory
        </span>
        <p className="text-sm text-outline mt-3 mb-0">
          Automaticky detegované konflikty alibi vs. forenzné fakty.
        </p>
      </div>

      <div className="flex gap-2 overflow-x-auto no-scrollbar mb-3 pb-1">
        {(
          [
            ["all", "Všetky"],
            ["critical", "Kritické"],
            ["confirmed", "Potvrdené"],
            ["dismissed", "Zamietnuté"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            className={`flex-shrink-0 px-3.5 py-2 rounded-full text-sm border ${
              filter === id
                ? "bg-primary-container border-transparent text-primary-on-container font-semibold"
                : "bg-surface-lowest border-outline-variant text-surface-on"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {visible.length === 0 && (
        <p className="text-sm text-outline text-center py-10">
          V tomto filtri nie sú žiadne rozpory.
        </p>
      )}

      <div className="space-y-3">
        {visible.map((event) => {
          const status = getHitlStatus(analysisId, event.id);
          const sev = severity(event);
          return (
            <article
              key={event.id}
              className={`m3-card-outlined ${
                status === "confirmed"
                  ? "border-2 border-success"
                  : status === "dismissed"
                    ? "opacity-55 border-dashed"
                    : ""
              }`}
            >
              {status !== "open" && (
                <div
                  className={`inline-flex mb-2 px-2 py-1 rounded-full text-[11px] font-medium ${
                    status === "confirmed"
                      ? "bg-success-container text-success-on-container"
                      : "bg-surface-high text-outline"
                  }`}
                >
                  {status === "confirmed" ? "✓ Potvrdené" : "Zamietnuté"}
                </div>
              )}
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="text-base font-semibold text-surface-on m-0">
                  {event.title}
                </h3>
                <span className={`m3-chip ${sev === "medium" ? "m3-chip-medium" : ""}`}>
                  {sev === "high" ? "Vysoké riziko" : "Stredné riziko"}
                </span>
              </div>
              <div className="flex items-center gap-2 mb-2 text-[11px] text-outline">
                <span>{(event.confidence * 100).toFixed(0)}%</span>
                <div className="flex-1 max-w-[80px] h-1 rounded bg-surface-high overflow-hidden">
                  <div
                    className="h-full bg-primary rounded"
                    style={{ width: `${Math.round(event.confidence * 100)}%` }}
                  />
                </div>
              </div>
              <div className="mb-2 p-2.5 rounded-lg bg-surface-low border-l-[3px] border-primary text-sm">
                <span className="block text-[11px] text-outline mb-1">Tvrdené Alibi</span>
                {event.source_text}
                {event.location && (
                  <span className="block mt-1 text-[11px] text-primary">{event.location}</span>
                )}
              </div>
              <div className="mb-2 p-2.5 rounded-lg bg-error-container/40 border-l-[3px] border-error text-sm">
                <span className="block text-[11px] text-outline mb-1">Forenzný Fakt</span>
                {event.description}
              </div>
              {status === "open" && (
                <div className="flex flex-wrap gap-2 mt-3 items-center">
                  <button
                    type="button"
                    className="m3-btn-filled !w-auto"
                    onClick={() => setSheetEvent(event)}
                  >
                    Alibi Impossible Karta
                  </button>
                  <button
                    type="button"
                    className="m3-btn-text m3-btn-text-success"
                    onClick={() => setStatus(event.id, "confirmed")}
                  >
                    Potvrdiť
                  </button>
                  <button
                    type="button"
                    className="m3-btn-text m3-btn-text-muted"
                    onClick={() => setStatus(event.id, "dismissed")}
                  >
                    Zamietnuť
                  </button>
                </div>
              )}
            </article>
          );
        })}
      </div>

      <BottomSheet
        open={Boolean(sheetEvent)}
        onClose={() => setSheetEvent(null)}
        title="Alibi Impossible"
      >
        {sheetEvent && (
          <>
            <p className="text-sm text-surface-on mb-3">{sheetEvent.description}</p>
            <div className="m3-card-filled mb-3">
              <p className="text-xs text-outline m-0 mb-1">Zdroj</p>
              <p className="text-sm m-0">{sheetEvent.source_text}</p>
              <p className="text-xl font-bold text-error mt-3 mb-0">
                Spoľahlivosť {(sheetEvent.confidence * 100).toFixed(0)}%
              </p>
            </div>
            <div className="flex flex-col gap-2 mt-4">
              <button
                type="button"
                className="m3-btn-filled"
                onClick={async () => {
                  try {
                    if (navigator.share) {
                      await navigator.share({ title: "Alibi Impossible", text: shareText });
                    } else {
                      await navigator.clipboard.writeText(shareText);
                    }
                  } catch {
                    /* cancelled */
                  }
                }}
              >
                Zdieľať kartu
              </button>
              <button
                type="button"
                className="m3-btn-outlined"
                onClick={async () => {
                  await navigator.clipboard.writeText(shareText);
                }}
              >
                Kopírovať text
              </button>
              <button
                type="button"
                className="m3-btn-text m3-btn-text-muted"
                onClick={() => setSheetEvent(null)}
              >
                Zavrieť
              </button>
            </div>
          </>
        )}
      </BottomSheet>
    </div>
  );
}
