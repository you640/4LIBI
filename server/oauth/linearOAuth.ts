/**
 * Linear OAuth 2.0 and API integration for multi-user connections.
 */

export interface LinearTokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
  scope?: string[];
  refresh_token?: string;
}

export interface LinearUserProfile {
  id: string;
  name: string;
  displayName?: string;
  email?: string;
  organizationId?: string;
  organizationName?: string;
}

export interface LinearProjectOption {
  id: string;
  name: string;
  description?: string;
  state?: string;
  slugId?: string;
}

export function getLinearClientId(): string {
  return process.env.LINEAR_CLIENT_ID || "";
}

export function getLinearClientSecret(): string {
  return process.env.LINEAR_CLIENT_SECRET || "";
}

export function isLinearOAuthConfigured(): boolean {
  return Boolean(getLinearClientId() && getLinearClientSecret());
}

/**
 * Builds the Linear OAuth authorization URL.
 */
export function getLinearAuthorizeUrl(state: string, redirectUri: string): string {
  const clientId = getLinearClientId();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "read,issues:create,comments:create",
    state,
    prompt: "consent",
  });
  return `https://linear.app/oauth/authorize?${params.toString()}`;
}

/**
 * Exchanges authorization code for access and refresh tokens.
 */
export async function exchangeLinearCode(
  code: string,
  redirectUri: string,
  fetchImpl: typeof fetch = fetch
): Promise<LinearTokenResponse> {
  const clientId = getLinearClientId();
  const clientSecret = getLinearClientSecret();

  if (!clientId || !clientSecret) {
    throw new Error("LINEAR_CLIENT_ID alebo LINEAR_CLIENT_SECRET nie je nakonfigurovaný.");
  }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    client_secret: clientSecret,
  });

  const res = await fetchImpl("https://api.linear.app/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Linear OAuth výmena zlyhala (${res.status}): ${errText}`);
  }

  return (await res.json()) as LinearTokenResponse;
}

/**
 * Refreshes an expired Linear access token.
 */
export async function refreshLinearToken(
  refreshToken: string,
  fetchImpl: typeof fetch = fetch
): Promise<LinearTokenResponse> {
  const clientId = getLinearClientId();
  const clientSecret = getLinearClientSecret();

  if (!clientId || !clientSecret) {
    throw new Error("LINEAR_CLIENT_ID alebo LINEAR_CLIENT_SECRET nie je nakonfigurovaný.");
  }

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
  });

  const res = await fetchImpl("https://api.linear.app/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Linear token refresh zlyhal (${res.status}): ${errText}`);
  }

  return (await res.json()) as LinearTokenResponse;
}

/**
 * Fetches the viewer's profile from Linear GraphQL API using the user's access token.
 */
export async function fetchLinearViewer(
  accessToken: string,
  fetchImpl: typeof fetch = fetch
): Promise<LinearUserProfile> {
  const query = `
    query ViewerQuery {
      viewer {
        id
        name
        displayName
        email
        organization {
          id
          name
        }
      }
    }
  `;

  const res = await fetchImpl("https://api.linear.app/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ query }),
  });

  if (!res.ok) {
    throw new Error(`Linear GraphQL zlyhal (${res.status}) pri načítaní profilu.`);
  }

  const json = (await res.json()) as {
    data?: {
      viewer?: {
        id: string;
        name: string;
        displayName?: string;
        email?: string;
        organization?: { id: string; name: string };
      };
    };
    errors?: Array<{ message: string }>;
  };

  if (json.errors && json.errors.length > 0) {
    throw new Error(`Linear GraphQL chyba: ${json.errors[0].message}`);
  }

  const v = json.data?.viewer;
  if (!v) {
    throw new Error("Linear GraphQL nevrátil profil používateľa.");
  }

  return {
    id: v.id,
    name: v.displayName || v.name,
    displayName: v.displayName,
    email: v.email,
    organizationId: v.organization?.id,
    organizationName: v.organization?.name,
  };
}

/**
 * Fetches accessible projects for the connected user.
 */
export async function fetchUserLinearProjects(
  accessToken: string,
  fetchImpl: typeof fetch = fetch
): Promise<LinearProjectOption[]> {
  const query = `
    query ProjectsQuery {
      projects(first: 50, orderBy: updatedAt) {
        nodes {
          id
          name
          description
          state
          slugId
        }
      }
    }
  `;

  const res = await fetchImpl("https://api.linear.app/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ query }),
  });

  if (!res.ok) {
    throw new Error(`Linear GraphQL zlyhal (${res.status}) pri načítaní projektov.`);
  }

  const json = (await res.json()) as {
    data?: {
      projects?: {
        nodes?: Array<{
          id: string;
          name: string;
          description?: string;
          state?: string;
          slugId?: string;
        }>;
      };
    };
    errors?: Array<{ message: string }>;
  };

  if (json.errors && json.errors.length > 0) {
    throw new Error(`Linear GraphQL chyba: ${json.errors[0].message}`);
  }

  const nodes = json.data?.projects?.nodes || [];
  return nodes.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description || undefined,
    state: p.state || undefined,
    slugId: p.slugId || undefined,
  }));
}
