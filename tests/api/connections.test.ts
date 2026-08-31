import { describe, it, expect, beforeEach } from "vitest";
import { resetRateLimitStore } from "../../server/middleware";
import { userBearerHeaders } from "../helpers/auth";
import { resetApiMocks } from "../setup.api";
import { prisma } from "../../server/prisma";
import { encryptToken } from "../../server/tokenCrypto";

beforeEach(async () => {
  resetRateLimitStore();
  resetApiMocks();
  process.env.ENABLE_AUTH = "true";
  process.env.API_KEY = "test-api-key-forenz";
  process.env.JWT_SECRET = "test-secret-key-min-32-characters!!";
  delete process.env.LINEAR_CLIENT_ID;
  delete process.env.LINEAR_CLIENT_SECRET;
  delete process.env.GITHUB_CLIENT_ID;
  delete process.env.GITHUB_CLIENT_SECRET;
});

async function getApp() {
  const mod = await import("../../server/index");
  return mod.app;
}

describe("Connections & OAuth API", () => {
  it("odmietne neautorizovaný prístup k /api/connections bez tokenu", async () => {
    const app = await getApp();
    const res = await app.request("/api/connections");
    expect(res.status).toBe(401);
  });

  it("vydá session cookie a sprístupní /api/connections", async () => {
    const app = await getApp();
    const sessionRes = await app.request("/api/auth/session", { method: "POST" });
    expect([200, 201]).toContain(sessionRes.status);
    const setCookie = sessionRes.headers.get("set-cookie") || "";
    expect(setCookie).toContain("fd_session=");
    const cookie = setCookie.split(";")[0];
    const res = await app.request("/api/connections", {
      headers: { Cookie: cookie },
    });
    expect(res.status).toBe(200);
  });

  it("vráti 503 keď Linear OAuth nie je nakonfigurovaný", async () => {
    const app = await getApp();
    const headers = userBearerHeaders("usr_no_oauth", "no-oauth@example.com");
    const res = await app.request("/api/auth/linear/authorize", { headers });
    expect(res.status).toBe(503);
  });

  it("vráti zoznam pripojení a status poskytovateľov pre prihláseného používateľa", async () => {
    const app = await getApp();
    const headers = userBearerHeaders("usr_conn_1", "user1@example.com");
    const res = await app.request("/api/connections", { headers });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.connections).toBeDefined();
    expect(data.providersConfigured).toBeDefined();
    expect(Array.isArray(data.connections)).toBe(true);
  });

  it("vráti autorizačnú URL pre Linear OAuth", async () => {
    process.env.LINEAR_CLIENT_ID = "linear_client_123";
    process.env.LINEAR_CLIENT_SECRET = "linear_secret_456";

    const app = await getApp();
    const headers = userBearerHeaders("usr_conn_linear", "linear_user@example.com");
    const res = await app.request("/api/auth/linear/authorize", { headers });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.authorizeUrl).toContain("https://linear.app/oauth/authorize");
    expect(data.authorizeUrl).toContain("client_id=linear_client_123");
  });

  it("vráti autorizačnú URL pre GitHub OAuth", async () => {
    process.env.GITHUB_CLIENT_ID = "gh_client_123";
    process.env.GITHUB_CLIENT_SECRET = "gh_secret_456";

    const app = await getApp();
    const headers = userBearerHeaders("usr_conn_gh", "gh_user@example.com");
    const res = await app.request("/api/auth/github/authorize", { headers });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.authorizeUrl).toContain("https://github.com/login/oauth/authorize");
    expect(data.authorizeUrl).toContain("client_id=gh_client_123");
  });

  it("správne odpojí a vymaže pripojenie daného používateľa", async () => {
    const ownerId = "usr_disconnect_test";
    await prisma.externalConnection.upsert({
      where: { ownerId_provider: { ownerId, provider: "linear" } },
      update: {
        providerAccountName: "Test Linear Account",
        encryptedAccessToken: encryptToken("test_token_123"),
        status: "active",
      },
      create: {
        ownerId,
        provider: "linear",
        providerAccountName: "Test Linear Account",
        encryptedAccessToken: encryptToken("test_token_123"),
        status: "active",
      },
    });

    const app = await getApp();
    const headers = userBearerHeaders(ownerId, "disconnect@example.com");

    // Verify it exists
    let res = await app.request("/api/connections", { headers });
    let data = await res.json();
    expect(data.connections.some((c: { provider: string }) => c.provider === "linear")).toBe(true);

    // Delete it
    const delRes = await app.request("/api/connections/linear", {
      method: "DELETE",
      headers,
    });
    expect(delRes.status).toBe(200);

    // Verify it's gone
    res = await app.request("/api/connections", { headers });
    data = await res.json();
    expect(data.connections.some((c: { provider: string }) => c.provider === "linear")).toBe(false);
  });

  it("umožní pridanie a odstránenie EvidenceSource", async () => {
    const ownerId = "usr_evidence_test";
    const app = await getApp();
    const headers = {
      ...userBearerHeaders(ownerId, "evidence@example.com"),
      "Content-Type": "application/json",
    };

    // Create source
    const createRes = await app.request("/api/evidence-sources", {
      method: "POST",
      headers,
      body: JSON.stringify({
        sourceType: "linear_project",
        externalId: "proj_uuid_999",
        name: "Vyšetrovanie UBOK 2026",
      }),
    });
    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    expect(created.source.name).toBe("Vyšetrovanie UBOK 2026");

    // List sources
    const listRes = await app.request("/api/evidence-sources", { headers });
    expect(listRes.status).toBe(200);
    const listData = await listRes.json();
    expect(listData.sources.some((s: { id: string }) => s.id === created.source.id)).toBe(true);

    // Delete source
    const delRes = await app.request(`/api/evidence-sources/${created.source.id}`, {
      method: "DELETE",
      headers,
    });
    expect(delRes.status).toBe(200);
  });
});
