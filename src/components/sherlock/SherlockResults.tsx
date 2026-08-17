import { useState, useMemo } from "react";
import type { Analysis, TimelineEvent } from "../../types";
import {
  ArrowLeftIcon,
  SearchIcon,
  AlertIcon,
  CheckIcon,
} from "../Icons";
import { AlibiShareCard } from "../share/AlibiShareCard";
import { trackContradictionViewed } from "../../lib/analytics";

interface SherlockResultsProps {
  analysis: Analysis;
  onBack: () => void;
}

type Tab = "timeline" | "persons" | "evidence" | "relationships";

export function SherlockResults({ analysis, onBack }: SherlockResultsProps) {
  const [activeTab, setActiveTab] = useState<Tab>("timeline");
  const [search, setSearch] = useState("");
  const [showShare, setShowShare] = useState(false);

  const sortedTimeline = useMemo(() => {
    return [...analysis.timeline].sort((a, b) => {
      if (!a.timestamp) return 1;
      if (!b.timestamp) return -1;
      return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
    });
  }, [analysis.timeline]);

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

  const TABS: { id: Tab; label: string; count: number }[] = [
    { id: "timeline", label: "Časová os", count: analysis.timeline.length },
    { id: "persons", label: "Osoby", count: analysis.persons.length },
    { id: "evidence", label: "Dôkazy", count: analysis.evidence.length },
    { id: "relationships", label: "Vzťahy", count: analysis.relationships.length },
  ];

  return (
    <div className="px-5 pt-4 pb-8">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={onBack} className="text-stone-500 -ml-1" aria-label="Späť">
          <ArrowLeftIcon className="w-6 h-6" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-semibold text-stone-800 truncate tracking-tight">
            {analysis.metadata.document_name}
          </h1>
          <p className="text-xs text-stone-500">
            {formatTime(analysis.metadata.upload_date)} · {analysis.metadata.language.toUpperCase()}
          </p>
        </div>
      </div>

      {contradictionCount > 0 && (
        <div className="card p-3 mb-3 flex items-center gap-2">
          <AlertIcon className="w-5 h-5 text-danger flex-shrink-0" />
          <p className="text-sm text-danger font-medium flex-1">
            Nájdené {contradictionCount}{" "}
            {contradictionCount === 1 ? "rozpor" : "rozpory"}
          </p>
          <button
            onClick={() => setShowShare(true)}
            className="text-xs font-medium text-stone-600"
          >
            Zdieľať
          </button>
        </div>
      )}

      <div className="segmented mb-4 overflow-x-auto no-scrollbar">
        {TABS.map(({ id, label, count }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex-1 min-w-fit px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-colors ${
              activeTab === id
                ? "bg-white/80 text-stone-800 shadow-sm"
                : "text-stone-500"
            }`}
          >
            {label} {count}
          </button>
        ))}
      </div>

      {activeTab === "timeline" && (
        <div className="relative mb-4">
          <SearchIcon className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Hľadať v časovej osi…"
            className="input pl-9 text-sm"
          />
        </div>
      )}

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

      {showShare && (
        <AlibiShareCard analysis={analysis} onClose={() => setShowShare(false)} />
      )}
    </div>
  );
}

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
      <p className="text-sm text-stone-500 text-center py-8">
        Žiadne udalosti nenájdené.
      </p>
    );
  }

  const getPerson = (id: string) => persons.find((p) => p.id === id);
  const getEvidence = (id: string) => evidence.find((e) => e.id === id);

  return (
    <div className="relative pl-5">
      <div className="absolute left-[7px] top-2 bottom-2 w-px bg-stone-300" />

      {events.map((event) => {
        const isExpanded = expanded === event.id;
        const isContradiction = event.tags.includes("rozpor");
        const isAlibi = event.tags.includes("alibi");

        return (
          <div key={event.id} className="relative mb-3">
            <div
              className={`absolute -left-[13px] top-3 w-3.5 h-3.5 rounded-full border-2 border-bg ${
                isContradiction
                  ? "bg-danger"
                  : isAlibi
                  ? "bg-accent"
                  : "bg-stone-300"
              }`}
            />

            <button
              onClick={() => {
                const newExpanded = isExpanded ? null : event.id;
                setExpanded(newExpanded);
                if (newExpanded && event.tags.includes("rozpor")) {
                  trackContradictionViewed({ contradictionId: event.id });
                }
              }}
              className={`card w-full p-3 text-left ${
                isContradiction
                  ? "border-l-danger border-l-2"
                  : isAlibi
                  ? "border-l-accent border-l-2"
                  : ""
              }`}
            >
              <p className="text-xs text-stone-400 mb-0.5">
                {formatTime(event.timestamp)}
              </p>
              <h3
                className={`text-sm font-semibold leading-tight ${
                  isContradiction
                    ? "text-danger"
                    : isAlibi
                    ? "text-accent"
                    : "text-stone-800"
                }`}
              >
                {event.title}
              </h3>

              <div className="flex flex-wrap gap-1 mt-2">
                {event.tags.map((tag) => (
                  <span
                    key={tag}
                    className={`chip ${
                      tag === "rozpor"
                        ? "text-danger"
                        : tag === "alibi"
                        ? "text-accent"
                        : ""
                    }`}
                  >
                    {tag}
                  </span>
                ))}
              </div>

              {isExpanded && (
                <div className="mt-3 pt-3 border-t border-stone-200/80 space-y-3">
                  <p className="text-xs text-stone-600 leading-relaxed">
                    {event.description}
                  </p>

                  {event.location && (
                    <p className="text-xs text-stone-500">{event.location}</p>
                  )}

                  {event.persons_involved.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {event.persons_involved.map((pid) => {
                        const p = getPerson(pid);
                        return p ? (
                          <span key={pid} className="chip text-stone-600">
                            {p.name}
                          </span>
                        ) : null;
                      })}
                    </div>
                  )}

                  {event.evidence_links.length > 0 && (
                    <div className="space-y-1">
                      {event.evidence_links.map((eid) => {
                        const ev = getEvidence(eid);
                        return ev ? (
                          <p key={eid} className="text-[11px] text-stone-500">
                            {ev.content}
                          </p>
                        ) : null;
                      })}
                    </div>
                  )}

                  <p className="text-[11px] text-stone-400 italic">
                    „{event.source_text}"
                  </p>
                </div>
              )}
            </button>
          </div>
        );
      })}
    </div>
  );
}

function Persons({ persons }: { persons: Analysis["persons"] }) {
  return (
    <div className="space-y-2">
      {persons.map((person) => (
        <div key={person.id} className="card p-4">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h3 className="text-sm font-semibold text-stone-800">{person.name}</h3>
            <span className="chip">{person.role}</span>
          </div>
          {person.description && (
            <p className="text-xs text-stone-500 leading-relaxed">
              {person.description}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

function Evidence({ evidence }: { evidence: Analysis["evidence"] }) {
  const sorted = [...evidence].sort((a, b) => b.relevance_score - a.relevance_score);

  return (
    <div className="space-y-2">
      {sorted.map((ev) => (
        <div key={ev.id} className="card p-4">
          <div className="flex items-start justify-between gap-2 mb-2">
            <span className="text-[10px] font-medium uppercase tracking-wide text-stone-400">
              {ev.type}
            </span>
            <span className="text-[10px] text-stone-400">{ev.relevance_score}/10</span>
          </div>
          <p className="text-sm text-stone-800 leading-relaxed mb-1">{ev.content}</p>
          <p className="text-[11px] text-stone-400">{ev.source}</p>
        </div>
      ))}
    </div>
  );
}

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
            <span className="text-sm font-medium text-stone-800">
              {getName(rel.person1_id)}
            </span>
            <span className="chip">{rel.type}</span>
            <span className="text-sm font-medium text-stone-800">
              {getName(rel.person2_id)}
            </span>
          </div>
          <p className="text-xs text-stone-500 leading-relaxed">{rel.description}</p>
          {rel.evidence_supporting.length > 0 && (
            <div className="mt-2 flex items-center gap-1">
              <CheckIcon className="w-3.5 h-3.5 text-success" />
              <span className="text-[11px] text-stone-400">
                {rel.evidence_supporting.join(", ")}
              </span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
