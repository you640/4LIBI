import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AlibiMap } from "../../src/components/case/AlibiMap";
import type { TravelFeasibilityResult } from "../../src/types";

const baKe: TravelFeasibilityResult = {
  isFeasible: false,
  distanceKm: 400,
  travelMinutesAvailable: 45,
  minTravelMinutesRequired: 250,
  requiredSpeedKmh: 533,
  severity: "critical",
  explanation: "Nemožný presun",
  locationA: "Bratislava",
  locationB: "Košice",
};

describe("AlibiMap", () => {
  it("shows empty state without result", () => {
    render(<AlibiMap result={null} />);
    expect(screen.getByTestId("alibi-map-empty")).toBeInTheDocument();
  });

  it("renders map with markers after geospatial result", () => {
    render(<AlibiMap result={baKe} />);
    expect(screen.getByTestId("alibi-map")).toBeInTheDocument();
    expect(screen.getByText("Bratislava")).toBeInTheDocument();
    expect(screen.getByText("Košice")).toBeInTheDocument();
  });
});
