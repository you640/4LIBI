import { describe, it, expect } from "vitest";
import { mapWithAdaptiveConcurrency } from "../../src/lib/adaptiveConcurrency";

describe("adaptiveConcurrency", () => {
  it("maps all items successfully", async () => {
    const results = await mapWithAdaptiveConcurrency(
      [1, 2, 3, 4],
      2,
      4,
      async (n) => n * 2
    );
    expect(results.every((r) => r.ok)).toBe(true);
    expect(results.map((r) => r.res)).toEqual([2, 4, 6, 8]);
  });

  it("captures worker errors without aborting siblings", async () => {
    const results = await mapWithAdaptiveConcurrency(
      [1, 2, 3],
      1,
      2,
      async (n) => {
        if (n === 2) throw { status: 429 };
        return n;
      }
    );
    expect(results[0].ok).toBe(true);
    expect(results[1].ok).toBe(false);
    expect(results[2].ok).toBe(true);
  });
});
