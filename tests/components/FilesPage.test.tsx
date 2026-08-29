import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { FilesPage } from "../../src/pages/FilesPage";

vi.mock("../../src/lib/api", () => ({
  listAnalyses: vi.fn(),
  deleteAnalysis: vi.fn(),
  deleteAllAnalyses: vi.fn(),
  renameAnalysis: vi.fn(),
}));

import { listAnalyses, renameAnalysis } from "../../src/lib/api";

describe("FilesPage", () => {
  beforeEach(() => {
    vi.mocked(listAnalyses).mockReset();
    vi.mocked(renameAnalysis).mockReset();
  });

  it("shows empty state with demo CTA", async () => {
    vi.mocked(listAnalyses).mockResolvedValue([]);
    render(
      <MemoryRouter>
        <FilesPage />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByTestId("files-empty-state")).toBeInTheDocument();
    });
    expect(screen.getByTestId("files-empty-demo")).toBeInTheDocument();
  });

  it("renders analysis list", async () => {
    vi.mocked(listAnalyses).mockResolvedValue([
      {
        id: "a1",
        name: "Spis BA-KE",
        status: "ready",
        createdAt: "2026-01-15T12:00:00.000Z",
      },
    ]);
    render(
      <MemoryRouter>
        <FilesPage />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText(/Spis BA-KE/i)).toBeInTheDocument();
    });
  });

  it("renames analysis inline", async () => {
    const user = userEvent.setup();
    vi.mocked(listAnalyses).mockResolvedValue([
      {
        id: "a1",
        name: "Spis BA-KE",
        status: "ready",
        createdAt: "2026-01-15T12:00:00.000Z",
      },
    ]);
    vi.mocked(renameAnalysis).mockResolvedValue({
      id: "a1",
      name: "Spis Košice",
      status: "ready",
      createdAt: "2026-01-15T12:00:00.000Z",
    });

    render(
      <MemoryRouter>
        <FilesPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Spis BA-KE/i)).toBeInTheDocument();
    });

    await user.click(screen.getByTestId("files-rename-btn"));
    const input = screen.getByTestId("files-rename-input");
    await user.clear(input);
    await user.type(input, "Spis Košice");
    await user.click(screen.getByTestId("files-rename-save"));

    await waitFor(() => {
      expect(renameAnalysis).toHaveBeenCalledWith("a1", "Spis Košice");
      expect(screen.getByText(/Spis Košice/i)).toBeInTheDocument();
    });
  });
});
