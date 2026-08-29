#!/usr/bin/env node
/**
 * Railway Private Network wire-up for ForenzDetectiv API.
 * Prerequisites: `railway login` + project linked (or pass PROJECT_ID).
 *
 * Usage:
 *   node scripts/railway-wire-up.mjs
 *
 * Env (optional overrides):
 *   RAILWAY_PROJECT_ID  default: 0f677779-9314-4e57-a62e-84d2fcc9e3aa
 *   RAILWAY_ENVIRONMENT default: production / first env
 *   MISTRAL_API_KEY     required for real analysis
 *   JWT_SECRET          optional — generated if missing
 *   API_KEY             optional — generated if missing
 */
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";

const PROJECT_ID =
  process.env.RAILWAY_PROJECT_ID || "0f677779-9314-4e57-a62e-84d2fcc9e3aa";
const ENV_ID =
  process.env.RAILWAY_ENVIRONMENT_ID || "50e9dfff-3e00-4239-b6e0-853e70e81094";

function run(args, opts = {}) {
  const r = spawnSync("railway", args, {
    encoding: "utf8",
    shell: true,
    ...opts,
  });
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  if (r.status !== 0 && !opts.allowFail) {
    throw new Error(`railway ${args.join(" ")} failed (${r.status})`);
  }
  return r;
}

function runJson(args) {
  const r = run([...args, "--json"], { allowFail: true });
  try {
    return JSON.parse(r.stdout || "null");
  } catch {
    return null;
  }
}

function genSecret(bytes = 32) {
  return crypto.randomBytes(bytes).toString("base64url");
}

console.log("[railway-wire-up] linking project", PROJECT_ID);
run(["link", "--project", PROJECT_ID, "--environment", ENV_ID], {
  allowFail: true,
});

const who = run(["whoami"], { allowFail: true });
if (who.status !== 0) {
  console.error("Not logged in. Run: railway login");
  process.exit(1);
}

let services = runJson(["service", "list"]) || [];
if (!Array.isArray(services)) {
  // newer CLI may return { services: [...] }
  services = services?.services || services?.data || [];
}
console.log(
  "[railway-wire-up] services:",
  services.map((s) => s.name || s.serviceName || s.id).join(", ") || "(none)"
);

const names = services.map((s) =>
  String(s.name || s.serviceName || "").toLowerCase()
);
const hasRedis = names.some((n) => n.includes("redis"));
const hasPostgres = names.some(
  (n) => n.includes("postgres") || n.includes("postgresql")
);

if (!hasPostgres) {
  console.log("[railway-wire-up] adding Postgres…");
  run(["add", "--database", "postgres", "--json"], { allowFail: true });
}

if (!hasRedis) {
  console.log("[railway-wire-up] adding Redis…");
  run(["add", "--database", "redis", "--json"]);
}

// Refresh service list
services = runJson(["service", "list"]) || [];
if (!Array.isArray(services)) {
  services = services?.services || services?.data || [];
}

function findService(...needles) {
  return services.find((s) => {
    const n = String(s.name || s.serviceName || "").toLowerCase();
    return needles.some((needle) => n.includes(needle));
  });
}

const postgres = findService("postgres", "postgresql");
const redis = findService("redis");
let api = findService("api", "forenz", "4libi", "web");

if (!api) {
  console.log("[railway-wire-up] creating API service…");
  // Prefer GitHub deploy if repo is reachable; else empty service for railway up
  const add = run(
    [
      "add",
      "--service",
      "api",
      "--repo",
      "you640/4LIBI",
      "--branch",
      "main",
      "--json",
    ],
    { allowFail: true }
  );
  if (add.status !== 0) {
    run(["add", "--service", "api", "--json"]);
  }
  services = runJson(["service", "list"]) || [];
  if (!Array.isArray(services)) {
    services = services?.services || services?.data || [];
  }
  api = findService("api", "forenz", "4libi");
}

if (!api) {
  console.error("Could not find/create API service");
  process.exit(1);
}

const apiName = api.name || api.serviceName || "api";
const pgName = postgres?.name || postgres?.serviceName || "Postgres";
const redisName = redis?.name || redis?.serviceName || "Redis";

console.log("[railway-wire-up] API service:", apiName);
console.log("[railway-wire-up] Postgres:", pgName, "| Redis:", redisName);

run(["service", "link", apiName], { allowFail: true });

const jwt = process.env.JWT_SECRET || genSecret(32);
const apiKey = process.env.API_KEY || genSecret(24);
const mistral = process.env.MISTRAL_API_KEY || "";

const vars = [
  `DATABASE_URL=\${{${pgName}.DATABASE_URL}}`,
  `REDIS_URL=\${{${redisName}.REDIS_URL}}`,
  `NODE_ENV=production`,
  `HOST=0.0.0.0`,
  `JWT_SECRET=${jwt}`,
  `API_KEY=${apiKey}`,
];

if (mistral) {
  vars.push(`MISTRAL_API_KEY=${mistral}`);
} else {
  console.warn(
    "[railway-wire-up] MISTRAL_API_KEY not set — set it manually in Railway UI"
  );
}

for (const pair of vars) {
  console.log("[railway-wire-up] set", pair.split("=")[0]);
  run(
    ["variable", "set", pair, "--service", apiName, "--skip-deploys"],
    { allowFail: false }
  );
}

console.log("\n[railway-wire-up] done.");
console.log("Next: railway up --service", apiName, "  OR connect GitHub + redeploy");
console.log("Then: railway domain --service", apiName);
console.log("Health: curl https://<domain>/api/health");
console.log("\nSave for beta testers (shown once):");
console.log("  API_KEY=", apiKey);
if (!process.env.JWT_SECRET) console.log("  JWT_SECRET=(generated, stored on Railway)");
