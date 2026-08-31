import { useState } from "react";
import { UploadIcon, ScanIcon, AlertIcon } from "../Icons";

interface LocalSherlockAnalyzerProps {
  onAnalyze: (files: File[]) => void;
  error: string | null;
}

export function LocalSherlockAnalyzer({
  onAnalyze,
  error,
}: LocalSherlockAnalyzerProps) {
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const MAX_FILE_MB = 200;
  const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024;

  const processFiles = (newFiles: File[]) => {
    const tooBig = newFiles.filter((f) => f.size > MAX_FILE_BYTES);
    if (tooBig.length > 0) {
      setFileError(
        `Súbor ${tooBig[0].name} je príliš veľký (${(tooBig[0].size / (1024 * 1024)).toFixed(0)} MB, max ${MAX_FILE_MB} MB).`
      );
      const validFiles = newFiles.filter((f) => f.size <= MAX_FILE_BYTES);
      if (validFiles.length > 0) {
        setUploadedFiles((prev) => [...prev, ...validFiles]);
      }
    } else {
      setFileError(null);
      setUploadedFiles((prev) => [...prev, ...newFiles]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(Array.from(e.target.files));
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(Array.from(e.dataTransfer.files));
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
    <div data-testid="local-sherlock-analyzer">
      <div className="m3-card-outlined p-3 mb-4 border-amber-300 bg-amber-50">
        <p className="text-xs font-medium text-amber-900">
          Lokálna OCR / Sherlock analýza nie je dôkazný režim. Nevytvára
          odpovede na tri vyšetrovacie otázky a neukladá forenzné výsledky.
        </p>
      </div>

      <label
        className={`block m3-card-outlined border-dashed border-2 p-8 text-center cursor-pointer mb-4 transition-colors ${
          isDragging ? "border-primary bg-primary-container/20" : "border-outline-variant"
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        data-testid="local-upload-dropzone"
      >
        <input
          type="file"
          accept=".pdf,.txt,.jpg,.jpeg,.png,.webp,.bmp,.tiff,.tif,.heic,.heif,.gif,.doc,.docx,image/jpeg,image/png,image/webp,image/bmp,image/tiff,image/heic,image/heif,image/gif,application/pdf,text/plain,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          multiple
          onChange={handleFileChange}
          className="hidden"
          data-testid="local-upload-input"
        />
        <UploadIcon className="w-10 h-10 text-outline mx-auto mb-3" />
        <p className="text-sm text-surface-on font-medium mb-1">
          Pretiahnite PDF, fotku alebo TXT
        </p>
        <p className="text-xs text-outline">PDF, foto, TXT, DOC · max 200 MB na súbor</p>
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

      {(error || fileError) && (
        <div className="m3-card-outlined p-4 mb-4 flex gap-2 border-error">
          <AlertIcon className="w-5 h-5 text-error flex-shrink-0" />
          <p className="text-sm text-error">{error || fileError}</p>
        </div>
      )}

      <button
        type="button"
        onClick={() => canAnalyze && onAnalyze(uploadedFiles)}
        disabled={!canAnalyze}
        className="m3-btn-filled"
        data-testid="local-analyze-btn"
      >
        Spustiť lokálnu OCR analýzu
      </button>
    </div>
  );
}
