import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { RecentAnalyses } from "../../src/components/sherlock/RecentAnalyses";

vi.mock("../../src/lib/api", () => ({
  listAnalyses: vi.fn(),
}));

import { listAnalyses } from "../../src/lib/api";

describe("RecentAnalyses", () => {
  beforeEach(() => {
    vi.mocked(listAnalyses).mockReset();
  });

  it("shows recent ready analyses", async () => {
    vi.mocked(listAnalyses).mockResolvedValue([
      {
        id: "a2",
        name: "Novší spis",
        status: "ready",
        createdAt: "2026-02-01T12:00:00.000Z",
      },
      {
        id: "a1",
        name: "Starší spis",
        status: "ready",
        createdAt: "2026-01-01T12:00:00.000Z",
      },
      { id: "demo", name: "Demo", status: "ready", createdAt: "2026-01-01" },
    ]);

    render(
      <MemoryRouter>
        <RecentAnalyses />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId("recent-analyses")).toBeInTheDocument();
    });

    const items = screen.getAllByTestId("recent-analysis-item");
    expect(items).toHaveLength(2);
    expect(screen.getByText(/Novší spis/i)).toBeInTheDocument();
    expect(screen.queryByText(/^Demo$/i)).not.toBeInTheDocument();
  });

  it("hides section when empty", async () => {
    vi.mocked(listAnalyses).mockResolvedValue([]);
    render(
      <MemoryRouter>
        <RecentAnalyses />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.queryByTestId("recent-analyses")).not.toBeInTheDocument();
    });
  });
});
