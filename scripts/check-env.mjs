#!/usr/bin/env node
/**
 * check-env.mjs — ForenzDetectiv ENV validator
 * Spustí sa pred serverom a overí všetky povinné premenné.
 * Ak niečo chýba → jasná chyba + exit(1)
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

// --- Načítaj .env ak existuje (len pre lokálny dev) ---
const envPath = resolve(process.cwd(), ".env");
if (existsSync(envPath)) {
  const lines = readFileSync(envPath, "utf-8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
    if (key && !process.env[key]) process.env[key] = val;
  }
}

// --- Farby pre terminál ---
const R = "\x1b[31m"; // red
const G = "\x1b[32m"; // green
const Y = "\x1b[33m"; // yellow
const B = "\x1b[1m";  // bold
const X = "\x1b[0m";  // reset

const errors = [];
const warnings = [];

function required(key, description, validator) {
  const val = process.env[key];
  if (!val || val.trim() === "") {
    errors.push(`  ${R}✗${X} ${B}${key}${X} — ${description}`);
    return;
  }
  if (validator) {
    const err = validator(val.trim());
    if (err) {
      errors.push(`  ${R}✗${X} ${B}${key}${X} — ${err}`);
      return;
    }
  }
  console.log(`  ${G}✓${X} ${key}`);
}

function optional(key, description) {
  const val = process.env[key];
  if (!val || val.trim() === "") {
    warnings.push(`  ${Y}⚠${X} ${B}${key}${X} — ${description} (voliteľné)`);
  } else {
    console.log(`  ${G}✓${X} ${key}`);
  }
}

// --- Validators ---
const isPostgresUrl = (v) =>
  v.startsWith("postgresql://") || v.startsWith("postgres://")
    ? null
    : 'Musí začínať "postgresql://" alebo "postgres://"';

const isRedisUrl = (v) =>
  v.startsWith("redis://") || v.startsWith("rediss://")
    ? null
    : 'Musí začínať "redis://" alebo "rediss://"';

const isJwtLong = (v) =>
  v.length >= 32 ? null : `Príliš krátky — min. 32 znakov, máš ${v.length}`;

const isMistralKey = (v) =>
  v.length >= 16 ? null : "Príliš krátky — skontroluj hodnotu";

// --- Spusti kontroly ---
console.log(`\n${B}🔍 ForenzDetectiv — ENV kontrola${X}\n`);
console.log(`${B}[ POVINNÉ — SERVER ]${X}`);
required("DATABASE_URL", "PostgreSQL connection string", isPostgresUrl);
required("REDIS_URL",    "Redis connection string pre BullMQ frontu", isRedisUrl);
required("MISTRAL_API_KEY", "Mistral / Pixtral API kľúč", isMistralKey);

console.log(`\n${B}[ POVINNÉ — AUTH (keď ENABLE_AUTH=true) ]${X}`);
const authEnabled = process.env.ENABLE_AUTH !== "false";
if (authEnabled) {
  required("JWT_SECRET", "JWT Secret pre tokeny", isJwtLong);
  required("API_KEY",    "API Key pre x-api-key header");
} else {
  console.log(`  ${Y}⚠${X} Auth vypnutá (ENABLE_AUTH=false) — JWT_SECRET a API_KEY sa nekontrolujú`);
}

console.log(`\n${B}[ POVINNÉ — CORS ]${X}`);
required("ALLOWED_ORIGINS", "Povolené originy pre CORS (čiarkou oddelené URL)");

console.log(`\n${B}[ VOLITEĽNÉ — FRONTEND ]${X}`);
optional("VITE_API_URL",          "URL Railway API pre Vercel frontend");
optional("VITE_POSTHOG_KEY",      "PostHog EU analytics kľúč");
optional("VITE_POSTHOG_HOST",     "PostHog EU host URL");
optional("VITE_SENTRY_DSN",       "Sentry DSN pre error monitoring");
optional("VITE_STRIPE_PUBLIC_KEY","Stripe public key pre platby");

console.log(`\n${B}[ VOLITEĽNÉ — INTEGRÁCIE ]${X}`);
optional("GOOGLE_CLIENT_ID",      "Google OAuth Client ID");
optional("GOOGLE_CLIENT_SECRET",  "Google OAuth Client Secret");
optional("MISTRAL_BACKUP_API_KEY","Záložný Mistral kľúč");
optional("SENTRY_AUTH_TOKEN",     "Sentry auth token pre source maps");

// --- Výsledok ---
console.log("");
if (warnings.length > 0) {
  console.log(`${Y}${B}Upozornenia (${warnings.length}):${X}`);
  warnings.forEach((w) => console.log(w));
  console.log("");
}

if (errors.length > 0) {
  console.log(`${R}${B}✗ ENV kontrola ZLYHALA (${errors.length} chýb):${X}`);
  errors.forEach((e) => console.log(e));
  console.log(`\n${B}➜ Skopíruj .env.example do .env a doplň chýbajúce hodnoty.${X}\n`);
  process.exit(1);
}

console.log(`${G}${B}✓ Všetky povinné ENV premenné sú nastavené.${X}\n`);
