import { describe, it, expect, vi, afterEach } from "vitest";
import { apiPath, getApiBase } from "../../src/lib/apiBase";

describe("apiBase", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns relative path when VITE_API_URL unset", () => {
    vi.stubEnv("VITE_API_URL", "");
    expect(apiPath("/api/health")).toBe("/api/health");
    expect(getApiBase()).toBe("");
  });

  it("prefixes with VITE_API_URL in production", () => {
    vi.stubEnv("VITE_API_URL", "https://api.example.com");
    expect(apiPath("/api/analyses")).toBe("https://api.example.com/api/analyses");
    expect(getApiBase()).toBe("https://api.example.com");
  });

  it("strips trailing slash from base", () => {
    vi.stubEnv("VITE_API_URL", "https://api.example.com/");
    expect(apiPath("/api/health")).toBe("https://api.example.com/api/health");
  });
});
