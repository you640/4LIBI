import type { TravelFeasibilityResult } from "../../types";
import {
  buildAlibiMapModel,
  projectToSvg,
} from "../../lib/alibiMapMarkers";

interface AlibiMapProps {
  result: TravelFeasibilityResult | null | undefined;
}

export function AlibiMap({ result }: AlibiMapProps) {
  const model = buildAlibiMapModel(result);
  const width = 320;
  const height = 180;

  if (model.emptyReason || model.markers.length === 0) {
    return (
      <div
        className="mt-2 p-3 rounded-lg bg-surface-low border border-outline-variant text-xs text-outline"
        data-testid="alibi-map-empty"
      >
        {model.emptyReason || "Mapa nie je k dispozícii."}
      </div>
    );
  }

  const points = model.markers.map((m) => ({
    ...m,
    ...projectToSvg({ lat: m.lat, lng: m.lng }, width, height),
  }));

  const line =
    points.length >= 2
      ? { x1: points[0].x, y1: points[0].y, x2: points[1].x, y2: points[1].y }
      : null;

  return (
    <div
      className="mt-2 rounded-lg border border-outline-variant overflow-hidden bg-surface-lowest"
      data-testid="alibi-map"
    >
      <div className="px-2.5 pt-2 flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold text-surface-on m-0">Alibi mapa</p>
        {model.distanceKm != null && (
          <p className="text-[10px] text-outline m-0">
            {model.distanceKm} km
            {model.isFeasible === false
              ? " · nemožné"
              : model.isFeasible
                ? " · možné"
                : ""}
          </p>
        )}
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto block"
        role="img"
        aria-label="Alibi mapa s bodmi A a B"
      >
        <rect width={width} height={height} fill="#f5f2eb" />
        <path
          d="M20 40 Q80 20 160 50 T300 35"
          fill="none"
          stroke="#d6d0c4"
          strokeWidth="8"
          opacity="0.5"
        />
        {line && (
          <line
            x1={line.x1}
            y1={line.y1}
            x2={line.x2}
            y2={line.y2}
            stroke={model.isFeasible === false ? "#b3261e" : "#4a6359"}
            strokeWidth="2"
            strokeDasharray={model.isFeasible === false ? "6 4" : "0"}
          />
        )}
        {points.map((p) => (
          <g key={p.id}>
            <circle
              cx={p.x}
              cy={p.y}
              r="8"
              fill={p.role === "A" ? "#8b5a2b" : "#b3261e"}
            />
            <text
              x={p.x}
              y={p.y + 3}
              textAnchor="middle"
              fill="#fff"
              fontSize="9"
              fontWeight="700"
            >
              {p.role}
            </text>
            <text
              x={p.x}
              y={p.y + 22}
              textAnchor="middle"
              fill="#1c1b19"
              fontSize="10"
            >
              {p.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
