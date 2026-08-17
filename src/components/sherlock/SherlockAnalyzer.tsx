import { useState } from "react";
import { UploadIcon, ScanIcon, AlertIcon } from "../Icons";

interface SherlockAnalyzerProps {
  tab: "sandbox" | "upload";
  onTabChange: (tab: "sandbox" | "upload") => void;
  onAnalyze: (files: File[]) => void;
  onDemo: () => void;
  error: string | null;
}

export function SherlockAnalyzer({
  tab,
  onTabChange,
  onAnalyze,
  onDemo,
  error,
}: SherlockAnalyzerProps) {
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      const updated = [...uploadedFiles, ...newFiles];
      setUploadedFiles(updated);
    }
  };

  const removeFile = (index: number) => {
    const updated = uploadedFiles.filter((_, i) => i !== index);
    setUploadedFiles(updated);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const canAnalyze = tab === "upload" && uploadedFiles.length > 0;

  const handleAnalyzeClick = () => {
    if (canAnalyze) {
      onAnalyze(uploadedFiles);
    }
  };

  return (
    <div>
      {/* Tab prepínač */}
      <div className="flex gap-1 p-1 bg-bg-surface rounded-xl mb-5">
        <button
          onClick={() => onTabChange("sandbox")}
          className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            tab === "sandbox" ? "bg-cta text-bg" : "text-slate-400"
          }`}
        >
          Z môjho sandboxu
        </button>
        <button
          onClick={() => onTabChange("upload")}
          className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            tab === "upload" ? "bg-cta text-bg" : "text-slate-400"
          }`}
        >
          Nahrať nový
        </button>
      </div>

      {/* Sandbox tab — info že zatiaľ nie sú reálne súbory */}
      {tab === "sandbox" && (
        <div className="card p-5 mb-5 text-center">
          <UploadIcon className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-sm text-slate-300 font-medium mb-1">
            Sandbox sa pripravuje
          </p>
          <p className="text-xs text-slate-500 leading-relaxed mb-3">
            Pre reálnu analýzu prepnite na "Nahrať nový" a vyberte PDF súbor.
            Sandbox s uloženými súbormi bude dostupný po pripojení Convex backendu.
          </p>
          <button
            onClick={() => onTabChange("upload")}
            className="text-xs text-cta font-medium"
          >
            Prepnúť na upload →
          </button>
        </div>
      )}

      {/* Upload tab — reálny file input */}
      {tab === "upload" && (
        <div className="mb-5">
          <label className="block card border-dashed border-2 border-slate-700 p-8 text-center cursor-pointer hover:border-cta/50 transition-colors">
            <input
              type="file"
              accept=".pdf,.txt,.doc,.docx"
              multiple
              onChange={handleFileChange}
              className="hidden"
            />
            <UploadIcon className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <p className="text-sm text-slate-300 font-medium mb-1">
              Pretiahnite PDF alebo kliknite
            </p>
            <p className="text-xs text-slate-500">
              Podporované: PDF, TXT · max 50 MB
            </p>
          </label>

          {/* Zoznam nahraných súborov */}
          {uploadedFiles.length > 0 && (
            <div className="mt-3 space-y-2">
              {uploadedFiles.map((file, index) => (
                <div
                  key={index}
                  className="card p-3 flex items-center gap-3"
                >
                  <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-cta/10 flex items-center justify-center">
                    <ScanIcon className="w-5 h-5 text-cta" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-100 truncate">
                      {file.name}
                    </p>
                    <p className="text-xs text-slate-500">
                      {formatFileSize(file.size)} · {file.type || "neznámy typ"}
                    </p>
                  </div>
                  <button
                    onClick={() => removeFile(index)}
                    className="text-slate-500 hover:text-danger transition-colors p-1"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
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
        onClick={handleAnalyzeClick}
        disabled={!canAnalyze}
        className="btn-primary"
      >
        Spustiť Sherlock Analýzu
      </button>

      {canAnalyze && (
        <p className="text-xs text-slate-500 text-center mt-3">
          Pripravené: {uploadedFiles.length}{" "}
          {uploadedFiles.length === 1 ? "súbor" : "súborov"} · Mistral AI
        </p>
      )}

      {!canAnalyze && tab === "upload" && (
        <p className="text-xs text-slate-600 text-center mt-3">
          Nahrajte aspoň jeden PDF súbor
        </p>
      )}
    </div>
  );
}
