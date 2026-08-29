import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  trackEvent,
  trackContradictionDetected,
  trackContradictionViewed,
  trackPdfExported,
  identifyUser,
  initAnalytics,
  isAnalyticsInitialized,
  ANALYTICS_EVENTS,
  resetAnalyticsForTests,
} from "../../src/lib/analytics";

const captureMock = vi.fn();
const initMock = vi.fn();

vi.mock("posthog-js", () => ({
  default: {
    init: (...args: unknown[]) => initMock(...args),
    capture: (...args: unknown[]) => captureMock(...args),
    identify: vi.fn(),
  },
}));

describe("analytics", () => {
  beforeEach(() => {
    resetAnalyticsForTests();
    captureMock.mockReset();
    initMock.mockReset();
    vi.restoreAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.unstubAllEnvs();
  });

  it("redacts sensitive properties", () => {
    trackEvent("test_event", { email: "a@b.c", caseId: "ok", phone: "123" });
    expect(console.log).toHaveBeenCalledWith(
      "[Analytics] test_event",
      expect.objectContaining({
        email: "[REDACTED]",
        phone: "[REDACTED]",
        caseId: "ok",
      })
    );
  });

  it("hashes case id for contradiction events", () => {
    trackContradictionDetected({
      count: 2,
      hasAlibiConflict: true,
      caseId: "abcdefghijkl",
    });
    expect(console.log).toHaveBeenCalledWith(
      `[Analytics] ${ANALYTICS_EVENTS.CONTRADICTION_DETECTED}`,
      expect.objectContaining({
        case_id: "case_abcdefgh",
        has_alibi_conflict: true,
      })
    );
  });

  it("tracks contradiction_viewed with contradiction id", () => {
    trackContradictionViewed({ contradictionId: "t1", isDemo: false });
    expect(console.log).toHaveBeenCalledWith(
      `[Analytics] ${ANALYTICS_EVENTS.CONTRADICTION_VIEWED}`,
      expect.objectContaining({
        contradiction_id: "t1",
        is_demo: false,
      })
    );
  });

  it("tracks pdf_exported with format", () => {
    trackPdfExported({ format: "markdown" });
    expect(console.log).toHaveBeenCalledWith(
      `[Analytics] ${ANALYTICS_EVENTS.PDF_EXPORTED}`,
      expect.objectContaining({ format: "markdown" })
    );
  });

  it("identifyUser logs sanitized props", () => {
    identifyUser("u1", { email: "x@y.z" });
    expect(console.log).toHaveBeenCalledWith(
      "[Analytics] User identified: u1",
      expect.objectContaining({ email: "[REDACTED]" })
    );
  });

  it("merges stored UTM params into events", () => {
    vi.stubGlobal("window", globalThis);
    vi.stubGlobal("localStorage", {
      getItem: (key: string) =>
        key === "forenz_utm_data"
          ? JSON.stringify({ utm_source: "linkedin", utm_campaign: "beta" })
          : null,
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    });

    trackEvent("test_utm", { foo: "bar" });
    expect(console.log).toHaveBeenCalledWith(
      "[Analytics] test_utm",
      expect.objectContaining({
        foo: "bar",
        utm_source: "linkedin",
        utm_campaign: "beta",
      })
    );
  });

  it("sends events to PostHog when initialized", () => {
    vi.stubEnv("VITE_POSTHOG_KEY", "phc_test_key");
    vi.stubGlobal("window", globalThis);
    initAnalytics();
    expect(isAnalyticsInitialized()).toBe(true);
    trackEvent("live_event", { foo: "bar" });
    expect(captureMock).toHaveBeenCalledWith(
      "live_event",
      expect.objectContaining({ foo: "bar" })
    );
    expect(console.log).not.toHaveBeenCalledWith(
      "[Analytics] live_event",
      expect.anything()
    );
  });
});
