import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Outlet, Route, Routes } from "react-router-dom";
import { RozporyTab } from "../../src/components/case/RozporyTab";
import { CaseContext } from "../../src/lib/caseContext";
import { minimalAnalysisFixture } from "../fixtures/analysis";

vi.mock("../../src/lib/hitlStorage", () => ({
  getHitlStatus: vi.fn(() => "open"),
  setHitlStatus: vi.fn(),
}));

vi.mock("../../src/lib/analytics", () => ({
  trackContradictionViewed: vi.fn(),
  trackAlibiChecked: vi.fn(),
}));

vi.mock("../../src/lib/crossExamApi", () => ({
  requestCrossExam: vi.fn(async () => ({
    questions: [
      {
        id: "q1",
        question: "Ako vysvetlíte rozpor medzi BA a KE?",
        rationale: "test",
        targetPerson: "Ján Novák",
        citation: {
          documentTitle: "spis",
          passage: "rozpor",
          page: 1,
          line: null,
        },
        suggestedFollowUps: [],
      },
    ],
    source: "local" as const,
  })),
  auditCrossExam: vi.fn(),
}));

import { trackContradictionViewed } from "../../src/lib/analytics";
import { requestCrossExam } from "../../src/lib/crossExamApi";

describe("RozporyTab", () => {
  beforeEach(() => {
    vi.mocked(trackContradictionViewed).mockReset();
    vi.mocked(requestCrossExam).mockClear();
    const store: Record<string, string> = {};
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => {
        store[k] = v;
      },
      removeItem: (k: string) => {
        delete store[k];
      },
    });
  });

  const contextValue = {
    analysisId: "a1",
    analysis: minimalAnalysisFixture,
    search: "",
    setSearch: () => {},
    searchOpen: false,
    setSearchOpen: () => {},
    openContradictionCount: 1,
  };

  function renderTab() {
    return render(
      <MemoryRouter initialEntries={["/"]}>
        <CaseContext.Provider value={contextValue}>
          <Routes>
            <Route element={<Outlet context={{ bumpHitl: () => {} }} />}>
              <Route index element={<RozporyTab />} />
            </Route>
          </Routes>
        </CaseContext.Provider>
      </MemoryRouter>
    );
  }

  it("renders contradiction events", () => {
    renderTab();
    expect(screen.getByText(/Rozpor v alibi/i)).toBeInTheDocument();
    expect(screen.getAllByText("s. 12").length).toBeGreaterThan(0);
  });

  it("tracks contradiction_viewed when opening detail sheet", async () => {
    const user = userEvent.setup();
    renderTab();
    await user.click(screen.getByRole("button", { name: /Alibi Impossible Karta/i }));
    expect(trackContradictionViewed).toHaveBeenCalledWith({
      contradictionId: "t1",
      isDemo: false,
    });
  });

  it("runs cross-exam mock happy path from sheet", async () => {
    const user = userEvent.setup();
    renderTab();
    await user.click(screen.getByRole("button", { name: /Alibi Impossible Karta/i }));
    await user.click(screen.getByTestId("cross-exam-btn"));
    await waitFor(() => {
      expect(screen.getByTestId("cross-exam-questions")).toBeInTheDocument();
    });
    expect(requestCrossExam).toHaveBeenCalled();
    expect(
      screen.getByText(/Ako vysvetlíte rozpor medzi BA a KE/i)
    ).toBeInTheDocument();
  });

  it("shows alibi empty hint when geospatial pair cannot be derived", () => {
    renderTab();
    expect(screen.getByTestId("alibi-map-empty")).toBeInTheDocument();
  });
});
