import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRightIcon, FilesIcon, UploadIcon } from "../components/Icons";
import { listAnalyses, type AnalysisSummary } from "../lib/api";
import { AppBar } from "../components/m3/AppBar";
import { rememberLastCaseId } from "../lib/caseUtils";

function statusLabel(status: string): string {
  if (status === "ready") return "Pripravený";
  if (status === "analyzing") return "Prebieha";
  if (status === "error") return "Chyba";
  return status;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("sk-SK", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function FilesPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<AnalysisSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listAnalyses()
      .then((rows) => {
        if (!cancelled) setItems(rows);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Spisy sa nepodarilo načítať."
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const openCase = (id: string) => {
    rememberLastCaseId(id);
    navigate(`/spisy/${id}/rozpory`);
  };

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <AppBar
        title="Spisy"
        trailing={
          <button
            type="button"
            onClick={() => navigate("/profil")}
            className="w-11 h-11 grid place-items-center rounded-full text-sm font-medium text-outline"
            aria-label="O aplikácii"
          >
            i
          </button>
        }
      />
      <div className="app-content px-4 pt-2">
        <p className="text-sm text-outline mb-4">Nahrané dokumenty a analýzy</p>

        <button
          type="button"
          onClick={() => navigate("/sherlock")}
          className="m3-btn-filled mb-4 flex items-center justify-center gap-2"
        >
          <UploadIcon className="w-5 h-5" />
          Nahrať PDF
        </button>

        {loading && (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-10 h-10 border-2 border-outline-variant border-t-primary rounded-full animate-spin mb-4" />
            <p className="text-sm text-outline">Načítavam spisy…</p>
          </div>
        )}

        {!loading && error && (
          <div className="m3-card-outlined text-center py-8">
            <p className="text-sm font-medium text-surface-on mb-1">
              Spisy sa nepodarilo načítať
            </p>
            <p className="text-xs text-outline leading-relaxed mb-3">{error}</p>
            <button
              type="button"
              className="m3-btn-text text-primary"
              onClick={() => navigate("/sherlock?demo=true")}
            >
              Otvoriť demo spis
            </button>
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <div className="m3-card-outlined text-center py-8">
            <FilesIcon className="w-8 h-8 text-outline mx-auto mb-3" />
            <p className="text-sm font-medium text-surface-on mb-1">Zatiaľ prázdne</p>
            <p className="text-xs text-outline leading-relaxed mb-4">
              Po analýze v Sherlockovi sa tu zobrazia vaše spisy.
            </p>
            <button
              type="button"
              onClick={() => navigate("/sherlock?demo=true")}
              className="text-sm font-medium text-primary"
            >
              Vyskúšať demo (BA-KE)
            </button>
          </div>
        )}

        {!loading && !error && items.length > 0 && (
          <div className="space-y-2.5">
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => openCase(item.id)}
                className="m3-card-outlined w-full text-left flex items-center gap-3 active:scale-[0.99] transition-transform"
              >
                <span
                  className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    item.status === "ready"
                      ? "bg-success"
                      : item.status === "analyzing"
                        ? "bg-primary"
                        : "bg-error"
                  }`}
                  title={statusLabel(item.status)}
                />
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-medium text-surface-on truncate">
                    {item.name}
                  </span>
                  <span className="block text-xs text-outline mt-0.5">
                    {statusLabel(item.status)} · {formatDate(item.createdAt)}
                  </span>
                </span>
                <ChevronRightIcon className="w-5 h-5 text-outline-variant flex-shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
