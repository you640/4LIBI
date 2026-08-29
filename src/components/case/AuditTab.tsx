import { AuditLogViewer } from "../audit/AuditLogViewer";
import { useCaseContext } from "../../lib/caseContext";

export function AuditTab() {
  const { analysisId } = useCaseContext();

  return (
    <div className="pb-6">
      <h3 className="text-sm font-semibold text-surface-on mb-2">Audit spisu</h3>
      <AuditLogViewer caseId={analysisId} limit={100} />
    </div>
  );
}
