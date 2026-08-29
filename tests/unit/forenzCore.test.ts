import { describe, it, expect } from "vitest";
import {
  parseTimeToMinutes,
  formatMinutes,
  removeDiacritics,
  levenshtein,
  namesMatch,
} from "../../src/lib/forenzCore";

describe("forenzCore", () => {
  it("parses and formats time", () => {
    expect(parseTimeToMinutes("14:30")).toBe(870);
    expect(parseTimeToMinutes("14.05")).toBe(845);
    expect(parseTimeToMinutes("bad")).toBeNull();
    expect(formatMinutes(870)).toBe("14:30");
    expect(formatMinutes(null)).toBe("00:00");
  });

  it("removes diacritics and matches names", () => {
    expect(removeDiacritics("Ján")).toBe("jan");
    expect(namesMatch("Ján Novák", "Jan Novak")).toBe(true);
    expect(namesMatch("Peter", "Pavol")).toBe(false);
  });

  it("computes levenshtein distance", () => {
    expect(levenshtein("kit", "sit")).toBe(1);
    expect(levenshtein("", "abc")).toBe(3);
  });
});
