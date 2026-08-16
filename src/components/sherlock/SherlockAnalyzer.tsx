import { useState } from "react";
import { UploadIcon, ScanIcon, AlertIcon } from "../Icons";

interface SherlockAnalyzerProps {
  tab: "sandbox" | "upload";
  onTabChange: (tab: "sandbox" | "upload") => void;
  onAnalyze: () => void;
  onDemo: () => void;
  error: string | null;
}

// Mock sandbox súbory (kým nepripojíme Convex — Issue #11)
const SANDBOX_FILES = [
  { id: "f1", name: "Výpoveď — Ján Novák.pdf", size: "245 KB", date: "15. 5. 2023" },
  { id: "f2", name: "Výpoveď — Petra Svobodová.pdf", size: "198 KB", date: "15. 5. 2023" },
  { id: "f3", name: "Záznam z kamery.pdf", size: "1.2 MB", date: "15. 5. 2023" },
  { id: "f4", name: "Mýtny lístok D1.pdf", size: "87 KB", date: "15. 5. 2023" },
];

export function SherlockAnalyzer({
  tab,
  onTabChange,
  onAnalyze,
  onDemo,
  error,
}: SherlockAnalyzerProps) {
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);

  const toggleFile = (id: string) => {
    setSelectedFiles((prev) =>
      prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]
    );
  };

  return (
    <div>
      {/* Tab prepínač */}
      <div className="flex gap-1 p-1 bg-bg-surface rounded-xl mb-5">
        <button
          onClick={() => onTabChange("sandbox")}
          className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            tab === "sandbox"
              ? "bg-cta text-bg"
              : "text-slate-400"
          }`}
        >
          Z môjho sandboxu
        </button>
        <button
          onClick={() => onTabChange("upload")}
          className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            tab === "upload"
              ? "bg-cta text-bg"
              : "text-slate-400"
          }`}
        >
          Nahrať nový
        </button>
      </div>

      {/* Sandbox zoznam */}
      {tab === "sandbox" && (
        <div className="space-y-2 mb-5">
          {SANDBOX_FILES.map((file) => {
            const isSelected = selectedFiles.includes(file.id);
            return (
              <button
                key={file.id}
                onClick={() => toggleFile(file.id)}
                className={`card w-full p-4 flex items-center gap-3 text-left transition-colors ${
                  isSelected ? "border-cta/50 bg-cta/5" : ""
                }`}
              >
                <div
                  className={`flex-shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${
                    isSelected
                      ? "border-cta bg-cta"
                      : "border-slate-600"
                  }`}
                >
                  {isSelected && (
                    <svg className="w-3 h-3 text-bg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-100 truncate">
                    {file.name}
                  </p>
                  <p className="text-xs text-slate-500">
                    {file.size} · {file.date}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Upload dropzone */}
      {tab === "upload" && (
        <label className="block card border-dashed border-2 border-slate-700 p-8 mb-5 text-center cursor-pointer hover:border-cta/50 transition-colors">
          <input
            type="file"
            accept=".pdf,.txt,.doc,.docx"
            multiple
            className="hidden"
          />
          <UploadIcon className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-sm text-slate-300 font-medium mb-1">
            Pretiahnite PDF alebo kliknite
          </p>
          <p className="text-xs text-slate-500">
            Podporované: PDF, TXT, DOC, DOCX · max 50 MB
          </p>
        </label>
      )}

      {/* Error */}
      {error && (
        <div className="card border-danger/30 bg-danger/5 p-4 mb-5 flex gap-2">
          <AlertIcon className="w-5 h-5 text-danger flex-shrink-0" />
          <p className="text-sm text-danger">{error}</p>
        </div>
      )}

      {/* Akcia: demo alebo analýza */}
      <button
        onClick={onDemo}
        className="btn-secondary flex items-center justify-center gap-2 mb-3"
      >
        <ScanIcon className="w-5 h-5 text-cta" />
        Vyskúšať demo spis (BA-KE)
      </button>

      <button
        onClick={onAnalyze}
        disabled={tab === "sandbox" && selectedFiles.length === 0}
        className="btn-primary"
      >
        Spustiť Sherlock Analýzu
      </button>

      {tab === "sandbox" && selectedFiles.length > 0 && (
        <p className="text-xs text-slate-500 text-center mt-3">
          Vybrané: {selectedFiles.length} {selectedFiles.length === 1 ? "súbor" : "súbory"}
        </p>
      )}
    </div>
  );
}
