import type { GeoLocation, TravelFeasibilityResult } from "../types";
import { resolveLocationCoords } from "./geospatialEngine";

export interface AlibiMapMarker {
  id: string;
  label: string;
  role: "A" | "B";
  lat: number;
  lng: number;
}

export interface AlibiMapModel {
  markers: AlibiMapMarker[];
  isFeasible: boolean | null;
  distanceKm: number | null;
  emptyReason: string | null;
}

/** Transform geospatial result locations into plottable map markers. */
export function buildAlibiMapModel(
  result: TravelFeasibilityResult | null | undefined
): AlibiMapModel {
  if (!result) {
    return {
      markers: [],
      isFeasible: null,
      distanceKm: null,
      emptyReason: "Spusti overenie alibi — mapa sa zobrazí po výsledku.",
    };
  }

  const coordA = resolveLocationCoords(result.locationA);
  const coordB = resolveLocationCoords(result.locationB);
  const markers: AlibiMapMarker[] = [];

  if (coordA) {
    markers.push({
      id: "loc-a",
      label: result.locationA,
      role: "A",
      lat: coordA.lat,
      lng: coordA.lng,
    });
  }
  if (coordB) {
    markers.push({
      id: "loc-b",
      label: result.locationB,
      role: "B",
      lat: coordB.lat,
      lng: coordB.lng,
    });
  }

  if (markers.length === 0) {
    return {
      markers: [],
      isFeasible: result.isFeasible,
      distanceKm: result.distanceKm,
      emptyReason:
        "Súradnice pre tieto lokality nie sú v databáze miest — textový výsledok ostáva platný.",
    };
  }

  return {
    markers,
    isFeasible: result.isFeasible,
    distanceKm: result.distanceKm,
    emptyReason: null,
  };
}

/** Project WGS84 into SVG viewBox (Slovakia-ish bounds). */
export function projectToSvg(
  coords: GeoLocation,
  width = 320,
  height = 180,
  padding = 28
): { x: number; y: number } {
  const latMin = 47.6;
  const latMax = 49.7;
  const lngMin = 16.7;
  const lngMax = 22.6;
  const x =
    padding +
    ((coords.lng - lngMin) / (lngMax - lngMin)) * (width - padding * 2);
  const y =
    padding +
    (1 - (coords.lat - latMin) / (latMax - latMin)) * (height - padding * 2);
  return { x, y };
}
