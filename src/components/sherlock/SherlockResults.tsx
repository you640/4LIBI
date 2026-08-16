import { useState, useMemo } from "react";
import type { Analysis, TimelineEvent } from "../../types";
import {
  ArrowLeftIcon,
  SearchIcon,
  ClockIcon,
  PeopleIcon,
  EvidenceIcon,
  AlertIcon,
  CheckIcon,
} from "../Icons";
import { AlibiShareCard } from "../share/AlibiShareCard";

interface SherlockResultsProps {
  analysis: Analysis;
  onBack: () => void;
}

type Tab = "timeline" | "persons" | "evidence" | "relationships";

export function SherlockResults({ analysis, onBack }: SherlockResultsProps) {
  const [activeTab, setActiveTab] = useState<Tab>("timeline");
  const [search, setSearch] = useState("");
  const [showShare, setShowShare] = useState(false);

  // Chronologické zoradenie timeline (od najstaršej po najnovšiu)
  const sortedTimeline = useMemo(() => {
    return [...analysis.timeline].sort((a, b) => {
      if (!a.timestamp) return 1;
      if (!b.timestamp) return -1;
      return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
    });
  }, [analysis.timeline]);

  // Filtrovanie timeline podľa vyhľadávania
  const filteredTimeline = useMemo(() => {
    if (!search.trim()) return sortedTimeline;
    const q = search.toLowerCase();
    return sortedTimeline.filter(
      (e) =>
        e.source_text.toLowerCase().includes(q) ||
        e.title.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q)
    );
  }, [sortedTimeline, search]);

  // Počet rozporov (eventy s tagom "rozpor")
  const contradictionCount = analysis.timeline.filter((e) =>
    e.tags.includes("rozpor")
  ).length;

  const formatTime = (ts: string | null): string => {
    if (!ts) return "Neznámy čas";
    return new Date(ts).toLocaleString("sk-SK", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const TABS: { id: Tab; label: string; count: number; Icon: typeof ClockIcon }[] = [
    { id: "timeline", label: "Časová os", count: analysis.timeline.length, Icon: ClockIcon },
    { id: "persons", label: "Osoby", count: analysis.persons.length, Icon: PeopleIcon },
    { id: "evidence", label: "Dôkazy", count: analysis.evidence.length, Icon: EvidenceIcon },
    {
      id: "relationships",
      label: "Vzťahy",
      count: analysis.relationships.length,
      Icon: AlertIcon,
    },
  ];

  return (
    <div className="px-5 pt-4 pb-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={onBack} className="text-slate-400 -ml-1">
          <ArrowLeftIcon className="w-6 h-6" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-slate-100 truncate">
            {analysis.metadata.document_name}
          </h1>
          <p className="text-xs text-slate-500">
            {formatTime(analysis.metadata.upload_date)} · {analysis.metadata.language.toUpperCase()}
          </p>
        </div>
      </div>

      {/* Rozpor badge */}
      {contradictionCount > 0 && (
        <div className="card border-danger/30 bg-danger/5 p-3 mb-4 flex items-center gap-2">
          <AlertIcon className="w-5 h-5 text-danger flex-shrink-0" />
          <p className="text-sm text-danger font-medium">
            Nájdené {contradictionCount}{" "}
            {contradictionCount === 1 ? "rozpor" : "rozpory"}
          </p>
        </div>
      )}

      {/* Share tlacidlo */}
      {contradictionCount > 0 && (
        <button
          onClick={() => setShowShare(true)}
          className="btn-secondary flex items-center justify-center gap-2 mb-4 text-sm"
        >
          <AlertIcon className="w-4 h-4 text-danger" />
          Zdieľať rozpor
        </button>
      )}

      {/* Tab navigácia — horizontálny scroll */}
      <div className="flex gap-1 mb-4 overflow-x-auto no-scrollbar">
        {TABS.map(({ id, label, count, Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
              activeTab === id
                ? "bg-cta/10 text-cta"
                : "text-slate-500"
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
            <span className="text-[10px] text-slate-600">({count})</span>
          </button>
        ))}
      </div>

      {/* Vyhľadávanie (len pre timeline) */}
      {activeTab === "timeline" && (
        <div className="relative mb-4">
          <SearchIcon className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Hľadať v časovej osi…"
            className="input pl-9 text-sm"
          />
        </div>
      )}

      {/* Obsah podľa tabu */}
      {activeTab === "timeline" && (
        <Timeline
          events={filteredTimeline}
          persons={analysis.persons}
          evidence={analysis.evidence}
          formatTime={formatTime}
        />
      )}

      {activeTab === "persons" && <Persons persons={analysis.persons} />}

      {activeTab === "evidence" && <Evidence evidence={analysis.evidence} />}

      {activeTab === "relationships" && (
        <Relationships
          relationships={analysis.relationships}
          persons={analysis.persons}
        />
      )}

      {/* Alibi Impossible share modal */}
      {showShare && (
        <AlibiShareCard analysis={analysis} onClose={() => setShowShare(false)} />
      )}
    </div>
  );
}

// === Timeline komponent ===
function Timeline({
  events,
  persons,
  evidence,
  formatTime,
}: {
  events: TimelineEvent[];
  persons: Analysis["persons"];
  evidence: Analysis["evidence"];
  formatTime: (ts: string | null) => string;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (events.length === 0) {
    return (
      <p className="text-sm text-slate-500 text-center py-8">
        Žiadne udalosti nenájdené.
      </p>
    );
  }

  const getPerson = (id: string) => persons.find((p) => p.id === id);
  const getEvidence = (id: string) => evidence.find((e) => e.id === id);

  return (
    <div className="relative pl-5">
      {/* Vertikálna línia */}
      <div className="absolute left-[7px] top-2 bottom-2 w-0.5 bg-slate-700" />

      {events.map((event) => {
        const isExpanded = expanded === event.id;
        const isContradiction = event.tags.includes("rozpor");
        const isAlibi = event.tags.includes("alibi");

        return (
          <div key={event.id} className="relative mb-4">
            {/* Bod na osi */}
            <div
              className={`absolute -left-[13px] top-3 w-3.5 h-3.5 rounded-full border-2 border-bg ${
                isContradiction
                  ? "bg-danger ring-2 ring-danger/30"
                  : isAlibi
                  ? "bg-accent ring-2 ring-accent/30"
                  : "bg-slate-600"
              }`}
            />

            {/* Karta eventu */}
            <button
              onClick={() => setExpanded(isExpanded ? null : event.id)}
              className={`card w-full p-3 text-left transition-colors hover:border-white/10 ${
                  isContradiction
                    ? "border-l-danger border-l-2"
                    : isAlibi
                    ? "border-l-accent border-l-2"
                    : ""
                }`}
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-500 mb-0.5">
                    {formatTime(event.timestamp)}
                  </p>
                  <h3 className={`text-sm font-semibold leading-tight ${
                      isContradiction
                        ? "text-danger"
                        : isAlibi
                        ? "text-accent"
                        : "text-slate-100"
                    }`}>
                    {event.title}
                  </h3>
                </div>
                {/* Confidence */}
                {event.confidence < 0.9 && (
                  <span className="text-[10px] text-slate-600 flex-shrink-0">
                    {Math.round(event.confidence * 100)}%
                  </span>
                )}
              </div>

              {/* Tagy */}
              <div className="flex flex-wrap gap-1 mt-2">
                {event.tags.map((tag) => (
                  <span
                    key={tag}
                    className={`text-[10px] px-2 py-0.5 rounded-full ${
                      tag === "rozpor"
                        ? "bg-danger/15 text-danger"
                        : tag === "alibi"
                        ? "bg-accent/15 text-accent"
                        : tag === "svedectvo"
                        ? "bg-blue-500/15 text-blue-400"
                        : "bg-slate-700/50 text-slate-400"
                    }`}
                  >
                    {tag}
                  </span>
                ))}
              </div>

              {/* Rozbalený detail */}
              {isExpanded && (
                <div className="mt-3 pt-3 border-t border-white/5 space-y-3">
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {event.description}
                  </p>

                  {event.location && (
                    <p className="text-xs text-slate-500">📍 {event.location}</p>
                  )}

                  {/* Osoby */}
                  {event.persons_involved.length > 0 && (
                    <div>
                      <p className="text-[10px] text-slate-600 uppercase tracking-wide mb-1">
                        Osoby
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {event.persons_involved.map((pid) => {
                          const p = getPerson(pid);
                          return p ? (
                            <span
                              key={pid}
                              className="text-[11px] bg-slate-700/40 px-2 py-0.5 rounded-md text-slate-300"
                            >
                              {p.name} ({p.role})
                            </span>
                          ) : null;
                        })}
                      </div>
                    </div>
                  )}

                  {/* Dôkazy */}
                  {event.evidence_links.length > 0 && (
                    <div>
                      <p className="text-[10px] text-slate-600 uppercase tracking-wide mb-1">
                        Dôkazy
                      </p>
                      <div className="space-y-1">
                        {event.evidence_links.map((eid) => {
                          const ev = getEvidence(eid);
                          return ev ? (
                            <div
                              key={eid}
                              className="text-[11px] bg-slate-800/50 p-2 rounded-md"
                            >
                              <span className="text-slate-500">[{ev.type}]</span>{" "}
                              <span className="text-slate-300">{ev.content}</span>
                            </div>
                          ) : null;
                        })}
                      </div>
                    </div>
                  )}

                  {/* Source text */}
                  <div className="bg-slate-800/40 p-2 rounded-md">
                    <p className="text-[10px] text-slate-600 uppercase tracking-wide mb-0.5">
                      Zdrojový text
                    </p>
                    <p className="text-[11px] text-slate-500 italic">
                      „{event.source_text}"
                    </p>
                  </div>
                </div>
              )}
            </button>
          </div>
        );
      })}
    </div>
  );
}

// === Persons komponent ===
function Persons({ persons }: { persons: Analysis["persons"] }) {
  const roleColors: Record<string, string> = {
    obvinený: "bg-danger/15 text-danger",
    svedok: "bg-blue-500/15 text-blue-400",
    svedkyňa: "bg-blue-500/15 text-blue-400",
    obete: "bg-amber-500/15 text-amber-400",
  };

  return (
    <div className="space-y-2">
      {persons.map((person) => (
        <div key={person.id} className="card p-4">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h3 className="text-sm font-semibold text-slate-100">{person.name}</h3>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full ${
                roleColors[person.role] || "bg-slate-700/50 text-slate-400"
              }`}
            >
              {person.role}
            </span>
          </div>
          {person.description && (
            <p className="text-xs text-slate-400 leading-relaxed">
              {person.description}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

// === Evidence komponent ===
function Evidence({ evidence }: { evidence: Analysis["evidence"] }) {
  const sorted = [...evidence].sort((a, b) => b.relevance_score - a.relevance_score);

  return (
    <div className="space-y-2">
      {sorted.map((ev) => (
        <div key={ev.id} className="card p-4">
          <div className="flex items-start justify-between gap-2 mb-2">
            <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
              {ev.type}
            </span>
            {/* Relevance bar */}
            <div className="flex items-center gap-1">
              <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-cta rounded-full"
                  style={{ width: `${ev.relevance_score * 10}%` }}
                />
              </div>
              <span className="text-[10px] text-slate-500">
                {ev.relevance_score}/10
              </span>
            </div>
          </div>
          <p className="text-sm text-slate-200 leading-relaxed mb-1">
            {ev.content}
          </p>
          <p className="text-[11px] text-slate-500">📄 {ev.source}</p>
        </div>
      ))}
    </div>
  );
}

// === Relationships komponent ===
function Relationships({
  relationships,
  persons,
}: {
  relationships: Analysis["relationships"];
  persons: Analysis["persons"];
}) {
  const getName = (id: string) => persons.find((p) => p.id === id)?.name || id;

  return (
    <div className="space-y-2">
      {relationships.map((rel, idx) => (
        <div key={idx} className="card p-4">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-sm font-medium text-slate-100">
              {getName(rel.person1_id)}
            </span>
            <span className="text-[10px] bg-accent/15 text-accent px-2 py-0.5 rounded-full">
              {rel.type}
            </span>
            <span className="text-sm font-medium text-slate-100">
              {getName(rel.person2_id)}
            </span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            {rel.description}
          </p>
          {rel.evidence_supporting.length > 0 && (
            <div className="mt-2 flex items-center gap-1">
              <CheckIcon className="w-3.5 h-3.5 text-success" />
              <span className="text-[11px] text-slate-500">
                Podporené dôkazmi: {rel.evidence_supporting.join(", ")}
              </span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
