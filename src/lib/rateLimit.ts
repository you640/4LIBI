/**
 * rateLimit.ts — Client-side rate limit helper
 * Zabráni posielaniu viac ako MAX_REQUESTS analýz za WINDOW_MS
 * Ukladá stav do localStorage s automatickým TTL a pamäťovým fallbackom pre Node/SSR.
 */

const STORAGE_KEY = "fd_rate_limit";
const MAX_REQUESTS = 5;
const WINDOW_MS = 10 * 60 * 1000; // 10 minút

interface RateLimitEntry {
  timestamps: number[];
}

// In-memory fallback pre prostredia bez localStorage (Node.js, SSR, privátny režim)
const memoryStore = new Map<string, string>();

function getStorageItem(key: string): string | null {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      return window.localStorage.getItem(key);
    }
    if (typeof localStorage !== "undefined" && typeof localStorage.getItem === "function") {
      return localStorage.getItem(key);
    }
  } catch {
    // Fallback nižšie
  }
  return memoryStore.get(key) ?? null;
}

function setStorageItem(key: string, value: string): void {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(key, value);
      return;
    }
    if (typeof localStorage !== "undefined" && typeof localStorage.setItem === "function") {
      localStorage.setItem(key, value);
      return;
    }
  } catch {
    // Fallback nižšie
  }
  memoryStore.set(key, value);
}

function removeStorageItem(key: string): void {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.removeItem(key);
    }
    if (typeof localStorage !== "undefined" && typeof localStorage.removeItem === "function") {
      localStorage.removeItem(key);
    }
  } catch {
    // Fallback nižšie
  }
  memoryStore.delete(key);
}

function loadEntries(): RateLimitEntry {
  try {
    const raw = getStorageItem(STORAGE_KEY);
    if (!raw) return { timestamps: [] };
    const parsed = JSON.parse(raw) as RateLimitEntry;
    // Vyfiltruj expirované záznamy
    const now = Date.now();
    parsed.timestamps = parsed.timestamps.filter(
      (ts) => now - ts < WINDOW_MS
    );
    return parsed;
  } catch {
    return { timestamps: [] };
  }
}

function saveEntries(entry: RateLimitEntry): void {
  setStorageItem(STORAGE_KEY, JSON.stringify(entry));
}

/**
 * Skontroluje či je možné odoslať ďalšiu analýzu.
 * @returns `{ allowed: true }` ak je v limite
 * @returns `{ allowed: false, retryAfterMs: number, retryAfterSec: number }` ak je limit prekročený
 */
export function checkRateLimit():
  | { allowed: true }
  | { allowed: false; retryAfterMs: number; retryAfterSec: number } {
  const entry = loadEntries();
  const now = Date.now();

  if (entry.timestamps.length < MAX_REQUESTS) {
    // Pridaj aktuálny timestamp
    entry.timestamps.push(now);
    saveEntries(entry);
    return { allowed: true };
  }

  // Najstarší timestamp — za koľko vyexpiruje
  const oldest = Math.min(...entry.timestamps);
  const retryAfterMs = WINDOW_MS - (now - oldest);
  return {
    allowed: false,
    retryAfterMs,
    retryAfterSec: Math.ceil(retryAfterMs / 1000),
  };
}

/**
 * Vráti počet zostávajúcich analýz v aktuálnom okne.
 */
export function getRemainingAttempts(): number {
  const entry = loadEntries();
  return Math.max(0, MAX_REQUESTS - entry.timestamps.length);
}

/**
 * Vráti počet sekúnd do resetu limitu (0 ak nie je limit).
 */
export function getRetryAfterSec(): number {
  const entry = loadEntries();
  if (entry.timestamps.length < MAX_REQUESTS) return 0;
  const oldest = Math.min(...entry.timestamps);
  const retryAfterMs = WINDOW_MS - (Date.now() - oldest);
  return Math.max(0, Math.ceil(retryAfterMs / 1000));
}

/**
 * Vyčistí rate limit stav (napr. po odhlásení alebo pre testy).
 */
export function clearRateLimit(): void {
  removeStorageItem(STORAGE_KEY);
}
