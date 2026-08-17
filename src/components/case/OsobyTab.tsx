import { useState } from "react";
import { useCaseContext } from "../../lib/caseContext";
import { BottomSheet } from "../m3/BottomSheet";
import type { Person } from "../../types";

export function OsobyTab() {
  const { analysis } = useCaseContext();
  const [selected, setSelected] = useState<Person | null>(null);

  return (
    <div className="pb-4">
      <div className="m3-card-filled">
        {analysis.persons.map((person) => (
          <button
            key={person.id}
            type="button"
            onClick={() => setSelected(person)}
            className="flex items-center gap-3 w-full text-left py-3 border-0 border-b border-outline-variant last:border-b-0 bg-transparent"
          >
            <span className="w-11 h-11 rounded-full grid place-items-center text-xs font-semibold bg-primary-container text-primary-on-container flex-shrink-0">
              {person.name
                .split(/\s+/)
                .slice(0, 2)
                .map((p) => p[0]?.toUpperCase() || "")
                .join("")}
            </span>
            <span className="min-w-0">
              <span className="block text-[15px] font-semibold text-surface-on">
                {person.name}
              </span>
              <span className="block text-[11px] text-outline truncate">
                {person.role}
                {person.description ? ` · ${person.description}` : ""}
              </span>
            </span>
          </button>
        ))}
        {analysis.persons.length === 0 && (
          <p className="text-sm text-outline text-center py-8 m-0">Žiadne osoby.</p>
        )}
      </div>

      <BottomSheet
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected?.name || ""}
      >
        {selected && (
          <>
            <p className="text-sm mb-1">
              <span className="text-outline">Rola: </span>
              {selected.role}
            </p>
            {selected.description && (
              <p className="text-sm text-surface-on mb-4">{selected.description}</p>
            )}
            <button
              type="button"
              className="m3-btn-text m3-btn-text-muted"
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
