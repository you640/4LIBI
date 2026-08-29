import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  isAuthBypass,
  apiKeysMatch,
  sanitizeName,
  resetRateLimitStore,
  rateLimitMiddleware,
} from "../../server/middleware";
import { Hono } from "hono";

describe("server/middleware", () => {
  beforeEach(() => {
    resetRateLimitStore();
    process.env.JWT_SECRET = "test-secret-key-min-32-characters!!";
    process.env.API_KEY = "test-api-key-forenz";
    delete process.env.ENABLE_AUTH;
  });

  it("isAuthBypass is fail-closed unless ENABLE_AUTH=false", () => {
    expect(isAuthBypass()).toBe(false);
    process.env.ENABLE_AUTH = "true";
    expect(isAuthBypass()).toBe(false);
    process.env.ENABLE_AUTH = "false";
    expect(isAuthBypass()).toBe(true);
  });

  it("apiKeysMatch uses length-safe comparison", () => {
    expect(apiKeysMatch("abc", "abc")).toBe(true);
    expect(apiKeysMatch("abc", "abd")).toBe(false);
    expect(apiKeysMatch("ab", "abc")).toBe(false);
  });

  it("sanitizeName strips path traversal and weird chars", () => {
    expect(sanitizeName("../../etc/passwd")).toBe(".._.._etc_passwd");
    expect(sanitizeName("spis (1).pdf")).toBe("spis (1).pdf");
    expect(sanitizeName("")).toBe("document");
    expect(sanitizeName("@@@")).toBe("_");
  });

  it("rateLimitMiddleware returns 429 after limit", async () => {
    const app = new Hono();
    app.use("*", rateLimitMiddleware(2, 60_000));
    app.get("/x", (c) => c.json({ ok: true }));

    expect((await app.request("/x")).status).toBe(200);
    expect((await app.request("/x")).status).toBe(200);
    expect((await app.request("/x")).status).toBe(429);
  });
});
