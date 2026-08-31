import { apiFetch } from "./apiFetch";

export interface ExternalConnectionItem {
  id: string;
  provider: "linear" | "github";
  providerUserId?: string | null;
  providerAccountName?: string | null;
  status: "active" | "expired" | "revoked";
  scopes: string[];
  tokenExpiresAt?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  evidenceSources?: EvidenceSourceItem[];
}

export interface EvidenceSourceItem {
  id: string;
  sourceType: "linear_project" | "github_repo";
  externalId: string;
  name: string;
  isActive: boolean;
}

export interface ConnectionsResponse {
  connections: ExternalConnectionItem[];
  providersConfigured: {
    linear: boolean;
    github: boolean;
    serverLinearFallback: boolean;
  };
}

export interface LinearProjectItem {
  id: string;
  name: string;
  description?: string;
  state?: string;
  slugId?: string;
}

export interface GitHubRepoItem {
  id: number;
  fullName: string;
  name: string;
  private: boolean;
  defaultBranch: string;
  htmlUrl: string;
  description?: string;
}

export async function fetchConnections(): Promise<ConnectionsResponse> {
  const res = await apiFetch("/api/connections");
  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: "Chyba pri načítaní pripojení." }));
    throw new Error(data.error || "Nepodarilo sa načítať pripojenia.");
  }
  return res.json();
}

export async function getLinearAuthUrl(): Promise<string> {
  const res = await apiFetch("/api/auth/linear/authorize");
  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: "Chyba pri inicializácii Linear OAuth." }));
    throw new Error(data.error || "Nepodarilo sa vytvoriť autorizačnú URL pre Linear.");
  }
  const data = (await res.json()) as { authorizeUrl: string };
  return data.authorizeUrl;
}

export async function getGitHubAuthUrl(): Promise<string> {
  const res = await apiFetch("/api/auth/github/authorize");
  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: "Chyba pri inicializácii GitHub OAuth." }));
    throw new Error(data.error || "Nepodarilo sa vytvoriť autorizačnú URL pre GitHub.");
  }
  const data = (await res.json()) as { authorizeUrl: string };
  return data.authorizeUrl;
}

export async function disconnectProvider(provider: "linear" | "github"): Promise<void> {
  const res = await apiFetch(`/api/connections/${provider}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: "Chyba pri odpájaní." }));
    throw new Error(data.error || `Nepodarilo sa odpojiť ${provider}.`);
  }
}

export async function fetchLinearProjects(): Promise<LinearProjectItem[]> {
  const res = await apiFetch("/api/connections/linear/projects");
  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: "Chyba pri načítaní projektov." }));
    throw new Error(data.error || "Nepodarilo sa načítať Linear projekty.");
  }
  const data = (await res.json()) as { projects: LinearProjectItem[] };
  return data.projects || [];
}

export async function fetchGitHubRepos(): Promise<GitHubRepoItem[]> {
  const res = await apiFetch("/api/connections/github/repos");
  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: "Chyba pri načítaní repozitárov." }));
    throw new Error(data.error || "Nepodarilo sa načítať GitHub repozitáre.");
  }
  const data = (await res.json()) as { repos: GitHubRepoItem[] };
  return data.repos || [];
}

export async function fetchEvidenceSources(): Promise<EvidenceSourceItem[]> {
  const res = await apiFetch("/api/evidence-sources");
  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: "Chyba pri načítaní zdrojov." }));
    throw new Error(data.error || "Nepodarilo sa načítať zdroje dôkazov.");
  }
  const data = (await res.json()) as { sources: EvidenceSourceItem[] };
  return data.sources || [];
}

export async function addEvidenceSource(source: {
  sourceType: "linear_project" | "github_repo";
  externalId: string;
  name: string;
  connectionId?: string;
  config?: Record<string, unknown>;
}): Promise<EvidenceSourceItem> {
  const res = await apiFetch("/api/evidence-sources", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(source),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: "Chyba pri ukladaní zdroja." }));
    throw new Error(data.error || "Nepodarilo sa pridať zdroj dôkazov.");
  }
  const data = (await res.json()) as { source: EvidenceSourceItem };
  return data.source;
}

export async function deleteEvidenceSource(id: string): Promise<void> {
  const res = await apiFetch(`/api/evidence-sources/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: "Chyba pri odstraňovaní zdroja." }));
    throw new Error(data.error || "Nepodarilo sa odstrániť zdroj dôkazov.");
  }
}
