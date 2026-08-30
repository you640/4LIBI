import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRightIcon, FilesIcon, TrashIcon, UploadIcon } from "../components/Icons";
import { listAnalyses, deleteAnalysis, deleteAllAnalyses, renameAnalysis, type AnalysisSummary } from "../lib/api";
import { AppBar } from "../components/m3/AppBar";
import { rememberLastCaseId } from "../lib/caseUtils";

function statusLabel(status: string): string {
  if (status === "ready") return "Pripravený";
  if (status === "queued") return "Vo fronte";
  if (status === "processing" || status === "analyzing") return "Prebieha";
  if (status === "error") return "Chyba";
  return status;
}

function statusColor(status: string): string {
  if (status === "ready") return "bg-success";
  if (status === "queued" || status === "processing" || status === "analyzing") {
    return "bg-primary animate-pulse";
  }
  return "bg-error";
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
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<AnalysisSummary | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);

  const fetchAnalyses = (isManualReload = false) => {
    if (isManualReload) {
      setLoading(true);
    }
    setError(null);
    listAnalyses()
      .then((rows) => {
        setItems(rows);
      })
      .catch((err) => {
        setError(
          err instanceof Error ? err.message : "Spisy sa nepodarilo načítať."
        );
      })
      .finally(() => {
        setLoading(false);
      });
  };

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

  const handleDeleteOne = async (e: React.MouseEvent, item: AnalysisSummary) => {
    e.stopPropagation();
    setItemToDelete(item);
  };

  const confirmDeleteOne = async () => {
    if (!itemToDelete) return;
    const targetId = itemToDelete.id;
    setDeletingId(targetId);
    setItemToDelete(null);
    try {
      await deleteAnalysis(targetId);
      setItems((prev) => prev.filter((i) => i.id !== targetId));
      setActionSuccess("Spis bol úspešne vymazaný.");
      setTimeout(() => setActionSuccess(null), 3500);
    } catch {
      setError("Vymazanie spisu zlyhalo.");
    } finally {
      setDeletingId(null);
    }
  };

  const handleEraseAll = async () => {
    setConfirmDeleteAll(false);
    setIsDeletingAll(true);
    try {
      await deleteAllAnalyses();
      setItems([]);
      setActionSuccess("Všetky spisy a analýzy boli úspešne vymazané.");
      setTimeout(() => setActionSuccess(null), 4000);
    } catch {
      setError("Hromadné vymazanie zlyhalo.");
    } finally {
      setIsDeletingAll(false);
    }
  };

  const startRename = (e: React.MouseEvent, item: AnalysisSummary) => {
    e.stopPropagation();
    setEditingId(item.id);
    setEditName(item.name);
  };

  const cancelRename = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditingId(null);
    setEditName("");
  };

  const submitRename = async (item: AnalysisSummary) => {
    const trimmed = editName.trim();
    if (!trimmed || trimmed === item.name) {
      cancelRename();
      return;
    }
    setRenamingId(item.id);
    try {
      const updated = await renameAnalysis(item.id, trimmed);
      setItems((prev) =>
        prev.map((row) => (row.id === item.id ? { ...row, name: updated.name } : row))
      );
      setActionSuccess("Názov spisu bol aktualizovaný.");
      setTimeout(() => setActionSuccess(null), 3500);
    } catch {
      setError("Premenovanie spisu zlyhalo.");
    } finally {
      setRenamingId(null);
      setEditingId(null);
      setEditName("");
    }
  };

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <AppBar
        title="Spisy"
        trailing={
          <button
            type="button"
            onClick={() => navigate("/profil")}
            className="w-11 h-11 grid place-items-center rounded-full text-sm font-medium text-outline hover:text-surface-on"
            aria-label="O aplikácii"
          >
            i
          </button>
        }
      />
      <div className="app-content px-4 pt-2">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-surface-on">Nahrané dokumenty a analýzy</h2>
            <p className="text-xs text-outline">Prehľad a správa vyšetrovacích spisov</p>
          </div>
          {items.length > 0 && (
            <span className="text-xs px-2.5 py-1 rounded-full bg-surface-variant text-surface-variant-on font-medium">
              {items.length} {items.length === 1 ? "spis" : items.length < 5 ? "spisy" : "spisov"}
            </span>
          )}
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-4">
          <button
            type="button"
            onClick={() => navigate("/sherlock")}
            className="m3-btn-filled flex items-center justify-center gap-2 py-2.5"
          >
            <UploadIcon className="w-5 h-5" />
            Nahrať PDF
          </button>

          {items.length > 0 && (
            <button
              type="button"
              disabled={isDeletingAll}
              onClick={() => setConfirmDeleteAll(true)}
              className="px-4 py-2.5 rounded-full border border-error/50 bg-error/10 hover:bg-error/20 text-error font-medium text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            >
              <TrashIcon className="w-4 h-4" />
              {isDeletingAll ? "Vymazávam…" : "Vymazať všetko (Erase all)"}
            </button>
          )}
        </div>

        {/* Notification message */}
        {actionSuccess && (
          <div className="mb-4 p-3 rounded-xl bg-success/15 border border-success/30 text-success text-xs font-medium flex items-center gap-2">
            <span>✓</span>
            <span>{actionSuccess}</span>
          </div>
        )}

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
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                className="m3-btn-text text-primary"
                onClick={() => fetchAnalyses(true)}
              >
                Skúsiť znova
              </button>
            </div>
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <div className="m3-card-outlined text-center py-8" data-testid="files-empty-state">
            <FilesIcon className="w-8 h-8 text-outline mx-auto mb-3" />
            <p className="text-sm font-medium text-surface-on mb-1">Zatiaľ prázdne</p>
            <p className="text-xs text-outline leading-relaxed mb-4">
              Nahrajte spis v Sherlock a rozpory uvidíte v tomto zozname.
            </p>
            <div className="flex flex-col gap-2 items-center">
              <button
                type="button"
                onClick={() => navigate("/sherlock")}
                className="m3-btn-filled !w-auto px-6"
              >
                Nahrať výpoveď (Sherlock)
              </button>
            </div>
          </div>
        )}

        {!loading && !error && items.length > 0 && (
          <div className="space-y-2.5">
            {items.map((item) => {
              const isItemDeleting = deletingId === item.id;
              const isEditing = editingId === item.id;
              const isRenaming = renamingId === item.id;
              return (
                <div
                  key={item.id}
                  onClick={() => !isItemDeleting && !isEditing && openCase(item.id)}
                  className={`m3-card-outlined w-full text-left flex items-center gap-3 cursor-pointer hover:border-primary/50 active:scale-[0.99] transition-all ${
                    isItemDeleting || isRenaming ? "opacity-40 pointer-events-none" : ""
                  }`}
                  data-testid="files-list-item"
                >
                  <span
                    className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${statusColor(item.status)}`}
                    title={statusLabel(item.status)}
                  />
                  <span className="flex-1 min-w-0">
                    {isEditing ? (
                      <input
                        type="text"
                        value={editName}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            void submitRename(item);
                          }
                          if (e.key === "Escape") cancelRename();
                        }}
                        className="w-full text-sm font-medium text-surface-on bg-surface-low border border-outline-variant rounded-lg px-2 py-1"
                        data-testid="files-rename-input"
                        autoFocus
                      />
                    ) : (
                      <span className="block text-sm font-medium text-surface-on truncate">
                        {item.name}
                      </span>
                    )}
                    <span className="block text-xs text-outline mt-0.5">
                      {statusLabel(item.status)} · {formatDate(item.createdAt)}
                    </span>
                  </span>

                  {isEditing ? (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          void submitRename(item);
                        }}
                        className="text-xs font-medium text-primary px-2 py-1"
                        data-testid="files-rename-save"
                      >
                        Uložiť
                      </button>
                      <button
                        type="button"
                        onClick={cancelRename}
                        className="text-xs text-outline px-2 py-1"
                      >
                        Zrušiť
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={(e) => startRename(e, item)}
                        title="Premenovať spis"
                        aria-label={`Premenovať ${item.name}`}
                        className="w-8 h-8 grid place-items-center rounded-full text-outline hover:text-primary hover:bg-primary/10 transition-colors flex-shrink-0"
                        data-testid="files-rename-btn"
                      >
                        ✎
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleDeleteOne(e, item)}
                        title="Vymazať spis"
                        aria-label={`Vymazať ${item.name}`}
                        className="w-8 h-8 grid place-items-center rounded-full text-outline hover:text-error hover:bg-error/10 transition-colors flex-shrink-0"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                      <ChevronRightIcon className="w-5 h-5 text-outline-variant flex-shrink-0" />
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal / Dialog: Confirm Delete All */}
      {confirmDeleteAll && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-surface border border-outline-variant/50 rounded-2xl max-w-sm w-full p-5 shadow-xl text-left">
            <div className="flex items-center gap-3 mb-3 text-error">
              <div className="w-10 h-10 rounded-full bg-error/15 grid place-items-center flex-shrink-0">
                <TrashIcon className="w-5 h-5 text-error" />
              </div>
              <h3 className="text-base font-semibold text-surface-on">
                Vymazať všetky spisy?
              </h3>
            </div>
            <p className="text-xs text-outline leading-relaxed mb-5">
              Naozaj chcete vymazať všetkých <strong>{items.length}</strong> nahraných spisov a ich analýz? Táto akcia je nevratná a odstráni dáta z databázy aj lokálneho úložiska.
            </p>
            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmDeleteAll(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-surface-on hover:bg-surface-variant transition-colors"
              >
                Zrušiť
              </button>
              <button
                type="button"
                onClick={handleEraseAll}
                className="px-4 py-2 rounded-xl text-xs font-medium bg-error hover:bg-error/90 text-white transition-colors"
              >
                Áno, vymazať všetko
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal / Dialog: Confirm Delete Single Case */}
      {itemToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-surface border border-outline-variant/50 rounded-2xl max-w-sm w-full p-5 shadow-xl text-left">
            <div className="flex items-center gap-3 mb-3 text-error">
              <div className="w-10 h-10 rounded-full bg-error/15 grid place-items-center flex-shrink-0">
                <TrashIcon className="w-5 h-5 text-error" />
              </div>
              <h3 className="text-base font-semibold text-surface-on">
                Vymazať spis?
              </h3>
            </div>
            <p className="text-xs text-outline leading-relaxed mb-5">
              Naozaj chcete vymazať spis <strong>"{itemToDelete.name}"</strong>? Táto akcia je nevratná.
            </p>
            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setItemToDelete(null)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-surface-on hover:bg-surface-variant transition-colors"
              >
                Zrušiť
              </button>
              <button
                type="button"
                onClick={confirmDeleteOne}
                className="px-4 py-2 rounded-xl text-xs font-medium bg-error hover:bg-error/90 text-white transition-colors"
              >
                Vymazať
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
