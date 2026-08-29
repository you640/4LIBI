#!/usr/bin/env node
/**
 * Health check for deploy scripts and CI.
 * Usage: node scripts/health-check.mjs [URL]
 * Default: http://127.0.0.1:5176/api/health
 */
const url =
  process.argv[2] ||
  process.env.HEALTH_URL ||
  "http://127.0.0.1:5176/api/health";

try {
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) {
    console.error(`Health check failed: HTTP ${res.status} ${url}`);
    process.exit(1);
  }
  const body = await res.json();
  if (body?.status !== "ok") {
    console.error(`Health check failed: unexpected body`, body);
    process.exit(1);
  }
  console.log(`OK ${url}`, body);
} catch (err) {
  console.error(`Health check error: ${url}`, err);
  process.exit(1);
}
