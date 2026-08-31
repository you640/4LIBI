import { useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { useCaseContext } from "../../lib/caseContext";
import { contradictionEvents, resolveEventPage } from "../../lib/caseUtils";
import { trackContradictionViewed, trackAlibiChecked } from "../../lib/analytics";
import { auditHitlChange } from "../../lib/auditLog";
import {
  deriveGeospatialCheck,
  feasibilityLabel,
} from "../../lib/alibiGeospatial";
import { checkGeospatialFeasibility } from "../../lib/geospatialApi";
import {
  requestCrossExam,
  type CrossExamSource,
} from "../../lib/crossExamApi";
import {
  getHitlStatus,
  setHitlStatus,
  type HitlStatus,
} from "../../lib/hitlStorage";
import { BottomSheet } from "../m3/BottomSheet";
import { AlibiShareCard } from "../share/AlibiShareCard";
import { AlibiMap } from "./AlibiMap";
import { PageBadge } from "./PageBadge";
import type { CaseOutletContext } from "../../pages/CaseLayout";
import type {
  Contradiction,
  CrossExamQuestion,
  TimelineEvent,
  TravelFeasibilityResult,
} from "../../types";

type Filter = "all" | "critical" | "confirmed" | "dismissed";

function severity(event: TimelineEvent): "high" | "medium" {
  return event.confidence >= 0.85 ? "high" : "medium";
}

function hasAlibiTag(event: TimelineEvent): boolean {
  return (event.tags || []).some((t) => t.toLowerCase().includes("alibi"));
}

function eventToContradiction(event: TimelineEvent): Contradiction {
  return {
    id: event.id,
    title: event.title,
    explanation: event.description,
    severity: severity(event) === "high" ? "critical" : "medium",
    entity_ref: event.persons_involved?.[0],
    document_title: "Vyšetrovací spis",
    contradiction_type: "location_time_conflict",
    page: resolveEventPage(event),
  };
}

export function RozporyTab() {
  const { analysis, analysisId, search } = useCaseContext();
  const { bumpHitl } = useOutletContext<CaseOutletContext>();
  const [filter, setFilter] = useState<Filter>("all");
  const [sheetEvent, setSheetEvent] = useState<TimelineEvent | null>(null);
  const [showShareCard, setShowShareCard] = useState(false);
  const [geoResults, setGeoResults] = useState<
    Record<string, TravelFeasibilityResult | null>
  >({});
  const [geoLoading, setGeoLoading] = useState<string | null>(null);
  const [crossExamLoading, setCrossExamLoading] = useState(false);
  const [crossExamQuestions, setCrossExamQuestions] = useState<
    CrossExamQuestion[] | null
  >(null);
  const [crossExamSource, setCrossExamSource] = useState<CrossExamSource | null>(
    null
  );
  const [crossExamError, setCrossExamError] = useState<string | null>(null);
  const [copyDone, setCopyDone] = useState(false);
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
    if (status === "confirmed" || status === "dismissed") {
      auditHitlChange({ caseId: analysisId, eventId, status });
    }
    if (navigator.vibrate) navigator.vibrate(10);
    refresh();
  };

  const runGeospatialCheck = async (event: TimelineEvent) => {
    const input = deriveGeospatialCheck(analysis, event);
    if (!input) return;
    setGeoLoading(event.id);
    try {
      const result = await checkGeospatialFeasibility(input, analysisId);
      setGeoResults((prev) => ({ ...prev, [event.id]: result }));
      if (result) {
        trackAlibiChecked({ caseId: analysisId });
      }
    } finally {
      setGeoLoading(null);
    }
  };

  const openContradictionSheet = (event: TimelineEvent) => {
    trackContradictionViewed({
      contradictionId: event.id,
    });
    setSheetEvent(event);
    setShowShareCard(false);
    setCrossExamQuestions(null);
    setCrossExamSource(null);
    setCrossExamError(null);
    setCopyDone(false);
  };

  const runCrossExam = async (event: TimelineEvent) => {
    setCrossExamLoading(true);
    setCrossExamError(null);
    setCopyDone(false);
    try {
      const { questions, source } = await requestCrossExam({
        contradictions: [eventToContradiction(event)],
        contextText: `${event.title}\n${event.description}\n${event.source_text}`,
        mode: "alibi",
        caseId: analysisId,
        eventId: event.id,
      });
      if (questions.length === 0) {
        setCrossExamError(
          "Nepodarilo sa pripraviť otázky. Skontrolujte MISTRAL_API_KEY na serveri alebo skúste znova."
        );
        setCrossExamQuestions(null);
      } else {
        setCrossExamQuestions(questions);
        setCrossExamSource(source);
      }
    } catch (err) {
      setCrossExamError(
        err instanceof Error ? err.message : "Cross-exam zlyhal."
      );
    } finally {
      setCrossExamLoading(false);
    }
  };

  const copyQuestions = async () => {
    if (!crossExamQuestions?.length) return;
    const text = crossExamQuestions
      .map((q, i) => `${i + 1}. ${q.question}`)
      .join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopyDone(true);
    } catch {
      setCopyDone(false);
    }
  };

  return (
    <div className="pb-4">
      <div className="m3-card-filled mb-4">
        <span className="inline-flex items-center px-3 py-1.5 rounded-full bg-error-container text-error-on-container text-sm font-semibold">
          {openCount} Kritické Rozpory
        </span>
        <p className="text-sm text-outline mt-3 mb-0">
          Automaticky detegované konflikty alibi vs. forenzné fakty.
        </p>
        <p className="text-xs text-outline mt-2 mb-0 italic">
          Rozhodnutia ostávajú na vás — AI len navrhuje.
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

      <div className="space-y-3" data-testid="rozpory-list">
        {visible.map((event, idx) => {
          const status = getHitlStatus(analysisId, event.id);
          const sev = severity(event);
          const geo = geoResults[event.id];
          const canGeo = Boolean(deriveGeospatialCheck(analysis, event));
          return (
            <article
              key={`${event.id}_${idx}`}
              data-testid="rozpory-event"
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
                <h3 className="text-base font-semibold text-surface-on m-0 flex items-center gap-2 flex-wrap">
                  {event.title}
                  <PageBadge page={resolveEventPage(event)} />
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
                <span className="block text-[11px] text-outline mb-1 items-center gap-2">
                  Tvrdené Alibi
                  <PageBadge page={resolveEventPage(event)} />
                </span>
                {event.source_text}
                {event.location && (
                  <span className="block mt-1 text-[11px] text-primary">{event.location}</span>
                )}
              </div>
              <div className="mb-2 p-2.5 rounded-lg bg-error-container/40 border-l-[3px] border-error text-sm">
                <span className="block text-[11px] text-outline mb-1">Forenzný Fakt</span>
                {event.description}
              </div>

              {hasAlibiTag(event) && (
                <div className="mb-2">
                  {canGeo ? (
                    <button
                      type="button"
                      className="m3-btn-outlined !w-auto text-xs"
                      data-testid="geospatial-check-btn"
                      disabled={geoLoading === event.id}
                      onClick={() => runGeospatialCheck(event)}
                    >
                      {geoLoading === event.id
                        ? "Overujem alibi…"
                        : "Overiť geospatial alibi"}
                    </button>
                  ) : (
                    <p
                      className="text-xs text-outline m-0"
                      data-testid="alibi-map-empty"
                    >
                      Pre mapu chýbajú dve odlišné lokality v časovej osi.
                    </p>
                  )}
                  {geo && (
                    <>
                      <div
                        className={`mt-2 p-2.5 rounded-lg text-xs ${
                          geo.isFeasible
                            ? "bg-success-container/30 border border-success/40"
                            : "bg-error-container/30 border border-error/40"
                        }`}
                        data-testid="geospatial-result"
                      >
                        <p className="font-semibold text-surface-on m-0 mb-1">
                          {feasibilityLabel(geo)} · {geo.distanceKm} km
                        </p>
                        <p className="text-outline m-0">{geo.explanation}</p>
                      </div>
                      <AlibiMap result={geo} />
                    </>
                  )}
                </div>
              )}

              {status === "open" && (
                <div className="flex flex-wrap gap-2 mt-3 items-center">
                  <button
                    type="button"
                    className="m3-btn-filled !w-auto"
                    onClick={() => openContradictionSheet(event)}
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
        open={Boolean(sheetEvent) && !showShareCard}
        onClose={() => setSheetEvent(null)}
        title="Alibi Impossible"
      >
        {sheetEvent && (
          <>
            <p className="text-sm text-surface-on mb-3 flex items-center gap-2 flex-wrap">
              {sheetEvent.description}
              <PageBadge page={resolveEventPage(sheetEvent)} />
            </p>
            <div className="m3-card-filled mb-3">
              <p className="text-xs text-outline m-0 mb-1 flex items-center gap-2">
                Zdroj
                <PageBadge page={resolveEventPage(sheetEvent)} />
              </p>
              <p className="text-sm m-0">{sheetEvent.source_text}</p>
              <p className="text-xl font-bold text-error mt-3 mb-0">
                Spoľahlivosť {(sheetEvent.confidence * 100).toFixed(0)}%
              </p>
            </div>

            {geoResults[sheetEvent.id] && (
              <AlibiMap result={geoResults[sheetEvent.id]} />
            )}

            <div className="mt-3 mb-2" data-testid="cross-exam-panel">
              <button
                type="button"
                className="m3-btn-outlined"
                data-testid="cross-exam-btn"
                disabled={crossExamLoading}
                onClick={() => runCrossExam(sheetEvent)}
              >
                {crossExamLoading ? "Pripravujem…" : "Pripraviť cross-exam"}
              </button>
              <p className="text-[11px] text-outline mt-1.5 mb-0">
                Bez MISTRAL_API_KEY na serveri sa použijú lokálne šablóny otázok.
              </p>
              {crossExamError && (
                <p className="text-xs text-error mt-2 mb-0" data-testid="cross-exam-error">
                  {crossExamError}
                </p>
              )}
              {crossExamQuestions && crossExamQuestions.length > 0 && (
                <div className="mt-3" data-testid="cross-exam-questions">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <p className="text-xs font-semibold text-surface-on m-0">
                      Otázky
                      {crossExamSource === "local" ? " (lokálne)" : " (Mistral)"}
                    </p>
                    <button
                      type="button"
                      className="m3-btn-text !w-auto text-xs"
                      data-testid="cross-exam-copy"
                      onClick={() => void copyQuestions()}
                    >
                      {copyDone ? "Skopírované" : "Kopírovať"}
                    </button>
                  </div>
                  <ul className="m-0 pl-4 space-y-2 text-sm text-surface-on">
                    {crossExamQuestions.map((q) => (
                      <li key={q.id}>{q.question}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2 mt-4">
              <button
                type="button"
                className="m3-btn-filled"
                onClick={() => setShowShareCard(true)}
              >
                Otvoriť share kartu (PNG)
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

      {showShareCard && sheetEvent && (
        <AlibiShareCard
          analysis={analysis}
          onClose={() => {
            setShowShareCard(false);
            setSheetEvent(null);
          }}
        />
      )}
    </div>
  );
}
