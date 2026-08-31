import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Outlet, Route, Routes } from "react-router-dom";
import { OtazkyTab } from "../../src/components/case/OtazkyTab";
import { CaseContext } from "../../src/lib/caseContext";
import { minimalAnalysisFixture } from "../fixtures/analysis";
import {
  directWeaponsAnalysis,
  forensicCaseFromAnalysis,
  validForensicAnalysis,
  ev,
} from "../fixtures/forensic";
import { emptyForensicDocumentAnalysis } from "../../src/lib/forensic/types";
import type { Analysis } from "../../src/types";

function renderOtazky(analysis: Analysis) {
  return render(
    <MemoryRouter>
      <CaseContext.Provider
        value={{
          analysisId: "a1",
          analysis,
          search: "",
          setSearch: () => {},
          searchOpen: false,
          setSearchOpen: () => {},
          openContradictionCount: 0,
        }}
      >
        <Routes>
          <Route element={<Outlet context={{ bumpHitl: () => {} }} />}>
            <Route index element={<OtazkyTab />} />
          </Route>
        </Routes>
      </CaseContext.Provider>
    </MemoryRouter>
  );
}

describe("OtazkyTab", () => {
  it("lokálny Sherlock výsledok bez forensic nevytvorí odpovede troch otázok", () => {
    renderOtazky(minimalAnalysisFixture);
    expect(minimalAnalysisFixture.forensic).toBeUndefined();
    expect(screen.getByTestId("otazky-empty")).toBeInTheDocument();
    expect(screen.queryByTestId("question-weapons")).not.toBeInTheDocument();
    expect(screen.queryByTestId("question-plan")).not.toBeInTheDocument();
    expect(screen.queryByTestId("question-financing")).not.toBeInTheDocument();
  });

  it("zobrazí tri karty otázok a priamy dôkaz ako doložený fakt", async () => {
    const user = userEvent.setup();
    const quote = "Ján Novák prevzal zbrane dňa 12.03.2023 podľa faktúry FA-2023-441";
    const forensic = forensicCaseFromAnalysis(directWeaponsAnalysis(quote));
    renderOtazky({ ...minimalAnalysisFixture, forensic });

    expect(screen.getByTestId("question-weapons")).toBeInTheDocument();
    expect(screen.getByTestId("question-plan")).toBeInTheDocument();
    expect(screen.getByTestId("question-financing")).toBeInTheDocument();
    expect(screen.getByTestId("question-weapons-answer")).toHaveAttribute(
      "data-as-fact",
      "true"
    );
    expect(screen.getAllByTestId("evidence-type-direct_evidence").length).toBeGreaterThan(0);

    await user.click(screen.getAllByTestId("forensic-citation")[0]);
    expect(screen.getByTestId("citation-sheet")).toHaveTextContent(/strana 2/i);
    expect(screen.getByTestId("citation-sheet")).toHaveTextContent(quote);
  });

  it("hypotézu nezobrazí ako potvrdený fakt", () => {
    const analysis = validForensicAnalysis({
      questions: {
        weapons_flow: emptyForensicDocumentAnalysis("x").questions.weapons_flow,
        financing: emptyForensicDocumentAnalysis("x").questions.financing,
        plan_author: {
          answer: "Možno Peter navrhol plán",
          candidates: [
            {
              name: "Peter Kováč",
              entity: null,
              role: "designer",
              found_in_text: false,
              inferred: true,
              confidence: 0.2,
              evidence: [
                ev({
                  quote: "Peter sa spomína ako konateľ",
                  evidence_type: "hypothesis",
                }),
              ],
              contradicting_evidence: [],
            },
          ],
          confidence: 0.2,
          evidence: [
            ev({
              quote: "Peter sa spomína ako konateľ",
              evidence_type: "hypothesis",
            }),
          ],
          alternative_explanations: [],
          missing_evidence: ["Chýba priamy dôkaz."],
        },
      },
    });
    renderOtazky({
      ...minimalAnalysisFixture,
      forensic: forensicCaseFromAnalysis(analysis),
    });
    expect(screen.getByTestId("question-plan-answer")).toHaveAttribute(
      "data-as-fact",
      "false"
    );
    expect(screen.getByTestId("question-plan-caveat")).toHaveTextContent(/Hypotéza|nie je/i);
    expect(screen.getByTestId("evidence-type-hypothesis")).toBeInTheDocument();
    expect(screen.getByTestId("question-plan-missing")).toHaveTextContent(/Chýba priamy dôkaz/);
  });

  it("ukáže rozpory a chýbajúcu odpoveď", () => {
    const analysis = validForensicAnalysis({
      contradictions: [
        {
          field: "transaction.date",
          value_a: "12.03.2023",
          value_b: "13.03.2023",
          source_a: "1-a.pdf",
          source_b: "2-b.pdf",
          description: "Rozporné dátumy faktúry FA-2023-441",
        },
      ],
    });
    analysis.questions.financing.missing_evidence = ["Chýba zdroj peňazí."];
    renderOtazky({
      ...minimalAnalysisFixture,
      forensic: forensicCaseFromAnalysis(analysis),
    });
    expect(screen.getByTestId("question-financing-answer")).toHaveTextContent(
      /nie je doložená/i
    );
    expect(screen.getByTestId("otazky-contradictions")).toHaveTextContent("12.03.2023");
    expect(screen.getByTestId("question-financing-missing")).toHaveTextContent(
      /zdroj peňazí/
    );
  });
});
