import { Hono } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { prisma } from "../prisma";
import { ensureUserIdentity } from "../identity";
import { SESSION_COOKIE, getJwtSecret, type AuthVariables } from "../middleware";

export const sessionRouter = new Hono<{ Variables: AuthVariables }>();

sessionRouter.post("/api/auth/session", async (c) => {
  const secret = getJwtSecret();
  if (!secret) {
    return c.json({ error: "JWT_SECRET nie je nastavený." }, 500);
  }

  const existing = getCookie(c, SESSION_COOKIE);
  if (existing) {
    try {
      const decoded = jwt.verify(existing, secret) as { userId?: string; email?: string };
      if (decoded?.userId) {
        await ensureUserIdentity(
          prisma,
          decoded.userId,
          decoded.email || `${decoded.userId}@forenzdetectiv.local`
        );
        return c.json({ ok: true, ownerId: decoded.userId });
      }
    } catch {
      /* issue a new session */
    }
  }

  const ownerId = `anon_${crypto.randomBytes(12).toString("hex")}`;
  const email = `${ownerId}@forenzdetectiv.local`;
  await ensureUserIdentity(prisma, ownerId, email);

  const token = jwt.sign({ userId: ownerId, email }, secret, { expiresIn: "30d" });
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "Lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return c.json({ ok: true, ownerId }, 201);
});
