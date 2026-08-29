import { useMemo, useState, useRef } from "react";
import { useCaseContext } from "../../lib/caseContext";
import { calculateGraphMetrics } from "../../lib/graphMetrics";
import { BottomSheet } from "../m3/BottomSheet";
import type { Person, Relationship } from "../../types";

interface NodePosition {
  id: string;
  x: number;
  y: number;
  person: Person;
  degree: number;
  pageRankScore: number;
  isKeyHub: boolean;
  colorClass: string;
  isSuspect: boolean;
  isAlibi: boolean;
}

export function GrafTab() {
  const { analysis } = useCaseContext();
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [selectedRel, setSelectedRel] = useState<Relationship | null>(null);
  const [filterRole, setFilterRole] = useState<string>("all");
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const persons = useMemo(() => analysis.persons || [], [analysis.persons]);
  const relationships = useMemo(() => analysis.relationships || [], [analysis.relationships]);

  const metricsMap = useMemo(() => {
    const { nodesWithMetrics } = calculateGraphMetrics(persons, relationships);
    const map = new Map<string, { pageRankScore: number; isKeyHub: boolean; degree: number }>();
    for (const n of nodesWithMetrics) {
      map.set(n.id, {
        pageRankScore: n.pageRankScore || 0,
        isKeyHub: Boolean(n.isKeyHub),
        degree: n.degree || 0,
      });
      if (n.name) {
        map.set(n.name.toLowerCase().trim(), {
          pageRankScore: n.pageRankScore || 0,
          isKeyHub: Boolean(n.isKeyHub),
          degree: n.degree || 0,
        });
      }
    }
    return map;
  }, [persons, relationships]);

  // Výpočet stupňa (degree centrality) a farebného kódovania pre každú osobu
  const nodes = useMemo<NodePosition[]>(() => {
    if (persons.length === 0) return [];

    const degreeMap = new Map<string, number>();
    for (const rel of relationships) {
      degreeMap.set(rel.person1_id, (degreeMap.get(rel.person1_id) || 0) + 1);
      degreeMap.set(rel.person2_id, (degreeMap.get(rel.person2_id) || 0) + 1);
    }

    const width = 600;
    const height = 460;
    const centerX = width / 2;
    const centerY = height / 2;
    const total = persons.length;

    // Usporiadanie do dynamického viacvrstvového kruhu / force layoutu
    return persons.map((person, index) => {
      const degree = degreeMap.get(person.id) || degreeMap.get(person.name) || 0;
      const metrics = metricsMap.get(person.id) || metricsMap.get(person.name.toLowerCase().trim());
      const pageRankScore = metrics?.pageRankScore ?? 0;
      const isKeyHub = metrics?.isKeyHub ?? false;
      const roleLower = (person.role || "").toLowerCase();
      const isSuspect = roleLower.includes("podozriv") || roleLower.includes("obvinen");
      const isAlibi = roleLower.includes("alibi");

      let colorClass = "bg-primary-container text-primary-on-container border-primary";
      if (isSuspect) {
        colorClass = "bg-error-container text-error-on-container border-error";
      } else if (isAlibi) {
        colorClass = "bg-secondary-container text-secondary-on-container border-secondary";
      } else if (roleLower.includes("svedok")) {
        colorClass = "bg-surface-high text-surface-on border-outline";
      }

      // Pre 1 osobu - v strede
      if (total === 1) {
        return {
          id: person.id,
          x: centerX,
          y: centerY,
          person,
          degree,
          pageRankScore,
          isKeyHub,
          colorClass,
          isSuspect,
          isAlibi,
        };
      }

      // Pre viac osôb - ak je podozrivý s vysokým stupňom, daj ho bližšie k stredu
      const radius = total <= 5 ? 130 : index % 2 === 0 ? 175 : 110;
      const angle = (2 * Math.PI * index) / total - Math.PI / 2;

      return {
        id: person.id,
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
        person,
        degree,
        pageRankScore,
        isKeyHub,
        colorClass,
        isSuspect,
        isAlibi,
      };
    });
  }, [persons, relationships, metricsMap]);

  const nodeMap = useMemo(() => {
    const map = new Map<string, NodePosition>();
    for (const node of nodes) {
      map.set(node.id, node);
      map.set(node.person.name.toLowerCase().trim(), node);
    }
    return map;
  }, [nodes]);

  // Prepojenia medzi uzlami
  const edges = useMemo(() => {
    return relationships
      .map((rel) => {
        const source = nodeMap.get(rel.person1_id) || nodeMap.get(rel.person1_id.toLowerCase().trim());
        const target = nodeMap.get(rel.person2_id) || nodeMap.get(rel.person2_id.toLowerCase().trim());
        if (!source || !target) return null;
        return { rel, source, target };
      })
      .filter((e): e is { rel: Relationship; source: NodePosition; target: NodePosition } => e !== null);
  }, [relationships, nodeMap]);

  // Filtrované uzly
  const visibleNodes = useMemo(() => {
    if (filterRole === "all") return nodes;
    if (filterRole === "suspect") return nodes.filter((n) => n.isSuspect);
    if (filterRole === "alibi") return nodes.filter((n) => n.isAlibi);
    if (filterRole === "witness") return nodes.filter((n) => !n.isSuspect && !n.isAlibi);
    return nodes;
  }, [nodes, filterRole]);

  // Drag & Pan logika pre mobil a desktop
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y,
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  return (
    <div className="pb-6">
      {/* Filtre a ovládanie grafu */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
          {[
            ["all", `Všetky (${nodes.length})`],
            ["suspect", "Podozriví"],
            ["alibi", "Alibi osoby"],
            ["witness", "Svedkovia"],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilterRole(id)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                filterRole === id
                  ? "bg-primary-container border-transparent text-primary-on-container font-semibold"
                  : "bg-surface-lowest border-outline-variant text-surface-on"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Zoom ovládače */}
        <div className="flex items-center gap-1 bg-surface-low rounded-lg p-1 border border-outline-variant">
          <button
            type="button"
            className="w-7 h-7 grid place-items-center rounded text-surface-on hover:bg-surface-high text-xs font-bold"
            onClick={() => setZoom((z) => Math.max(0.6, z - 0.15))}
            title="Oddialiť"
          >
            −
          </button>
          <span className="text-[11px] px-1 text-outline font-mono">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            className="w-7 h-7 grid place-items-center rounded text-surface-on hover:bg-surface-high text-xs font-bold"
            onClick={() => setZoom((z) => Math.min(1.8, z + 0.15))}
            title="Priblížiť"
          >
            +
          </button>
          <button
            type="button"
            className="text-[11px] px-2 py-0.5 rounded text-outline hover:text-surface-on"
            onClick={() => {
              setZoom(1);
              setPan({ x: 0, y: 0 });
            }}
          >
            Reset
          </button>
        </div>
      </div>

      {/* Interaktívne plátno grafu */}
      <div
        className="relative h-[380px] rounded-2xl bg-surface-low mb-4 overflow-hidden border border-outline-variant cursor-grab active:cursor-grabbing select-none shadow-inner"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <svg
          className="absolute inset-0 w-full h-full"
          viewBox="0 0 600 460"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "center center",
            transition: isDragging ? "none" : "transform 0.15s ease-out",
          }}
        >
          <defs>
            <marker
              id="arrow"
              viewBox="0 0 10 10"
              refX="22"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--md-sys-color-outline)" />
            </marker>
          </defs>

          {/* Vzťahové línie (Edges) */}
          {edges.map(({ rel, source, target }, idx) => {
            const isHighlight =
              selectedPerson &&
              (source.person.id === selectedPerson.id || target.person.id === selectedPerson.id);

            const midX = (source.x + target.x) / 2;
            const midY = (source.y + target.y) / 2;

            return (
              <g key={`edge_${idx}`} className="cursor-pointer" onClick={() => setSelectedRel(rel)}>
                <line
                  x1={source.x}
                  y1={source.y}
                  x2={target.x}
                  y2={target.y}
                  stroke={
                    isHighlight
                      ? "var(--md-sys-color-primary)"
                      : "var(--md-sys-color-outline-variant)"
                  }
                  strokeWidth={isHighlight ? 3 : 1.75}
                  strokeDasharray={rel.type.includes("konflikt") || rel.type.includes("rozpor") ? "4 4" : undefined}
                  className="transition-colors"
                />
                {/* Popis vzťahu */}
                <rect
                  x={midX - 30}
                  y={midY - 9}
                  width="60"
                  height="18"
                  rx="4"
                  fill="var(--md-sys-color-surface)"
                  stroke="var(--md-sys-color-outline-variant)"
                  strokeWidth="0.5"
                />
                <text
                  x={midX}
                  y={midY + 3}
                  textAnchor="middle"
                  fontSize="9"
                  fill="var(--md-sys-color-on-surface-variant)"
                  className="pointer-events-none font-medium"
                >
                  {rel.type.slice(0, 10)}
                </text>
              </g>
            );
          })}

          {/* Uzly (Nodes) */}
          {visibleNodes.map((node) => {
            const isSelected = selectedPerson?.id === node.id;
            return (
              <g
                key={node.id}
                transform={`translate(${node.x}, ${node.y})`}
                className="cursor-pointer transition-transform hover:scale-110"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedPerson(node.person);
                }}
              >
                <circle
                  r={isSelected ? 30 : 25}
                  className={`${
                    isSelected
                      ? "fill-primary stroke-primary-on"
                      : node.isSuspect
                      ? "fill-error stroke-error-container"
                      : "fill-primary-container stroke-primary"
                  } stroke-2 shadow-lg transition-all`}
                />
                <text
                  textAnchor="middle"
                  dy="4"
                  fontSize="12"
                  fontWeight="bold"
                  className={
                    isSelected
                      ? "fill-primary-on"
                      : node.isSuspect
                      ? "fill-error-on"
                      : "fill-primary-on-container"
                  }
                >
                  {initials(node.person.name)}
                </text>
                <text
                  textAnchor="middle"
                  dy="40"
                  fontSize="11"
                  className="fill-surface-on font-medium max-w-[120px]"
                >
                  {node.person.name}
                </text>
                {(node.isKeyHub || node.pageRankScore > 0) && (
                  <g transform="translate(18, -18)">
                    <rect
                      x="-22"
                      y="-8"
                      width="44"
                      height="16"
                      rx="8"
                      fill="var(--md-sys-color-tertiary-container)"
                    />
                    <text
                      textAnchor="middle"
                      dy="4"
                      fontSize="8"
                      fontWeight="bold"
                      className="fill-tertiary-on-container"
                      data-testid="pagerank-badge"
                    >
                      PR {(node.pageRankScore * 100).toFixed(1)}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Zoznam vzťahov pod grafom */}
      {relationships.length > 0 && (
        <div className="m3-card-filled space-y-2">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-semibold m-0 text-surface-on">
              Sieť vzťahov a väzieb ({relationships.length})
            </h4>
            <span className="text-xs text-outline font-mono">
              {nodes.length} osôb v databáze
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {relationships.map((r, i) => {
              const a = analysis.persons.find((p) => p.id === r.person1_id || p.name === r.person1_id)?.name || r.person1_id;
              const b = analysis.persons.find((p) => p.id === r.person2_id || p.name === r.person2_id)?.name || r.person2_id;
              return (
                <div
                  key={i}
                  className="p-2.5 rounded-lg bg-surface-lowest border border-outline-variant flex items-center justify-between text-xs cursor-pointer hover:border-primary transition-colors"
                  onClick={() => setSelectedRel(r)}
                >
                  <span className="font-medium text-surface-on">{a}</span>
                  <span className="px-2 py-0.5 rounded-full bg-surface-high text-outline text-[11px]">
                    {r.type}
                  </span>
                  <span className="font-medium text-surface-on">{b}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Person Detail BottomSheet */}
      <BottomSheet
        open={Boolean(selectedPerson)}
        onClose={() => setSelectedPerson(null)}
        title={selectedPerson?.name || ""}
      >
        {selectedPerson && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-primary-container text-primary-on-container">
                {selectedPerson.role || "Osoba v spise"}
              </span>
              {(() => {
                const m =
                  metricsMap.get(selectedPerson.id) ||
                  metricsMap.get(selectedPerson.name.toLowerCase().trim());
                if (!m) return null;
                return (
                  <span
                    className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-tertiary-container text-tertiary-on-container"
                    data-testid="pagerank-detail"
                  >
                    PageRank {(m.pageRankScore * 100).toFixed(2)}%
                    {m.isKeyHub ? " · kľúčový uzol" : ""}
                  </span>
                );
              })()}
              {selectedPerson.aliases && selectedPerson.aliases.length > 0 && (
                <span className="text-xs text-outline">
                  Alias: {selectedPerson.aliases.join(", ")}
                </span>
              )}
            </div>

            {selectedPerson.description && (
              <p className="text-sm text-surface-on bg-surface-low p-3 rounded-lg border border-outline-variant">
                {selectedPerson.description}
              </p>
            )}

            <div>
              <p className="text-xs font-semibold text-outline mb-1.5">Priame vzťahy v spise:</p>
              <div className="space-y-1.5">
                {relationships
                  .filter(
                    (r) =>
                      r.person1_id === selectedPerson.id ||
                      r.person2_id === selectedPerson.id ||
                      r.person1_id === selectedPerson.name ||
                      r.person2_id === selectedPerson.name
                  )
                  .map((r, idx) => {
                    const otherId = r.person1_id === selectedPerson.id ? r.person2_id : r.person1_id;
                    const otherName = analysis.persons.find((p) => p.id === otherId || p.name === otherId)?.name || otherId;
                    return (
                      <div key={idx} className="p-2 rounded bg-surface-lowest text-xs text-surface-on">
                        <span className="font-semibold">{r.type}:</span> s osobou{" "}
                        <span className="font-medium text-primary">{otherName}</span>
                        {r.description && <p className="text-outline text-[11px] mt-0.5">{r.description}</p>}
                      </div>
                    );
                  })}
              </div>
            </div>

            <button
              type="button"
              className="m3-btn-filled mt-3 w-full"
              onClick={() => setSelectedPerson(null)}
            >
              Zavrieť detail
            </button>
          </div>
        )}
      </BottomSheet>

      {/* Relationship Detail BottomSheet */}
      <BottomSheet
        open={Boolean(selectedRel)}
        onClose={() => setSelectedRel(null)}
        title="Detail vzťahu"
      >
        {selectedRel && (
          <div className="space-y-3">
            <p className="text-sm font-semibold text-surface-on">
              {selectedRel.person1_id} ↔ {selectedRel.person2_id}
            </p>
            <div className="p-3 rounded-lg bg-surface-low text-xs text-surface-on">
              <span className="font-bold">Typ väzby:</span> {selectedRel.type}
              {selectedRel.description && (
                <p className="mt-1 text-outline">{selectedRel.description}</p>
              )}
            </div>
            {selectedRel.evidence_supporting && selectedRel.evidence_supporting.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-outline mb-1">Podporujúce dôkazy:</p>
                <ul className="text-xs text-surface-on list-disc list-inside">
                  {selectedRel.evidence_supporting.map((ev, i) => (
                    <li key={i}>{ev}</li>
                  ))}
                </ul>
              </div>
            )}
            <button
              type="button"
              className="m3-btn-filled mt-3 w-full"
              onClick={() => setSelectedRel(null)}
            >
              Zavrieť
            </button>
          </div>
        )}
      </BottomSheet>
    </div>
  );
}

function initials(name: string): string {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || "")
    .join("");
}
