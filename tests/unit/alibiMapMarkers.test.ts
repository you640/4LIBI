import { describe, it, expect } from "vitest";
import {
  buildAlibiMapModel,
  projectToSvg,
} from "../../src/lib/alibiMapMarkers";
import type { TravelFeasibilityResult } from "../../src/types";

const sampleResult: TravelFeasibilityResult = {
  isFeasible: false,
  distanceKm: 400,
  travelMinutesAvailable: 60,
  minTravelMinutesRequired: 250,
  requiredSpeedKmh: 400,
  severity: "critical",
  explanation: "Nemožné",
  locationA: "Bratislava",
  locationB: "Košice",
};

describe("alibiMapMarkers", () => {
  it("returns empty reason when result is missing", () => {
    const model = buildAlibiMapModel(null);
    expect(model.markers).toHaveLength(0);
    expect(model.emptyReason).toMatch(/Spusti overenie/i);
  });

  it("maps BA–KE result to two markers", () => {
    const model = buildAlibiMapModel(sampleResult);
    expect(model.emptyReason).toBeNull();
    expect(model.markers).toHaveLength(2);
    expect(model.markers[0].role).toBe("A");
    expect(model.markers[0].label).toBe("Bratislava");
    expect(model.markers[1].role).toBe("B");
    expect(model.markers[1].label).toBe("Košice");
    expect(model.isFeasible).toBe(false);
    expect(model.distanceKm).toBe(400);
  });

  it("returns empty reason for unknown cities", () => {
    const model = buildAlibiMapModel({
      ...sampleResult,
      locationA: "NeznámeMestoXYZ",
      locationB: "InéNeznámeABC",
    });
    expect(model.markers).toHaveLength(0);
    expect(model.emptyReason).toMatch(/Súradnice/i);
  });

  it("projects coords into svg bounds", () => {
    const p = projectToSvg({ lat: 48.15, lng: 17.11 });
    expect(p.x).toBeGreaterThan(0);
    expect(p.y).toBeGreaterThan(0);
    expect(p.x).toBeLessThan(320);
    expect(p.y).toBeLessThan(180);
  });
});
