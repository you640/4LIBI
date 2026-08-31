import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ConnectionsPage } from "../../src/pages/ConnectionsPage";

vi.mock("../../src/lib/connectionsApi", () => ({
  fetchConnections: vi.fn(),
  getLinearAuthUrl: vi.fn(),
  getGitHubAuthUrl: vi.fn(),
  disconnectProvider: vi.fn(),
  fetchLinearProjects: vi.fn(),
  fetchGitHubRepos: vi.fn(),
  addEvidenceSource: vi.fn(),
  deleteEvidenceSource: vi.fn(),
}));

import {
  fetchConnections,
  fetchLinearProjects,
  fetchGitHubRepos,
} from "../../src/lib/connectionsApi";

describe("ConnectionsPage Component", () => {
  beforeEach(() => {
    vi.mocked(fetchConnections).mockReset();
    vi.mocked(fetchLinearProjects).mockReset();
    vi.mocked(fetchGitHubRepos).mockReset();
  });

  it("zobrazí nepripojené karty a tlačidlá pre OAuth pripojenie", async () => {
    vi.mocked(fetchConnections).mockResolvedValue({
      connections: [],
      providersConfigured: {
        linear: true,
        github: true,
        serverLinearFallback: false,
      },
    });

    render(
      <MemoryRouter>
        <ConnectionsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId("linear-connection-card")).toBeInTheDocument();
      expect(screen.getByTestId("github-connection-card")).toBeInTheDocument();
      expect(screen.getByTestId("connect-linear-btn")).toBeInTheDocument();
      expect(screen.getByTestId("connect-github-btn")).toBeInTheDocument();
    });
  });

  it("zobrazí pripojený stav a zoznam projektov, ak je Linear prepojený", async () => {
    vi.mocked(fetchConnections).mockResolvedValue({
      connections: [
        {
          id: "conn_1",
          provider: "linear",
          providerAccountName: "Vyšetrovateľ (UBOK Workspace)",
          status: "active",
          scopes: ["read"],
          createdAt: "2026-08-31T12:00:00Z",
          updatedAt: "2026-08-31T12:00:00Z",
        },
      ],
      providersConfigured: {
        linear: true,
        github: true,
        serverLinearFallback: false,
      },
    });

    vi.mocked(fetchLinearProjects).mockResolvedValue([
      { id: "proj_1", name: "Spis Dimitri Cohen", state: "started" },
      { id: "proj_2", name: "Kauza Glock", state: "planned" },
    ]);

    render(
      <MemoryRouter>
        <ConnectionsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Vyšetrovateľ \(UBOK Workspace\)/)).toBeInTheDocument();
      expect(screen.getByText("Odpojiť Linear účet")).toBeInTheDocument();
    });
  });
});
