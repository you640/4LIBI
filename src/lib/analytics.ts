// PostHog analytics (EPIC 3 — S3.1) + console.log fallback when key missing.

import posthog from "posthog-js";
import { withUtm } from "./utmTracker";

let initialized = false;

export const ANALYTICS_EVENTS = {
  CASE_CREATED: "case_created",
  CONTRADICTION_DETECTED: "contradiction_detected",
  CONTRADICTION_VIEWED: "contradiction_viewed",
  PDF_EXPORTED: "pdf_exported",
  ALIBI_CHECKED: "alibi_checked",
  ERROR_OCCURRED: "error_occurred",
  ANALYSIS_STARTED: "analysis_started",
} as const;

/** @internal Vitest only */
export function resetAnalyticsForTests(): void {
  initialized = false;
}

export function isAnalyticsInitialized(): boolean {
  return initialized;
}

export function initAnalytics(): void {
  const key = import.meta.env.VITE_POSTHOG_KEY;
  const host = import.meta.env.VITE_POSTHOG_HOST || "https://eu.i.posthog.com";

  if (!key) {
    console.warn("[Analytics] VITE_POSTHOG_KEY nie je nastavené — fallback na console.log.");
    return;
  }

  if (typeof window === "undefined") return;

  posthog.init(key, {
    api_host: host,
    disable_session_recording: true,
    persistence: "localStorage",
    autocapture: false,
    capture_pageview: false,
  });

  initialized = true;
  console.log(`[Analytics] PostHog EU initialized (${host})`);
}

function sanitizeProperties(properties: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  const sensitiveKeys = ["email", "ip", "phone", "name", "address", "password"];

  for (const [key, value] of Object.entries(properties)) {
    if (sensitiveKeys.some((s) => key.toLowerCase().includes(s))) {
      sanitized[key] = "[REDACTED]";
    } else if (typeof value === "string" && value.length > 200) {
      sanitized[key] = value.slice(0, 200) + "...";
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

export function trackEvent(
  event: string,
  properties: Record<string, unknown> = {}
): void {
  const safeProps = sanitizeProperties(withUtm(properties));

  if (initialized) {
    posthog.capture(event, safeProps);
    return;
  }

  console.log(`[Analytics] ${event}`, safeProps);
}

export function identifyUser(userId: string, properties?: Record<string, unknown>) {
  const safe = properties ? sanitizeProperties(withUtm(properties)) : undefined;
  if (initialized) {
    posthog.identify(userId, safe);
    return;
  }
  if (safe) {
    console.log(`[Analytics] User identified: ${userId}`, safe);
  } else {
    console.log(`[Analytics] User identified: ${userId}`);
  }
}

export function trackCaseCreated(properties: {
  fileCount: number;
  source: "sandbox" | "upload" | "linear";
}) {
  trackEvent(ANALYTICS_EVENTS.CASE_CREATED, properties);
}

export function trackContradictionDetected(properties: {
  count: number;
  hasAlibiConflict: boolean;
  caseId?: string;
}) {
  trackEvent(ANALYTICS_EVENTS.CONTRADICTION_DETECTED, {
    count: properties.count,
    has_alibi_conflict: properties.hasAlibiConflict,
    case_id: properties.caseId
      ? `case_${properties.caseId.substring(0, 8)}`
      : undefined,
  });
}

export function trackContradictionViewed(properties?: {
  contradictionId?: string;
}) {
  trackEvent(ANALYTICS_EVENTS.CONTRADICTION_VIEWED, {
    contradiction_id: properties?.contradictionId,
  });
}

export function trackPdfExported(properties?: { format?: string }) {
  trackEvent(ANALYTICS_EVENTS.PDF_EXPORTED, properties ?? {});
}

export function trackAlibiChecked(properties?: { caseId?: string }) {
  trackEvent(
    ANALYTICS_EVENTS.ALIBI_CHECKED,
    properties?.caseId
      ? { case_id: `case_${properties.caseId.substring(0, 8)}` }
      : {}
  );
}

export function trackErrorOccurred(properties: {
  errorType: string;
  errorMessage: string;
  context?: string;
}) {
  trackEvent(ANALYTICS_EVENTS.ERROR_OCCURRED, {
    error_type: properties.errorType,
    error_message: properties.errorMessage.slice(0, 200),
    context: properties.context,
  });
}

export function trackAnalysisStarted(properties: {
  fileCount: number;
  source: "sandbox" | "upload" | "linear";
}) {
  trackEvent(ANALYTICS_EVENTS.ANALYSIS_STARTED, properties);
}
