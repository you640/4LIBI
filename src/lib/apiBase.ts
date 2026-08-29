/** Base URL for Hono API in production (Vercel frontend → Railway API). Empty = same-origin / Vite proxy. */
export function getApiBase(): string {
  const base = import.meta.env.VITE_API_URL?.trim().replace(/\/$/, "") ?? "";
  return base;
}

export function apiPath(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const base = getApiBase();
  return base ? `${base}${normalized}` : normalized;
}
