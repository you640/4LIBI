import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  checkRateLimit,
  getRemainingAttempts,
  getRetryAfterSec,
  clearRateLimit,
} from "../../src/lib/rateLimit";

describe("rateLimit", () => {
  beforeEach(() => {
    clearRateLimit();
    vi.restoreAllMocks();
  });

  it("allows requests up to max limit and tracks remaining attempts", () => {
    expect(getRemainingAttempts()).toBe(5);

    for (let i = 0; i < 5; i++) {
      const res = checkRateLimit();
      expect(res.allowed).toBe(true);
    }

    expect(getRemainingAttempts()).toBe(0);

    const blocked = checkRateLimit();
    expect(blocked.allowed).toBe(false);
    if (!blocked.allowed) {
      expect(blocked.retryAfterMs).toBeGreaterThan(0);
      expect(blocked.retryAfterSec).toBeGreaterThan(0);
    }
  });

  it("resets attempts after window expires", () => {
    const now = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(now);

    for (let i = 0; i < 5; i++) {
      checkRateLimit();
    }
    expect(checkRateLimit().allowed).toBe(false);

    // Fast-forward past 10 minutes
    vi.spyOn(Date, "now").mockReturnValue(now + 10 * 60 * 1000 + 1000);

    expect(getRemainingAttempts()).toBe(5);
    expect(getRetryAfterSec()).toBe(0);
    expect(checkRateLimit().allowed).toBe(true);
  });

  it("clearRateLimit resets stored attempts", () => {
    checkRateLimit();
    checkRateLimit();
    expect(getRemainingAttempts()).toBe(3);

    clearRateLimit();
    expect(getRemainingAttempts()).toBe(5);
  });
});
