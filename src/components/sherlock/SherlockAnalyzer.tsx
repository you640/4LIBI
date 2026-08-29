import { useState } from "react";
import { UploadIcon, ScanIcon, AlertIcon } from "../Icons";

interface SherlockAnalyzerProps {
  onAnalyze: (files: File[]) => void;
  error: string | null;
}

export function SherlockAnalyzer({
  onAnalyze,
  error,
}: SherlockAnalyzerProps) {
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      setUploadedFiles([...uploadedFiles, ...newFiles]);
    }
  };

  const removeFile = (index: number) => {
    setUploadedFiles(uploadedFiles.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const canAnalyze = uploadedFiles.length > 0;

  return (
    <div>
      <label className="block m3-card-outlined border-dashed border-2 border-outline-variant p-8 text-center cursor-pointer mb-4">
        <input
          type="file"
          accept=".pdf,.txt,.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp,application/pdf,text/plain"
          multiple
          onChange={handleFileChange}
          className="hidden"
        />
        <UploadIcon className="w-10 h-10 text-outline mx-auto mb-3" />
        <p className="text-sm text-surface-on font-medium mb-1">
          Pretiahnite PDF, fotku alebo TXT
        </p>
        <p className="text-xs text-outline">PDF, foto, TXT · max 50 MB</p>
      </label>

      {uploadedFiles.length > 0 && (
        <div className="mb-4 space-y-2">
          {uploadedFiles.map((file, index) => (
            <div key={index} className="m3-card-outlined p-3 flex items-center gap-3">
              <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-surface-low flex items-center justify-center">
                <ScanIcon className="w-5 h-5 text-surface-on" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-surface-on truncate">
                  {file.name}
                </p>
                <p className="text-xs text-outline">{formatFileSize(file.size)}</p>
              </div>
              <button
                onClick={() => removeFile(index)}
                className="text-outline hover:text-error transition-colors p-1"
                aria-label="Odstrániť súbor"
                type="button"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="m3-card-outlined p-4 mb-4 flex gap-2 border-error">
          <AlertIcon className="w-5 h-5 text-error flex-shrink-0" />
          <p className="text-sm text-error">{error}</p>
        </div>
      )}

      <button
        type="button"
        onClick={() => canAnalyze && onAnalyze(uploadedFiles)}
        disabled={!canAnalyze}
        className="m3-btn-filled"
        data-testid="sherlock-analyze-btn"
      >
        Spustiť Sherlock analýzu
      </button>
    </div>
  );
}

