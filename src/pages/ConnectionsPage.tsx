import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { AppBar } from "../components/m3/AppBar";
import {
  fetchConnections,
  getLinearAuthUrl,
  getGitHubAuthUrl,
  disconnectProvider,
  fetchLinearProjects,
  fetchGitHubRepos,
  addEvidenceSource,
  deleteEvidenceSource,
  type ConnectionsResponse,
  type LinearProjectItem,
  type GitHubRepoItem,
  type EvidenceSourceItem,
} from "../lib/connectionsApi";

export function ConnectionsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [connectionsData, setConnectionsData] = useState<ConnectionsResponse | null>(null);
  const [linearProjects, setLinearProjects] = useState<LinearProjectItem[]>([]);
  const [githubRepos, setGitHubRepos] = useState<GitHubRepoItem[]>([]);
  const [selectedLinearProject, setSelectedLinearProject] = useState<string>("");
  const [selectedGitHubRepo, setSelectedGitHubRepo] = useState<string>("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const connected = searchParams.get("connected");
  const errorParam = searchParams.get("error");
  const urlMessage: { type: "success" | "error"; text: string } | null = connected
    ? { type: "success", text: `Účet ${connected.toUpperCase()} bol úspešne prepojený!` }
    : errorParam
    ? { type: "error", text: `Chyba pri autorizácii: ${decodeURIComponent(errorParam)}` }
    : null;

  const currentMessage = message || urlMessage;

  const loadAll = async () => {
    try {
      const data = await fetchConnections();
      setConnectionsData(data);

      const linearConn = data.connections.find((c) => c.provider === "linear" && c.status === "active");
      if (linearConn) {
        fetchLinearProjects().then(setLinearProjects).catch(console.error);
      }

      const githubConn = data.connections.find((c) => c.provider === "github" && c.status === "active");
      if (githubConn) {
        fetchGitHubRepos().then(setGitHubRepos).catch(console.error);
      }
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Nepodarilo sa načítať prepojenia.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    fetchConnections()
      .then(async (data) => {
        if (cancelled) return;
        setConnectionsData(data);
        const linear = data.connections.find((c) => c.provider === "linear" && c.status === "active");
        const github = data.connections.find((c) => c.provider === "github" && c.status === "active");
        if (linear) {
          const projects = await fetchLinearProjects().catch(() => []);
          if (!cancelled) setLinearProjects(projects);
        }
        if (github) {
          const repos = await fetchGitHubRepos().catch(() => []);
          if (!cancelled) setGitHubRepos(repos);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setMessage({
          type: "error",
          text: err instanceof Error ? err.message : "Nepodarilo sa načítať prepojenia.",
        });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleConnectLinear = async () => {
    try {
      setActionLoading("linear_connect");
      const url = await getLinearAuthUrl();
      window.location.href = url;
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Chyba pri spustení Linear OAuth.",
      });
      setActionLoading(null);
    }
  };

  const handleConnectGitHub = async () => {
    try {
      setActionLoading("github_connect");
      const url = await getGitHubAuthUrl();
      window.location.href = url;
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Chyba pri spustení GitHub OAuth.",
      });
      setActionLoading(null);
    }
  };

  const handleDisconnect = async (provider: "linear" | "github") => {
    if (!window.confirm(`Naozaj chcete odpojiť ${provider.toUpperCase()} účet?`)) return;
    try {
      setActionLoading(`disconnect_${provider}`);
      await disconnectProvider(provider);
      setMessage({ type: "success", text: `Účet ${provider.toUpperCase()} bol odpojený.` });
      await loadAll();
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Nepodarilo sa odpojiť účet.",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleAddLinearSource = async () => {
    if (!selectedLinearProject) return;
    const project = linearProjects.find((p) => p.id === selectedLinearProject);
    if (!project) return;

    try {
      setActionLoading("add_linear_source");
      const linearConn = connectionsData?.connections.find((c) => c.provider === "linear");
      await addEvidenceSource({
        sourceType: "linear_project",
        externalId: project.id,
        name: `Linear: ${project.name}`,
        connectionId: linearConn?.id,
      });
      setMessage({ type: "success", text: `Projekt "${project.name}" bol pridaný ako zdroj dôkazov.` });
      setSelectedLinearProject("");
      await loadAll();
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Nepodarilo sa pridať zdroj.",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleAddGitHubSource = async () => {
    if (!selectedGitHubRepo) return;
    const repo = githubRepos.find((r) => String(r.id) === selectedGitHubRepo || r.fullName === selectedGitHubRepo);
    if (!repo) return;

    try {
      setActionLoading("add_github_source");
      const githubConn = connectionsData?.connections.find((c) => c.provider === "github");
      await addEvidenceSource({
        sourceType: "github_repo",
        externalId: repo.fullName,
        name: `GitHub: ${repo.fullName}`,
        connectionId: githubConn?.id,
      });
      setMessage({ type: "success", text: `Repozitár "${repo.fullName}" bol pridaný ako zdroj dôkazov.` });
      setSelectedGitHubRepo("");
      await loadAll();
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Nepodarilo sa pridať zdroj.",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteSource = async (id: string, name: string) => {
    if (!window.confirm(`Odstrániť zdroj dôkazov "${name}"?`)) return;
    try {
      await deleteEvidenceSource(id);
      setMessage({ type: "success", text: "Zdroj dôkazov bol odstránený." });
      await loadAll();
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Nepodarilo sa odstrániť zdroj.",
      });
    }
  };

  const linearConn = connectionsData?.connections.find((c) => c.provider === "linear" && c.status === "active");
  const githubConn = connectionsData?.connections.find((c) => c.provider === "github" && c.status === "active");

  const allEvidenceSources: EvidenceSourceItem[] = (connectionsData?.connections.flatMap(
    (c) => c.evidenceSources || []
  ) || []) as EvidenceSourceItem[];

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <AppBar title="Prepojenia a Zdroje" />
      <div className="app-content px-4 pt-2 space-y-4 pb-10">
        {currentMessage && (
          <div
            className={`p-3.5 rounded-xl text-xs font-medium border flex items-center justify-between ${
              currentMessage.type === "success"
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                : "bg-error/10 border-error/30 text-error"
            }`}
          >
            <span>{currentMessage.text}</span>
            <button
              type="button"
              onClick={() => {
                setMessage(null);
                if (searchParams.get("connected") || searchParams.get("error")) {
                  searchParams.delete("connected");
                  searchParams.delete("error");
                  setSearchParams(searchParams, { replace: true });
                }
              }}
              className="text-xs opacity-70 hover:opacity-100 ml-2"
            >
              ✕
            </button>
          </div>
        )}

        <div className="m3-card-outlined p-4">
          <p className="text-xs text-outline leading-relaxed m-0">
            Pripojte svoje účty pre priamu synchronizáciu dôkazov, vyšetrovacích spisov a repozitárov.
            Vaše prístupové tokeny sú na serveri chránené šifrovaním <strong>AES-256-GCM</strong>.
          </p>
          {loading && (
            <p className="text-xs text-outline animate-pulse mt-2 mb-0">Načítavam stav prepojení…</p>
          )}
        </div>

        {/* Linear Connection Card */}
        <div className="m3-card-outlined p-5 space-y-4" data-testid="linear-connection-card">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#5E6AD2]/15 text-[#5E6AD2] flex items-center justify-center font-bold text-sm">
                L
              </div>
              <div>
                <h3 className="text-sm font-semibold text-surface-on m-0">Linear Workspace</h3>
                <p className="text-[11px] text-outline m-0">
                  {linearConn
                    ? `Pripojené: ${linearConn.providerAccountName || "Aktívny účet"}`
                    : connectionsData?.providersConfigured.serverLinearFallback
                    ? "Používa sa serverový UBOK kľúč (vlastný účet nepripojený)"
                    : "Účet nepripojený"}
                </p>
              </div>
            </div>
            <span
              className={`text-[11px] px-2.5 py-1 rounded-full font-medium ${
                linearConn
                  ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                  : connectionsData?.providersConfigured.serverLinearFallback
                  ? "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                  : "bg-surface-variant text-outline border border-outline-variant/30"
              }`}
            >
              {linearConn ? "Pripojené" : connectionsData?.providersConfigured.serverLinearFallback ? "Server Fallback" : "Nepripojené"}
            </span>
          </div>

          {linearConn ? (
            <div className="space-y-3 pt-2 border-t border-outline-variant/20">
              <div className="flex flex-col gap-2">
                <label className="text-xs text-surface-on font-medium">
                  Vybrať Linear projekt ako zdroj dôkazov:
                </label>
                <div className="flex gap-2">
                  <select
                    value={selectedLinearProject}
                    onChange={(e) => setSelectedLinearProject(e.target.value)}
                    className="flex-1 bg-surface-variant text-surface-on text-xs rounded-xl px-3 py-2 border border-outline-variant/40 focus:outline-none focus:border-primary"
                  >
                    <option value="">-- Vyberte projekt --</option>
                    {linearProjects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} {p.state ? `(${p.state})` : ""}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleAddLinearSource}
                    disabled={!selectedLinearProject || actionLoading === "add_linear_source"}
                    className="m3-btn-filled text-xs px-3 py-2 disabled:opacity-50"
                  >
                    Pridať
                  </button>
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={() => handleDisconnect("linear")}
                  disabled={actionLoading === "disconnect_linear"}
                  className="text-xs text-error hover:underline opacity-80 hover:opacity-100"
                >
                  Odpojiť Linear účet
                </button>
              </div>
            </div>
          ) : (
            <div className="pt-2 flex flex-col gap-2">
              <button
                type="button"
                onClick={handleConnectLinear}
                disabled={actionLoading === "linear_connect"}
                className="m3-btn-filled w-full text-xs py-2.5 bg-[#5E6AD2] hover:bg-[#4E5AC2] text-white"
                data-testid="connect-linear-btn"
              >
                {actionLoading === "linear_connect" ? "Pripájam…" : "Pripojiť vlastný Linear účet (OAuth)"}
              </button>
            </div>
          )}
        </div>

        {/* GitHub Connection Card */}
        <div className="m3-card-outlined p-5 space-y-4" data-testid="github-connection-card">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-surface-variant text-surface-on flex items-center justify-center font-bold text-sm border border-outline-variant/30">
                GH
              </div>
              <div>
                <h3 className="text-sm font-semibold text-surface-on m-0">GitHub Repozitáre</h3>
                <p className="text-[11px] text-outline m-0">
                  {githubConn
                    ? `Pripojené: @${githubConn.providerAccountName || "Používateľ"}`
                    : "Účet nepripojený"}
                </p>
              </div>
            </div>
            <span
              className={`text-[11px] px-2.5 py-1 rounded-full font-medium ${
                githubConn
                  ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                  : "bg-surface-variant text-outline border border-outline-variant/30"
              }`}
            >
              {githubConn ? "Pripojené" : "Nepripojené"}
            </span>
          </div>

          {githubConn ? (
            <div className="space-y-3 pt-2 border-t border-outline-variant/20">
              <div className="flex flex-col gap-2">
                <label className="text-xs text-surface-on font-medium">
                  Vybrať GitHub repozitár ako zdroj dôkazov:
                </label>
                <div className="flex gap-2">
                  <select
                    value={selectedGitHubRepo}
                    onChange={(e) => setSelectedGitHubRepo(e.target.value)}
                    className="flex-1 bg-surface-variant text-surface-on text-xs rounded-xl px-3 py-2 border border-outline-variant/40 focus:outline-none focus:border-primary"
                  >
                    <option value="">-- Vyberte repozitár --</option>
                    {githubRepos.map((r) => (
                      <option key={r.id} value={r.fullName}>
                        {r.fullName} {r.private ? "🔒" : ""}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleAddGitHubSource}
                    disabled={!selectedGitHubRepo || actionLoading === "add_github_source"}
                    className="m3-btn-filled text-xs px-3 py-2 disabled:opacity-50"
                  >
                    Pridať
                  </button>
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={() => handleDisconnect("github")}
                  disabled={actionLoading === "disconnect_github"}
                  className="text-xs text-error hover:underline opacity-80 hover:opacity-100"
                >
                  Odpojiť GitHub účet
                </button>
              </div>
            </div>
          ) : (
            <div className="pt-2 flex flex-col gap-2">
              <button
                type="button"
                onClick={handleConnectGitHub}
                disabled={actionLoading === "github_connect"}
                className="m3-btn-filled w-full text-xs py-2.5 bg-[#24292e] hover:bg-[#1b1f23] text-white border border-outline-variant/40"
                data-testid="connect-github-btn"
              >
                {actionLoading === "github_connect" ? "Pripájam…" : "Pripojiť GitHub účet (OAuth)"}
              </button>
            </div>
          )}
        </div>

        {/* Evidence Sources List */}
        <div className="m3-card-outlined p-5 space-y-3">
          <h3 className="text-sm font-semibold text-surface-on m-0">
            Aktívne zdroje dôkazov pre forenznú analýzu
          </h3>
          <p className="text-xs text-outline m-0">
            Zoznam projektov a repozitárov, ktoré sú prepojené a pripravené na synchronizáciu.
          </p>

          {allEvidenceSources.length === 0 ? (
            <div className="p-4 rounded-xl bg-surface-variant/40 border border-outline-variant/20 text-center">
              <p className="text-xs text-outline m-0">Zatiaľ nie sú vybrané žiadne dodatočné zdroje.</p>
            </div>
          ) : (
            <div className="space-y-2 pt-1">
              {allEvidenceSources.map((source) => (
                <div
                  key={source.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-surface-variant/50 border border-outline-variant/30"
                >
                  <div>
                    <p className="text-xs font-semibold text-surface-on m-0">{source.name}</p>
                    <p className="text-[10px] text-outline m-0 font-mono">{source.externalId}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteSource(source.id, source.name)}
                    className="text-xs text-error/80 hover:text-error px-2 py-1"
                    title="Odstrániť zdroj"
                  >
                    Odstrániť
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
