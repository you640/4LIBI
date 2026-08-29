import type { Analysis, TimelineEvent, TravelFeasibilityResult } from "../types";
import { evaluateTravelFeasibility } from "./geospatialEngine";

export interface GeospatialCheckInput {
  locA: string;
  timeA: string;
  locB: string;
  timeB: string;
  personName?: string;
}

export function timestampToHHMM(ts: string | null | undefined): string {
  if (!ts) return "12:00";
  const d = new Date(ts);
  if (!Number.isNaN(d.getTime())) {
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }
  const m = String(ts).match(/(\d{1,2})[:.](\d{2})/);
  if (m?.[1] && m[2]) {
    return `${m[1].padStart(2, "0")}:${m[2]}`;
  }
  return "12:00";
}

export function extractCityFromLocation(loc: string): string {
  const trimmed = loc.trim();
  if (!trimmed) return trimmed;
  const parts = trimmed.split(",").map((p) => p.trim());
  const last = parts[parts.length - 1];
  if (last && last.length >= 3) return last;
  return trimmed;
}

function personNameForEvent(analysis: Analysis, event: TimelineEvent): string {
  const pid = event.persons_involved?.[0];
  if (!pid) return "Podozrivá osoba";
  const person = analysis.persons.find((p) => p.id === pid || p.name === pid);
  return person?.name || pid;
}

function hasAlibiTag(event: TimelineEvent): boolean {
  return (event.tags || []).some((t) => t.toLowerCase().includes("alibi"));
}

function hasRozporTag(event: TimelineEvent): boolean {
  return (event.tags || []).some((t) => t.toLowerCase().includes("rozpor"));
}

/** Derive two locations/times to check travel feasibility for an alibi-related event. */
export function deriveGeospatialCheck(
  analysis: Analysis,
  event: TimelineEvent
): GeospatialCheckInput | null {
  if (!hasAlibiTag(event)) return null;

  const withLocation = analysis.timeline.filter((e) => e.location?.trim());
  const alibiClaim = withLocation.find(
    (e) => hasAlibiTag(e) && !hasRozporTag(e)
  );
  const rozporEvent =
    withLocation.find((e) => e.id === event.id && hasRozporTag(e)) ||
    withLocation.find((e) => hasRozporTag(e) && e.id !== alibiClaim?.id);

  const locA = alibiClaim?.location
    ? extractCityFromLocation(alibiClaim.location)
    : null;
  const locB = rozporEvent?.location
    ? extractCityFromLocation(rozporEvent.location)
    : event.location
      ? extractCityFromLocation(event.location)
      : null;

  if (!locA || !locB || locA.toLowerCase() === locB.toLowerCase()) {
    return null;
  }

  const timeA = timestampToHHMM(alibiClaim?.timestamp || event.timestamp);
  const timeB = timestampToHHMM(
    rozporEvent?.timestamp || event.timestamp
  );

  return {
    locA,
    timeA,
    locB,
    timeB,
    personName: personNameForEvent(analysis, rozporEvent || event),
  };
}

export function evaluateGeospatialLocal(
  input: GeospatialCheckInput
): TravelFeasibilityResult | null {
  return evaluateTravelFeasibility(
    input.locA,
    input.timeA,
    input.locB,
    input.timeB,
    input.personName
  );
}

export function feasibilityLabel(result: TravelFeasibilityResult): string {
  return result.isFeasible ? "Realistický presun" : "Fyzikálne nemožné";
}
