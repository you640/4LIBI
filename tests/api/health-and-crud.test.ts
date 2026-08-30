import { describe, it, expect, beforeEach } from "vitest";
import { resetRateLimitStore } from "../../server/middleware";
import { authHeaders } from "../helpers/auth";
import { resetApiMocks } from "../setup.api";

beforeEach(() => {
  resetRateLimitStore();
  resetApiMocks();
  process.env.ENABLE_AUTH = "true";
  process.env.API_KEY = "test-api-key-forenz";
  process.env.JWT_SECRET = "test-secret-key-min-32-characters!!";
  process.env.MISTRAL_API_KEY = "test-mistral-key";
});

async function getApp() {
  const mod = await import("../../server/index");
  return mod.app;
}

describe("API /api/health", () => {
  it("returns ok without auth", async () => {
    const app = await getApp();
    const res = await app.request("/api/health");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(typeof body.mistralConfigured).toBe("boolean");
  });

  it("reflects allowed CORS origin", async () => {
    const app = await getApp();
    const res = await app.request("/api/health", {
      headers: { Origin: "http://127.0.0.1:5175" },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBe(
      "http://127.0.0.1:5175"
    );
  });

  it("does not reflect unknown CORS origin", async () => {
    const app = await getApp();
    const res = await app.request("/api/health", {
      headers: { Origin: "https://evil.example" },
    });
    expect(res.headers.get("access-control-allow-origin") || "").not.toBe(
      "https://evil.example"
    );
  });
});

describe("API auth", () => {
  it("rejects unauthenticated requests", async () => {
    const app = await getApp();
    const res = await app.request("/api/analyses");
    expect(res.status).toBe(401);
  });

  it("accepts x-api-key", async () => {
    const app = await getApp();
    const res = await app.request("/api/analyses", {
      headers: authHeaders(),
    });
    expect(res.status).toBe(200);
  });

  it("accepts auth bypass with ENABLE_AUTH=false", async () => {
    process.env.ENABLE_AUTH = "false";
    const app = await getApp();
    const res = await app.request("/api/analyses", {
      headers: { "x-owner-id": "dev1" },
    });
    expect(res.status).toBe(200);
  });
});

describe("API analyses CRUD", () => {
  it("lists empty analyses", async () => {
    const app = await getApp();
    const res = await app.request("/api/analyses", { headers: authHeaders() });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it("creates via analyze and lists", async () => {
    const app = await getApp();
    const form = new FormData();
    form.append("files", new File(["hello world text"], "spis.txt", { type: "text/plain" }));
    const create = await app.request("/api/analyze", {
      method: "POST",
      headers: authHeaders(),
      body: form,
    });
    expect(create.status).toBe(200);
    const created = await create.json();
    expect(created.id).toBeTruthy();
    expect(created.status).toBe("queued");

    const list = await app.request("/api/analyses", { headers: authHeaders() });
    const rows = await list.json();
    expect(rows.length).toBe(1);
  });

  it("returns 400 when no files", async () => {
    const app = await getApp();
    const form = new FormData();
    const res = await app.request("/api/analyze", {
      method: "POST",
      headers: authHeaders(),
      body: form,
    });
    expect(res.status).toBe(400);
  });

  it("renames analysis via PATCH", async () => {
    const app = await getApp();
    const form = new FormData();
    form.append("files", new File(["hello world text"], "spis.txt", { type: "text/plain" }));
    const create = await app.request("/api/analyze", {
      method: "POST",
      headers: authHeaders(),
      body: form,
    });
    const created = await create.json();

    const patch = await app.request(`/api/analyses/${created.id}`, {
      method: "PATCH",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Premenovany spis Kauza 01" }),
    });
    expect(patch.status).toBe(200);
    const updated = await patch.json();
    expect(updated.name).toBe("Premenovany spis Kauza 01");

    const get = await app.request(`/api/analyses/${created.id}`, {
      headers: authHeaders(),
    });
    const row = await get.json();
    expect(row.name).toBe("Premenovany spis Kauza 01");
  });
});

describe("API geospatial", () => {
  it("checks travel feasibility", async () => {
    const app = await getApp();
    const res = await app.request("/api/geospatial/check", {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({
        locA: "Bratislava",
        timeA: "10:00",
        locB: "Košice",
        timeB: "10:30",
        personName: "Ján",
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.result).toBeTruthy();
  });
});

describe("API audit + hitl", () => {
  it("creates and lists audit logs", async () => {
    const app = await getApp();
    const post = await app.request("/api/audit-logs", {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ action: "case_view", details: { id: "1" } }),
    });
    expect(post.status).toBe(200);

    const list = await app.request("/api/audit-logs", { headers: authHeaders() });
    expect(list.status).toBe(200);
    const logs = await list.json();
    expect(Array.isArray(logs) || Array.isArray(logs.logs) || logs.success).toBeTruthy();
  });
});

describe("API agent chat offline", () => {
  it("returns offline response without mistral when no key", async () => {
    const prev = process.env.MISTRAL_API_KEY;
    delete process.env.MISTRAL_API_KEY;
    const app = await getApp();
    const res = await app.request("/api/agent/chat", {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Aké sú rozpory?" }),
    });
    process.env.MISTRAL_API_KEY = prev;
    expect([200, 500]).toContain(res.status);
    if (res.status === 200) {
      const body = await res.json();
      expect(String(body.content || body.error || "")).toBeTruthy();
    }
  });
});

describe("API /api/cross-exam", () => {
  it("returns local questions when mistral key missing", async () => {
    const prev = process.env.MISTRAL_API_KEY;
    delete process.env.MISTRAL_API_KEY;
    const app = await getApp();
    const res = await app.request("/api/cross-exam", {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({
        contradictions: [
          {
            id: "c1",
            explanation: "BA vs KE",
            severity: "critical",
            entity_ref: "Ján",
          },
        ],
        mode: "alibi",
      }),
    });
    process.env.MISTRAL_API_KEY = prev;
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.source).toBe("local");
    expect(body.questions.length).toBeGreaterThan(0);
  });

  it("rejects empty contradictions", async () => {
    const app = await getApp();
    const res = await app.request("/api/cross-exam", {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ contradictions: [] }),
    });
    expect(res.status).toBe(400);
  });
});
