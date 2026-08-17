import { useMemo, useState } from "react";
import { useCaseContext } from "../../lib/caseContext";
import { BottomSheet } from "../m3/BottomSheet";
import type { Person } from "../../types";

export function GrafTab() {
  const { analysis } = useCaseContext();
  const [selected, setSelected] = useState<Person | null>(null);

  const center = analysis.persons[0];
  const satellites = analysis.persons.slice(1, 4);

  const positions = useMemo(() => {
    const coords = [
      { left: "22%", top: "25%" },
      { left: "80%", top: "28%" },
      { left: "70%", top: "78%" },
    ];
    return satellites.map((p, i) => ({ person: p, ...coords[i] }));
  }, [satellites]);

  return (
    <div className="pb-4">
      <p className="text-sm text-outline mb-3">Satelitné väzby — klikni na uzol</p>
      <div className="relative h-[280px] rounded-2xl bg-surface-low mb-4 overflow-hidden">
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 280" aria-hidden>
          {positions.map((_, i) => {
            const ends = [
              [90, 70],
              [320, 80],
              [280, 220],
            ][i];
            return (
              <line
                key={i}
                x1={200}
                y1={140}
                x2={ends[0]}
                y2={ends[1]}
                stroke="var(--md-sys-color-outline-variant)"
                strokeWidth={2}
              />
            );
          })}
        </svg>

        {center && (
          <button
            type="button"
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1.5 bg-transparent border-0"
            onClick={() => setSelected(center)}
          >
            <span className="w-[72px] h-[72px] rounded-full grid place-items-center text-sm font-semibold bg-primary text-primary-on shadow">
              {initials(center.name)}
            </span>
            <span className="text-[11px] text-center max-w-[100px] text-surface-on">
              {center.name}
            </span>
          </button>
        )}

        {positions.map(({ person, left, top }) => (
          <button
            key={person.id}
            type="button"
            className="absolute flex flex-col items-center gap-1.5 bg-transparent border-0 -translate-x-1/2 -translate-y-1/2"
            style={{ left, top }}
            onClick={() => setSelected(person)}
          >
            <span className="w-14 h-14 rounded-full grid place-items-center text-sm font-semibold bg-primary-container text-primary-on-container shadow">
              {initials(person.name)}
            </span>
            <span className="text-[11px] text-center max-w-[100px] text-surface-on">
              {person.name}
            </span>
          </button>
        ))}
      </div>

      {analysis.relationships.length > 0 && (
        <div className="m3-card-filled space-y-2">
          <p className="text-sm font-semibold m-0 mb-2">Vzťahy</p>
          {analysis.relationships.map((r, i) => {
            const a = analysis.persons.find((p) => p.id === r.person1_id)?.name;
            const b = analysis.persons.find((p) => p.id === r.person2_id)?.name;
            return (
              <p key={i} className="text-sm m-0 text-surface-on">
                <span className="font-medium">{a}</span> — {r.type} —{" "}
                <span className="font-medium">{b}</span>
              </p>
            );
          })}
        </div>
      )}

      <BottomSheet
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected?.name || ""}
      >
        {selected && (
          <>
            <p className="text-sm text-outline mb-2">
              {selected.role}
              {selected.description ? ` · ${selected.description}` : ""}
            </p>
            <button
              type="button"
              className="m3-btn-filled mt-2"
              onClick={() => setSelected(null)}
            >
              Zavrieť
            </button>
          </>
        )}
      </BottomSheet>
    </div>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || "")
    .join("");
}
