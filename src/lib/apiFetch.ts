import { apiPath } from "./apiBase";

let sessionPromise: Promise<void> | null = null;

export async function ensureSession(): Promise<void> {
  if (typeof window === "undefined") return;
  if (import.meta.env.VITEST) return;
  if (!sessionPromise) {
    sessionPromise = fetch(apiPath("/api/auth/session"), {
      method: "POST",
      credentials: "include",
    })
      .then((res) => {
        if (!res.ok) sessionPromise = null;
      })
      .catch(() => {
        sessionPromise = null;
      });
  }
  await sessionPromise;
}

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  if (!path.includes("/api/auth/session")) {
    await ensureSession();
  }
  return fetch(apiPath(path), {
    ...init,
    credentials: "include",
  });
}
