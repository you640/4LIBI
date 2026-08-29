import { describe, it, expect, beforeEach } from "vitest";
import { Hono } from "hono";
import {
  authMiddleware,
  rateLimitMiddleware,
  resetRateLimitStore,
  sanitizeName,
  apiKeysMatch,
  isAuthBypass,
  type AuthVariables,
} from "../../server/middleware";

describe("security suite", () => {
  beforeEach(() => {
    resetRateLimitStore();
    process.env.API_KEY = "secure-api-key-value";
    process.env.JWT_SECRET = "test-secret-key-min-32-characters!!";
    delete process.env.ENABLE_AUTH;
  });

  it("auth is fail-closed by default", () => {
    expect(isAuthBypass()).toBe(false);
  });

  it("rejects missing credentials on protected routes", async () => {
    const app = new Hono<{ Variables: AuthVariables }>();
    app.use("*", authMiddleware);
    app.get("/api/secret", (c) => c.json({ ok: true }));
    const res = await app.request("/api/secret");
    expect(res.status).toBe(401);
  });

  it("allows health without auth when middleware skips it", async () => {
    const app = new Hono<{ Variables: AuthVariables }>();
    app.use("*", authMiddleware);
    app.get("/api/health", (c) => c.json({ status: "ok" }));
    expect((await app.request("/api/health")).status).toBe(200);
  });

  it("rate limits after threshold", async () => {
    const app = new Hono();
    app.use("*", rateLimitMiddleware(3, 60_000));
    app.get("/r", (c) => c.text("ok"));
    expect((await app.request("/r")).status).toBe(200);
    expect((await app.request("/r")).status).toBe(200);
    expect((await app.request("/r")).status).toBe(200);
    expect((await app.request("/r")).status).toBe(429);
  });

  it("sanitizeName blocks path traversal style names", () => {
    expect(sanitizeName("../secrets.env")).not.toContain("/");
    expect(sanitizeName("..\\windows\\system32")).not.toMatch(/\\/);
  });

  it("api key comparison is length-safe", () => {
    expect(apiKeysMatch("secure-api-key-value", "secure-api-key-value")).toBe(true);
    expect(apiKeysMatch("short", "secure-api-key-value")).toBe(false);
  });
});
