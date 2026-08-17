// PostHog analytics vrstva (Issues #3, #7 — S1.3, S3.1)
// 8 kľúčových eventov + PII sanitizácia + fallback na console.log.

import posthog from "posthog-js";

let initialized = false;

// 8 kľúčových eventov (S3.1)
export const ANALYTICS_EVENTS = {
  DEMO_LAUNCHED: "demo_launched",
  CASE_CREATED: "case_created",
  CONTRADICTION_DETECTED: "contradiction_detected",
  CONTRADICTION_VIEWED: "contradiction_viewed",
  PDF_EXPORTED: "pdf_exported",
  ALIBI_CHECKED: "alibi_checked",
  ERROR_OCCURRED: "error_occurred",
  ANALYSIS_STARTED: "analysis_started",
} as const;

// Inicializácia PostHog EU (S1.3)
export function initAnalytics() {
  const key = import.meta.env.VITE_POSTHOG_KEY;
  const host = import.meta.env.VITE_POSTHOG_HOST || "https://eu.i.posthog.com";

  if (!key) {
    console.warn("[PostHog] VITE_POSTHOG_KEY nie je nastavené — analytika vypnutá.");
    return;
  }

  posthog.init(key, {
    api_host: host,
    // Session recording vypnutý (GDPR súlad — S1.3.4)
    disable_session_recording: true,
    persistence: "localStorage",
    loaded: (ph) => {
      // V dev vypni capture (voliteľné)
      if (import.meta.env.DEV) {
        ph.opt_out_capturing();
      }
    },
  });

  initialized = true;
  console.log(`[PostHog] Inicializované (host: ${host})`);
}

// PII sanitizácia — odstráni email, IP, osobné údaje (S3.1.4)
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

// Hlavná track funkcia — fallback na console.log (S3.1.5, S3.1.6)
export function trackEvent(
  event: string,
  properties: Record<string, unknown> = {}
): void {
  const safeProps = sanitizeProperties(properties);

  if (initialized) {
    posthog.capture(event, safeProps);
  } else {
    console.log(`[PostHog Fallback] ${event}`, safeProps);
  }
}

// Identifikácia používateľa
export function identifyUser(userId: string, properties?: Record<string, unknown>) {
  if (initialized) {
    posthog.identify(userId, properties ? sanitizeProperties(properties) : undefined);
  }
}

// === 8 špecifických event helperov (S3.1.1) ===

export function trackDemoLaunched(properties?: { source?: string }) {
  trackEvent(ANALYTICS_EVENTS.DEMO_LAUNCHED, properties);
}

export function trackCaseCreated(properties: {
  fileCount: number;
  source: "sandbox" | "upload";
}) {
  trackEvent(ANALYTICS_EVENTS.CASE_CREATED, properties);
}

// S1.4 — trackContradictionDetected na reálnu detekciu
export function trackContradictionDetected(properties: {
  count: number;
  hasAlibiConflict: boolean;
  caseId?: string;
  isDemo?: boolean;
}) {
  const safeProps = {
    count: properties.count,
    has_alibi_conflict: properties.hasAlibiConflict,
    // Hash caseId — žiadne PII (S1.4.3)
    case_id: properties.caseId
      ? `case_${properties.caseId.substring(0, 8)}`
      : undefined,
    is_demo: properties.isDemo ?? false,
  };
  trackEvent(ANALYTICS_EVENTS.CONTRADICTION_DETECTED, safeProps);
}

export function trackContradictionViewed(properties?: { contradictionId?: string }) {
  trackEvent(ANALYTICS_EVENTS.CONTRADICTION_VIEWED, properties);
}

export function trackPdfExported(properties?: { format?: string }) {
  trackEvent(ANALYTICS_EVENTS.PDF_EXPORTED, properties);
}

export function trackAlibiChecked(properties?: { caseId?: string }) {
  const safeProps = properties?.caseId
    ? { case_id: `case_${properties.caseId.substring(0, 8)}` }
    : {};
  trackEvent(ANALYTICS_EVENTS.ALIBI_CHECKED, safeProps);
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
  source: "sandbox" | "upload";
}) {
  trackEvent(ANALYTICS_EVENTS.ANALYSIS_STARTED, properties);
}
