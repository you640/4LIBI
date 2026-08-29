import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listAnalyses, type AnalysisSummary } from "../../lib/api";
import { rememberLastCaseId } from "../../lib/caseUtils";
import { ChevronRightIcon } from "../Icons";

function statusLabel(status: string): string {
  if (status === "ready") return "Pripravený";
  if (status === "queued") return "Vo fronte";
  if (status === "processing" || status === "analyzing") return "Prebieha";
  if (status === "error") return "Chyba";
  return status;
}

export function RecentAnalyses() {
  const navigate = useNavigate();
  const [items, setItems] = useState<AnalysisSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    listAnalyses()
      .then((rows) => {
        if (cancelled) return;
        const sorted = [...rows].sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        setItems(sorted.filter((r) => r.id !== "demo").slice(0, 5));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <p className="text-xs text-outline py-2" data-testid="recent-analyses-loading">
        Načítavam nedávne analýzy…
      </p>
    );
  }

  if (items.length === 0) return null;

  return (
    <section className="mt-6" data-testid="recent-analyses">
      <h3 className="text-sm font-semibold text-surface-on mb-2">Nedávne analýzy</h3>
      <div className="space-y-2">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            data-testid="recent-analysis-item"
            onClick={() => {
              rememberLastCaseId(item.id);
              navigate(`/spisy/${item.id}/rozpory`);
            }}
            className="m3-card-outlined w-full text-left flex items-center gap-3 p-3 hover:border-primary/50 transition-colors"
          >
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-medium text-surface-on truncate">
                {item.name}
              </span>
              <span className="block text-xs text-outline mt-0.5">
                {statusLabel(item.status)}
              </span>
            </span>
            <ChevronRightIcon className="w-5 h-5 text-outline-variant flex-shrink-0" />
          </button>
        ))}
      </div>
    </section>
  );
}
