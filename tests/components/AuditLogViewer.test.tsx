import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { AuditLogViewer } from "../../src/components/audit/AuditLogViewer";
import * as auditLog from "../../src/lib/auditLog";

vi.mock("../../src/lib/auditLog", async (importOriginal) => {
  const mod = await importOriginal<typeof auditLog>();
  return {
    ...mod,
    fetchServerAuditLogs: vi.fn(),
  };
});

describe("AuditLogViewer", () => {
  beforeEach(() => {
    vi.mocked(auditLog.fetchServerAuditLogs).mockReset();
  });

  it("shows empty state when no logs", async () => {
    vi.mocked(auditLog.fetchServerAuditLogs).mockResolvedValue([]);
    render(<AuditLogViewer />);
    await waitFor(() => {
      expect(screen.getByTestId("audit-log-empty")).toBeInTheDocument();
    });
  });

  it("renders audit entries", async () => {
    vi.mocked(auditLog.fetchServerAuditLogs).mockResolvedValue([
      {
        id: "a1",
        action: "pdf_export",
        timestamp: Date.now(),
        details: { caseId: "c1", format: "markdown" },
      },
    ]);
    render(<AuditLogViewer />);
    await waitFor(() => {
      expect(screen.getByTestId("audit-log-entry")).toBeInTheDocument();
      expect(screen.getByText(/Export protokolu/i)).toBeInTheDocument();
    });
  });
});
