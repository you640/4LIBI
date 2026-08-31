/**
 * GitHub OAuth 2.0 and REST API integration for multi-user connections.
 */

export interface GitHubTokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
}

export interface GitHubUserProfile {
  id: number;
  login: string;
  name?: string;
  email?: string;
  avatarUrl?: string;
}

export interface GitHubRepoOption {
  id: number;
  fullName: string;
  name: string;
  private: boolean;
  defaultBranch: string;
  htmlUrl: string;
  description?: string;
}

export function getGitHubClientId(): string {
  return process.env.GITHUB_CLIENT_ID || "";
}

export function getGitHubClientSecret(): string {
  return process.env.GITHUB_CLIENT_SECRET || "";
}

export function isGitHubOAuthConfigured(): boolean {
  return Boolean(getGitHubClientId() && getGitHubClientSecret());
}

/**
 * Builds the GitHub OAuth authorization URL.
 */
export function getGitHubAuthorizeUrl(state: string, redirectUri: string): string {
  const clientId = getGitHubClientId();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "repo,read:user,user:email",
    state,
  });
  return `https://github.com/login/oauth/authorize?${params.toString()}`;
}

/**
 * Exchanges authorization code for an access token.
 */
export async function exchangeGitHubCode(
  code: string,
  redirectUri: string,
  fetchImpl: typeof fetch = fetch
): Promise<GitHubTokenResponse> {
  const clientId = getGitHubClientId();
  const clientSecret = getGitHubClientSecret();

  if (!clientId || !clientSecret) {
    throw new Error("GITHUB_CLIENT_ID alebo GITHUB_CLIENT_SECRET nie je nakonfigurovaný.");
  }

  const res = await fetchImpl("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`GitHub OAuth výmena zlyhala (${res.status}): ${errText}`);
  }

  const json = (await res.json()) as GitHubTokenResponse & { error?: string; error_description?: string };
  if (json.error) {
    throw new Error(`GitHub OAuth chyba: ${json.error_description || json.error}`);
  }

  return json;
}

/**
 * Fetches the user profile from GitHub API.
 */
export async function fetchGitHubUser(
  accessToken: string,
  fetchImpl: typeof fetch = fetch
): Promise<GitHubUserProfile> {
  const res = await fetchImpl("https://api.github.com/user", {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${accessToken}`,
      "User-Agent": "ForenzDetectiv-Alibi/1.0",
    },
  });

  if (!res.ok) {
    throw new Error(`GitHub API zlyhalo (${res.status}) pri načítaní profilu.`);
  }

  const data = (await res.json()) as {
    id: number;
    login: string;
    name?: string;
    email?: string;
    avatar_url?: string;
  };

  return {
    id: data.id,
    login: data.login,
    name: data.name || undefined,
    email: data.email || undefined,
    avatarUrl: data.avatar_url || undefined,
  };
}

/**
 * Fetches accessible repositories for the user.
 */
export async function fetchUserGitHubRepos(
  accessToken: string,
  fetchImpl: typeof fetch = fetch
): Promise<GitHubRepoOption[]> {
  const res = await fetchImpl(
    "https://api.github.com/user/repos?sort=updated&per_page=50&affiliation=owner,collaborator,organization_member",
    {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${accessToken}`,
        "User-Agent": "ForenzDetectiv-Alibi/1.0",
      },
    }
  );

  if (!res.ok) {
    throw new Error(`GitHub API zlyhalo (${res.status}) pri načítaní repozitárov.`);
  }

  const data = (await res.json()) as Array<{
    id: number;
    full_name: string;
    name: string;
    private: boolean;
    default_branch: string;
    html_url: string;
    description?: string;
  }>;

  return data.map((r) => ({
    id: r.id,
    fullName: r.full_name,
    name: r.name,
    private: r.private,
    defaultBranch: r.default_branch,
    htmlUrl: r.html_url,
    description: r.description || undefined,
  }));
}
