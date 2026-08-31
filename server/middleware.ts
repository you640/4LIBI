import type { Context } from "hono";
import crypto from "node:crypto";
import { getCookie } from "hono/cookie";

export const SESSION_COOKIE = "fd_session";

export type AuthVariables = {
  ownerId: string;
  userEmail: string;
};

export function getJwtSecret(): string | undefined {
  const secret = process.env.JWT_SECRET;
  return secret && secret.length >= 32 ? secret : undefined;
}

export function isPublicApiPath(pathname: string): boolean {
  return (
    pathname === "/api/health" ||
    pathname === "/api/auth/session" ||
    pathname === "/api/auth/linear/callback" ||
    pathname === "/api/auth/github/callback"
  );
}

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

/** Reset in-memory rate limiter (tests only). */
export function resetRateLimitStore(): void {
  rateLimitStore.clear();
}

export function rateLimitMiddleware(limit: number = 30, windowMs: number = 60 * 1000) {
  return async (c: Context, next: () => Promise<void>) => {
    const ip =
      c.req.header("x-forwarded-for") || c.req.header("x-real-ip") || "127.0.0.1";
    const now = Date.now();
    const key = `rate_limit:${ip}`;

    const entry = rateLimitStore.get(key);
    if (entry && entry.resetAt > now) {
      if (entry.count >= limit) {
        return c.json(
          {
            error: `Príliš veľa požiadaviek. Skúste znova za ${Math.ceil((entry.resetAt - now) / 1000)}s.`,
          },
          429
        );
      }
      entry.count++;
    } else {
      rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    }

    await next();
  };
}

export function isAuthBypass(): boolean {
  // Fail-closed: auth is required unless ENABLE_AUTH is explicitly "false" AND we are NOT in production.
  return process.env.ENABLE_AUTH === "false" && process.env.NODE_ENV !== "production";
}

/** Timing-safe API key comparison. */
export function apiKeysMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export async function authMiddleware(
  c: Context<{ Variables: AuthVariables }>,
  next: () => Promise<void>
) {
  const pathname = new URL(c.req.url).pathname;
  if (isPublicApiPath(pathname)) {
    return await next();
  }

  if (isAuthBypass()) {
    const devOwnerId = c.req.header("x-owner-id") || "dev_local_user";
    c.set("ownerId", devOwnerId);
    const devIdentity = crypto.createHash("sha256").update(devOwnerId).digest("hex").slice(0, 16);
    const email = `dev-${devIdentity}@forenzdetectiv.local`;
    c.set("userEmail", email);
    return await next();
  }

  const authHeader = c.req.header("Authorization");
  const apiKey = c.req.header("x-api-key");
  const secret = getJwtSecret();

  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    if (!secret) {
      return c.json({ error: "JWT_SECRET nie je nastavený." }, 500);
    }
    try {
      const jwt = await import("jsonwebtoken");
      const decoded = jwt.verify(token, secret) as { userId: string; email: string };
      if (!decoded?.userId) {
        return c.json({ error: "Neplatný autentifikačný token" }, 401);
      }
      c.set("ownerId", decoded.userId);
      c.set("userEmail", decoded.email);
      return await next();
    } catch {
      return c.json({ error: "Neplatný autentifikačný token" }, 401);
    }
  }

  const cookieHeader = c.req.header("cookie") || c.req.raw.headers.get("Cookie") || "";
  const cookieToken =
    getCookie(c, SESSION_COOKIE) ||
    cookieHeader
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${SESSION_COOKIE}=`))
      ?.slice(SESSION_COOKIE.length + 1);
  if (cookieToken && secret) {
    try {
      const jwt = await import("jsonwebtoken");
      const decoded = jwt.verify(cookieToken, secret) as { userId: string; email: string };
      if (decoded?.userId) {
        c.set("ownerId", decoded.userId);
        c.set("userEmail", decoded.email || `${decoded.userId}@forenzdetectiv.local`);
        return await next();
      }
    } catch {
      return c.json({ error: "Neplatný session cookie." }, 401);
    }
  }

  if (apiKey && process.env.API_KEY && apiKeysMatch(apiKey, process.env.API_KEY)) {
    c.set("ownerId", "api_user");
    c.set("userEmail", "api@forenzdetectiv.local");
    return await next();
  }

  return c.json({ error: "Vyžaduje sa autentifikácia." }, 401);
}

export function sanitizeName(name: string): string {
  return name.replace(/[^\w.\- ()[\]]+/g, "_").slice(0, 180) || "document";
}

export function isUploadedFile(value: FormDataEntryValue): value is File {
  return typeof File !== "undefined" && value instanceof File;
}
