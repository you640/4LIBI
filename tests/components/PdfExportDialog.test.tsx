import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PdfExportDialog } from "../../src/components/case/PdfExportDialog";
import { minimalAnalysisFixture } from "../fixtures/analysis";
import * as dossierExport from "../../src/lib/dossierExport";
import { trackPdfExported } from "../../src/lib/analytics";

vi.mock("../../src/lib/dossierExport", async (importOriginal) => {
  const mod = await importOriginal<typeof dossierExport>();
  return {
    ...mod,
    buildCourtDossierExport: vi.fn(),
    downloadTextFile: vi.fn(),
    openPrintableDossier: vi.fn(),
  };
});

vi.mock("../../src/lib/auditLog", () => ({
  auditPdfExport: vi.fn(),
}));

vi.mock("../../src/lib/analytics", () => ({
  trackPdfExported: vi.fn(),
}));

describe("PdfExportDialog", () => {
  beforeEach(() => {
    vi.mocked(dossierExport.buildCourtDossierExport).mockResolvedValue({
      markdown: "# Test dossier",
      hash: "deadbeef".repeat(8),
    });
  });

  it("shows hash and download button when open", async () => {
    render(
      <PdfExportDialog
        open
        onClose={() => {}}
        analysis={minimalAnalysisFixture}
        caseId="a1"
      />
    );
    await waitFor(() => {
      expect(screen.getByTestId("pdf-export-hash")).toBeInTheDocument();
    });
    expect(screen.getByTestId("pdf-export-markdown")).toBeEnabled();
  });

  it("downloads markdown on click", async () => {
    const user = userEvent.setup();
    render(
      <PdfExportDialog
        open
        onClose={() => {}}
        analysis={minimalAnalysisFixture}
        caseId="a1"
      />
    );
    await waitFor(() => {
      expect(screen.getByTestId("pdf-export-markdown")).toBeEnabled();
    });
    await user.click(screen.getByTestId("pdf-export-markdown"));
    expect(dossierExport.downloadTextFile).toHaveBeenCalled();
    expect(trackPdfExported).toHaveBeenCalledWith({ format: "markdown" });
  });
});
