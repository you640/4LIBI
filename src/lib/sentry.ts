// Sentry inicializácia (Issue #2 — S1.1)
// Aktivuje sa len ak je VITE_SENTRY_DSN nastavené, inak tichý no-op.

import * as Sentry from "@sentry/react";

let initialized = false;

export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  const environment = import.meta.env.VITE_SENTRY_ENV || import.meta.env.MODE || "development";

  if (!dsn) {
    console.warn("[Sentry] VITE_SENTRY_DSN nie je nastavené — error monitoring vypnutý.");
    return;
  }

  Sentry.init({
    dsn,
    environment,
    // Nízky sample rate v produkcii (10%), 100% v dev
    tracesSampleRate: environment === "production" ? 0.1 : 1.0,
    // Replay vypnutý (GDPR súlad)
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    integrations: [
      // BrowserTracing pre performance monitoring
      Sentry.browserTracingIntegration(),
    ],
  });

  initialized = true;
  console.log(`[Sentry] Inicializované (env: ${environment})`);
}

export function captureException(error: Error | unknown, context?: Record<string, any>) {
  if (!initialized) {
    console.error("[Sentry Fallback]", error, context);
    return;
  }
  Sentry.captureException(error, { extra: context });
}

export function isSentryInitialized() {
  return initialized;
}
