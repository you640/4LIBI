import { describe, it, expect } from "vitest";
import {
  classifyRelationship,
  calculateGraphMetrics,
  RELATIONSHIP_TYPES,
} from "../../src/lib/graphMetrics";

describe("graphMetrics", () => {
  it("classifies relationship types", () => {
    expect(classifyRelationship({ label: "spolupáchateľ" }).type).toBe(
      RELATIONSHIP_TYPES.SPOLUPACHATEL
    );
    expect(classifyRelationship({ description: "platba na účet" }).type).toBe(
      RELATIONSHIP_TYPES.FINANCIE
    );
    expect(classifyRelationship({ label: "neznámy" }).type).toBe(
      RELATIONSHIP_TYPES.KONTAKT
    );
  });

  it("calculates degree and hubs", () => {
    const { nodesWithMetrics, topSuspects } = calculateGraphMetrics(
      [
        { id: "a", name: "A", role: "podozrivý" },
        { id: "b", name: "B" },
        { id: "c", name: "C" },
        { id: "d", name: "D" },
      ],
      [
        { person1_id: "a", person2_id: "b" },
        { person1_id: "a", person2_id: "c" },
        { person1_id: "a", person2_id: "d" },
      ]
    );
    const hub = nodesWithMetrics.find((n) => n.id === "a");
    expect(hub?.degree).toBe(3);
    expect(hub?.isKeyHub).toBe(true);
    expect(topSuspects.some((n) => n.id === "a")).toBe(true);
  });
});
