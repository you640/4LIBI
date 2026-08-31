import { Hono } from "hono";
import crypto from "node:crypto";
import { prisma, logAuditAction } from "../prisma";
import { ensureUserIdentity } from "../identity";
import type { Prisma } from "../../generated/client";
import type { AuthVariables } from "../middleware";
import { encryptToken, decryptToken } from "../tokenCrypto";
import {
  getLinearAuthorizeUrl,
  exchangeLinearCode,
  fetchLinearViewer,
  fetchUserLinearProjects,
  isLinearOAuthConfigured,
} from "../oauth/linearOAuth";
import {
  getGitHubAuthorizeUrl,
  exchangeGitHubCode,
  fetchGitHubUser,
  fetchUserGitHubRepos,
  isGitHubOAuthConfigured,
} from "../oauth/githubOAuth";

type Variables = AuthVariables;

export const connectionsRouter = new Hono<{ Variables: Variables }>();

function getStateSecret(): string {
  const secret =
    process.env.SESSION_SECRET ||
    process.env.TOKEN_ENCRYPTION_KEY ||
    process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET alebo JWT_SECRET musí mať aspoň 32 znakov.");
  }
  return secret;
}

function hmacEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

/**
 * Creates a signed state token containing ownerId, provider, timestamp, and signature.
 */
export function createOAuthState(ownerId: string, provider: "linear" | "github"): string {
  const payload = JSON.stringify({
    ownerId,
    provider,
    ts: Date.now(),
    nonce: crypto.randomBytes(8).toString("hex"),
  });
  const b64Payload = Buffer.from(payload, "utf8").toString("base64url");
  const signature = crypto
    .createHmac("sha256", getStateSecret())
    .update(b64Payload)
    .digest("base64url");
  return `${b64Payload}.${signature}`;
}

/**
 * Verifies and decodes the signed state token.
 */
export function verifyOAuthState(
  state: string,
  expectedProvider: "linear" | "github"
): { ownerId: string } | null {
  if (!state || !state.includes(".")) return null;
  const dot = state.lastIndexOf(".");
  const b64Payload = state.slice(0, dot);
  const signature = state.slice(dot + 1);
  const expectedSig = crypto
    .createHmac("sha256", getStateSecret())
    .update(b64Payload)
    .digest("base64url");

  if (!hmacEqual(signature, expectedSig)) {
    return null;
  }

  try {
    const raw = Buffer.from(b64Payload, "base64url").toString("utf8");
    const data = JSON.parse(raw) as { ownerId?: string; provider?: string; ts?: number };

    // Valid for 15 minutes
    if (!data.ownerId || data.provider !== expectedProvider) return null;
    if (typeof data.ts !== "number" || Date.now() - data.ts > 15 * 60 * 1000) return null;

    return { ownerId: data.ownerId };
  } catch {
    return null;
  }
}

function getAppBaseUrl(reqUrl: string): string {
  if (process.env.APP_BASE_URL) return process.env.APP_BASE_URL.replace(/\/$/, "");
  const u = new URL(reqUrl);
  return `${u.protocol}//${u.host}`;
}

// ---------------------------------------------------------------------------
// 1. Connection status overview
// ---------------------------------------------------------------------------
connectionsRouter.get("/api/connections", async (c) => {
  const ownerId = c.get("ownerId");
  const connections = await prisma.externalConnection.findMany({
    where: { ownerId },
    select: {
      id: true,
      provider: true,
      providerUserId: true,
      providerAccountName: true,
      status: true,
      scopes: true,
      tokenExpiresAt: true,
      metadata: true,
      createdAt: true,
      updatedAt: true,
      evidenceSources: {
        select: {
          id: true,
          sourceType: true,
          externalId: true,
          name: true,
          isActive: true,
        },
      },
    },
  });

  return c.json({
    connections,
    providersConfigured: {
      linear: isLinearOAuthConfigured(),
      github: isGitHubOAuthConfigured(),
      serverLinearFallback: Boolean(process.env.LINEAR_API_KEY || process.env.LINEAR_API_TOKEN),
    },
  });
});

// ---------------------------------------------------------------------------
// 2. Linear OAuth Routes
// ---------------------------------------------------------------------------
connectionsRouter.get("/api/auth/linear/authorize", (c) => {
  if (!isLinearOAuthConfigured()) {
    return c.json(
      { error: "Linear OAuth nie je nakonfigurovaný (LINEAR_CLIENT_ID/SECRET)." },
      503
    );
  }
  const ownerId = c.get("ownerId");
  const state = createOAuthState(ownerId, "linear");
  const baseUrl = getAppBaseUrl(c.req.url);
  const redirectUri = `${baseUrl}/api/auth/linear/callback`;
  const authorizeUrl = getLinearAuthorizeUrl(state, redirectUri);
  return c.json({ authorizeUrl });
});

connectionsRouter.get("/api/auth/linear/callback", async (c) => {
  const code = c.req.query("code");
  const state = c.req.query("state");
  const error = c.req.query("error");
  const errorDescription = c.req.query("error_description");

  const baseUrl = getAppBaseUrl(c.req.url);
  const frontendRedirect = `${baseUrl}/connections`;

  if (error || !code || !state) {
    const reason = encodeURIComponent(errorDescription || error || "Chýba autorizačný kód.");
    return c.redirect(`${frontendRedirect}?error=${reason}`);
  }

  const verified = verifyOAuthState(state, "linear");
  if (!verified) {
    const reason = encodeURIComponent("Neplatný alebo expirovaný CSRF stav.");
    return c.redirect(`${frontendRedirect}?error=${reason}`);
  }

  try {
    const redirectUri = `${baseUrl}/api/auth/linear/callback`;
    const tokens = await exchangeLinearCode(code, redirectUri);
    const viewer = await fetchLinearViewer(tokens.access_token);
    await ensureUserIdentity(
      prisma,
      verified.ownerId,
      viewer.email || `${verified.ownerId}@forenzdetectiv.local`
    );

    const encryptedAccessToken = encryptToken(tokens.access_token);
    const encryptedRefreshToken = tokens.refresh_token ? encryptToken(tokens.refresh_token) : null;
    const tokenExpiresAt = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000)
      : null;

    const accountName = viewer.organizationName
      ? `${viewer.name} (${viewer.organizationName})`
      : viewer.name;

    await prisma.externalConnection.upsert({
      where: {
        ownerId_provider: {
          ownerId: verified.ownerId,
          provider: "linear",
        },
      },
      update: {
        providerUserId: viewer.id,
        providerAccountName: accountName,
        encryptedAccessToken,
        encryptedRefreshToken,
        tokenExpiresAt,
        scopes: tokens.scope || ["read"],
        status: "active",
        metadata: {
          email: viewer.email,
          organizationId: viewer.organizationId,
          organizationName: viewer.organizationName,
        },
      },
      create: {
        ownerId: verified.ownerId,
        provider: "linear",
        providerUserId: viewer.id,
        providerAccountName: accountName,
        encryptedAccessToken,
        encryptedRefreshToken,
        tokenExpiresAt,
        scopes: tokens.scope || ["read"],
        status: "active",
        metadata: {
          email: viewer.email,
          organizationId: viewer.organizationId,
          organizationName: viewer.organizationName,
        },
      },
    });

    await logAuditAction(verified.ownerId, "linear_connected", {
      providerUserId: viewer.id,
      organizationName: viewer.organizationName,
    });

    return c.redirect(`${frontendRedirect}?connected=linear`);
  } catch (err) {
    const message = encodeURIComponent(
      err instanceof Error ? err.message : "Chyba pri pripájaní Linear účtu."
    );
    return c.redirect(`${frontendRedirect}?error=${message}`);
  }
});

connectionsRouter.get("/api/connections/linear/projects", async (c) => {
  const ownerId = c.get("ownerId");
  const conn = await prisma.externalConnection.findUnique({
    where: {
      ownerId_provider: {
        ownerId,
        provider: "linear",
      },
    },
  });

  if (!conn || conn.status !== "active") {
    return c.json({ error: "Linear účet nie je pripojený." }, 404);
  }

  try {
    const accessToken = decryptToken(conn.encryptedAccessToken);
    const projects = await fetchUserLinearProjects(accessToken);
    return c.json({ projects });
  } catch (err) {
    return c.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Nepodarilo sa načítať projekty z pripojeného Linear účtu.",
      },
      500
    );
  }
});

// ---------------------------------------------------------------------------
// 3. GitHub OAuth Routes
// ---------------------------------------------------------------------------
connectionsRouter.get("/api/auth/github/authorize", (c) => {
  if (!isGitHubOAuthConfigured()) {
    return c.json(
      { error: "GitHub OAuth nie je nakonfigurovaný (GITHUB_CLIENT_ID/SECRET)." },
      503
    );
  }
  const ownerId = c.get("ownerId");
  const state = createOAuthState(ownerId, "github");
  const baseUrl = getAppBaseUrl(c.req.url);
  const redirectUri = `${baseUrl}/api/auth/github/callback`;
  const authorizeUrl = getGitHubAuthorizeUrl(state, redirectUri);
  return c.json({ authorizeUrl });
});

connectionsRouter.get("/api/auth/github/callback", async (c) => {
  const code = c.req.query("code");
  const state = c.req.query("state");
  const error = c.req.query("error");
  const errorDescription = c.req.query("error_description");

  const baseUrl = getAppBaseUrl(c.req.url);
  const frontendRedirect = `${baseUrl}/connections`;

  if (error || !code || !state) {
    const reason = encodeURIComponent(errorDescription || error || "Chýba autorizačný kód.");
    return c.redirect(`${frontendRedirect}?error=${reason}`);
  }

  const verified = verifyOAuthState(state, "github");
  if (!verified) {
    const reason = encodeURIComponent("Neplatný alebo expirovaný CSRF stav.");
    return c.redirect(`${frontendRedirect}?error=${reason}`);
  }

  try {
    const redirectUri = `${baseUrl}/api/auth/github/callback`;
    const tokens = await exchangeGitHubCode(code, redirectUri);
    const user = await fetchGitHubUser(tokens.access_token);
    await ensureUserIdentity(
      prisma,
      verified.ownerId,
      user.email || `${verified.ownerId}@forenzdetectiv.local`
    );

    const encryptedAccessToken = encryptToken(tokens.access_token);
    const scopes = tokens.scope ? tokens.scope.split(",").map((s) => s.trim()) : ["repo"];

    await prisma.externalConnection.upsert({
      where: {
        ownerId_provider: {
          ownerId: verified.ownerId,
          provider: "github",
        },
      },
      update: {
        providerUserId: String(user.id),
        providerAccountName: user.login,
        encryptedAccessToken,
        encryptedRefreshToken: null,
        tokenExpiresAt: null,
        scopes,
        status: "active",
        metadata: {
          login: user.login,
          name: user.name,
          email: user.email,
          avatarUrl: user.avatarUrl,
        },
      },
      create: {
        ownerId: verified.ownerId,
        provider: "github",
        providerUserId: String(user.id),
        providerAccountName: user.login,
        encryptedAccessToken,
        encryptedRefreshToken: null,
        tokenExpiresAt: null,
        scopes,
        status: "active",
        metadata: {
          login: user.login,
          name: user.name,
          email: user.email,
          avatarUrl: user.avatarUrl,
        },
      },
    });

    await logAuditAction(verified.ownerId, "github_connected", {
      githubUser: user.login,
    });

    return c.redirect(`${frontendRedirect}?connected=github`);
  } catch (err) {
    const message = encodeURIComponent(
      err instanceof Error ? err.message : "Chyba pri pripájaní GitHub účtu."
    );
    return c.redirect(`${frontendRedirect}?error=${message}`);
  }
});

connectionsRouter.get("/api/connections/github/repos", async (c) => {
  const ownerId = c.get("ownerId");
  const conn = await prisma.externalConnection.findUnique({
    where: {
      ownerId_provider: {
        ownerId,
        provider: "github",
      },
    },
  });

  if (!conn || conn.status !== "active") {
    return c.json({ error: "GitHub účet nie je pripojený." }, 404);
  }

  try {
    const accessToken = decryptToken(conn.encryptedAccessToken);
    const repos = await fetchUserGitHubRepos(accessToken);
    return c.json({ repos });
  } catch (err) {
    return c.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Nepodarilo sa načítať repozitáre z pripojeného GitHub účtu.",
      },
      500
    );
  }
});

// ---------------------------------------------------------------------------
// 4. Disconnect provider
// ---------------------------------------------------------------------------
connectionsRouter.delete("/api/connections/:provider", async (c) => {
  const ownerId = c.get("ownerId");
  const provider = c.req.param("provider");

  if (provider !== "linear" && provider !== "github") {
    return c.json({ error: "Neplatný poskytovateľ (očakáva sa linear alebo github)." }, 400);
  }

  const existing = await prisma.externalConnection.findUnique({
    where: {
      ownerId_provider: {
        ownerId,
        provider,
      },
    },
  });

  if (!existing) {
    return c.json({ error: "Pripojenie nebolo nájdené." }, 404);
  }

  await prisma.externalConnection.delete({
    where: { id: existing.id },
  });

  await logAuditAction(ownerId, `${provider}_disconnected`, { connectionId: existing.id });

  return c.json({ success: true, message: `Pripojenie ${provider} bolo úspešne odstránené.` });
});

// ---------------------------------------------------------------------------
// 5. Evidence Sources (Project / Repo selection)
// ---------------------------------------------------------------------------
connectionsRouter.get("/api/evidence-sources", async (c) => {
  const ownerId = c.get("ownerId");
  const sources = await prisma.evidenceSource.findMany({
    where: { ownerId },
    orderBy: { createdAt: "desc" },
  });
  return c.json({ sources });
});

connectionsRouter.post("/api/evidence-sources", async (c) => {
  const ownerId = c.get("ownerId");
  const body = (await c.req.json().catch(() => ({}))) as {
    sourceType?: string;
    externalId?: string;
    name?: string;
    connectionId?: string;
    config?: Record<string, unknown>;
  };

  if (!body.sourceType || !body.externalId || !body.name) {
    return c.json({ error: "Polia sourceType, externalId a name sú povinné." }, 400);
  }

  const source = await prisma.evidenceSource.create({
    data: {
      ownerId,
      sourceType: body.sourceType,
      externalId: body.externalId,
      name: body.name,
      connectionId: body.connectionId,
      config: (body.config ?? undefined) as unknown as Prisma.InputJsonValue | undefined,
      isActive: true,
    },
  });

  await logAuditAction(ownerId, "evidence_source_created", {
    sourceId: source.id,
    sourceType: source.sourceType,
    name: source.name,
  });

  return c.json({ source }, 201);
});

connectionsRouter.delete("/api/evidence-sources/:id", async (c) => {
  const ownerId = c.get("ownerId");
  const id = c.req.param("id");

  const existing = await prisma.evidenceSource.findFirst({
    where: { id, ownerId },
  });

  if (!existing) {
    return c.json({ error: "Zdroj dôkazov nebol nájdený." }, 404);
  }

  await prisma.evidenceSource.delete({
    where: { id },
  });

  await logAuditAction(ownerId, "evidence_source_deleted", { sourceId: id });
  return c.json({ success: true });
});
