import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { SherlockAnalyzer } from "../../src/components/sherlock/SherlockAnalyzer";
import { SherlockPage } from "../../src/pages/SherlockPage";

vi.mock("../../src/lib/api", () => ({
  analyzeLinearViaApi: vi.fn(),
  analyzeViaApi: vi.fn(),
  getLinearStatus: vi.fn(),
}));

vi.mock("../../src/components/sherlock/RecentAnalyses", () => ({
  RecentAnalyses: () => null,
}));

vi.mock("../../src/lib/analytics", () => ({
  trackCaseCreated: vi.fn(),
  trackAnalysisStarted: vi.fn(),
  trackErrorOccurred: vi.fn(),
  trackContradictionDetected: vi.fn(),
}));

vi.mock("../../src/lib/auditLog", () => ({
  auditCaseCreate: vi.fn(),
}));

import { analyzeLinearViaApi, analyzeViaApi, getLinearStatus } from "../../src/lib/api";

const ROOT = path.resolve(__dirname, "../..");

describe("Sherlock forensic page source", () => {
  it("SherlockAnalyzer.tsx nemá upload, Drag & Drop ani file input", () => {
    const src = readFileSync(
      path.join(ROOT, "src/components/sherlock/SherlockAnalyzer.tsx"),
      "utf8"
    );
    expect(src).not.toMatch(/uploadedFiles/);
    expect(src).not.toMatch(/onDragOver/);
    expect(src).not.toMatch(/onDrop/);
    expect(src).not.toMatch(/type=["']file["']/);
    expect(src).not.toMatch(/analyzeViaApi/);
    expect(src).toMatch(/analyzeLinearViaApi|onAnalyzeLinear/);
  });

  it("SherlockPage.tsx volá iba Linear API, nie analyzeViaApi(files)", () => {
    const src = readFileSync(
      path.join(ROOT, "src/pages/SherlockPage.tsx"),
      "utf8"
    );
    expect(src).toMatch(/analyzeLinearViaApi/);
    expect(src).not.toMatch(/analyzeViaApi/);
    expect(src).not.toMatch(/handleAnalyze\s*=/);
    expect(src).not.toMatch(/uploadedFiles/);
    expect(src).not.toMatch(/input\[type=file\]/);
  });
});

describe("SherlockAnalyzer Linear-only", () => {
  it("zobrazuje chybovú hlášku", () => {
    render(
      <SherlockAnalyzer onAnalyzeLinear={vi.fn()} error="Chyba analýzy" />
    );
    expect(screen.getByText(/Chyba analýzy/i)).toBeInTheDocument();
  });

  it("neobsahuje input[type=file] ani Drag & Drop zónu", () => {
    render(<SherlockAnalyzer onAnalyzeLinear={vi.fn()} error={null} />);
    expect(document.querySelector("input[type=file]")).toBeNull();
    expect(screen.queryByText(/Pretiahnite PDF/i)).not.toBeInTheDocument();
    expect(screen.queryByTestId("local-upload-dropzone")).not.toBeInTheDocument();
  });

  it("zobrazuje Linear-only stav a zakáže tlačidlo ak Linear nie je ready", () => {
    render(
      <SherlockAnalyzer
        onAnalyzeLinear={vi.fn()}
        error={null}
        linearReady={false}
        linearMessage="Chýba LINEAR_API_KEY"
      />
    );
    expect(screen.getByText(/Forenzná analýza: Linear UBOK/i)).toBeInTheDocument();
    expect(screen.getByText(/výhradne z Linear/i)).toBeInTheDocument();
    expect(screen.getByTestId("linear-analyze-btn")).toBeDisabled();
  });

  it("kliknutie volá iba Linear handler", async () => {
    const user = userEvent.setup();
    const onAnalyzeLinear = vi.fn();
    render(
      <SherlockAnalyzer
        onAnalyzeLinear={onAnalyzeLinear}
        error={null}
        linearReady={true}
      />
    );
    await user.click(screen.getByTestId("linear-analyze-btn"));
    expect(onAnalyzeLinear).toHaveBeenCalledTimes(1);
  });
});

describe("Sherlock forensic page", () => {
  beforeEach(() => {
    vi.mocked(getLinearStatus).mockReset();
    vi.mocked(analyzeLinearViaApi).mockReset();
    vi.mocked(analyzeViaApi).mockReset();
    vi.mocked(getLinearStatus).mockResolvedValue({
      configured: true,
      reachable: true,
      project_id: "cf930d36-765a-4e6f-b170-2d8a2da83f0b",
      project_name: "UBOK",
      issue_count: 1,
      document_count: 1,
      admissible_count: 1,
      error: null,
    });
    vi.mocked(analyzeLinearViaApi).mockResolvedValue({
      id: "lin-1",
      name: "Linear",
      status: "ready",
      createdAt: "2026-01-01T00:00:00.000Z",
      data: {
        metadata: {
          document_name: "Linear",
          language: "sk",
          page_count: 1,
          upload_date: "2026-01-01T00:00:00.000Z",
        },
        persons: [],
        evidence: [],
        relationships: [],
        timeline: [],
      },
    });
  });

  it("forenzná stránka nemá file input ani Drag & Drop a volá iba analyzeLinearViaApi", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/sherlock"]}>
        <Routes>
          <Route path="/sherlock" element={<SherlockPage />} />
          <Route path="/spisy/:id/otazky" element={<div>otazky</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByTestId("sherlock-linear-only")).toBeInTheDocument();
    expect(document.querySelector("input[type=file]")).toBeNull();
    expect(screen.queryByText(/Pretiahnite PDF/i)).not.toBeInTheDocument();

    const button = screen.getByTestId("linear-analyze-btn");
    await waitFor(() => expect(button).not.toBeDisabled());
    await user.click(button);
    expect(analyzeLinearViaApi).toHaveBeenCalledTimes(1);
    expect(analyzeViaApi).not.toHaveBeenCalled();
  });
});
