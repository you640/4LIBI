import { AlertIcon } from "../Icons";

interface SherlockAnalyzerProps {
  onAnalyzeLinear: () => void;
  linearReady?: boolean;
  linearMessage?: string | null;
  error: string | null;
}

export function SherlockAnalyzer({
  onAnalyzeLinear,
  linearReady = false,
  linearMessage = null,
  error,
}: SherlockAnalyzerProps) {
  return (
    <div data-testid="sherlock-linear-only">
      {error && (
        <div className="m3-card-outlined p-4 mb-4 flex gap-2 border-error">
          <AlertIcon className="w-5 h-5 text-error flex-shrink-0" />
          <p className="text-sm text-error">{error}</p>
        </div>
      )}

      <div className="m3-card-outlined p-6 space-y-3">
        <h2 className="text-base font-semibold text-surface-on">
          Forenzná analýza: Linear UBOK
        </h2>
        <p className="text-sm text-outline">
          Odpovede na tri vyšetrovacie otázky sa generujú výhradne z Linear
          projektu UBOK výpovede a spisové informácie. Lokálny upload do tohto
          režimu nie je povolený.
        </p>
        <p className="text-xs text-outline" data-testid="linear-status">
          {linearMessage || "Overujem prístup k Linear projektu…"}
        </p>
        <button
          type="button"
          onClick={() => linearReady && onAnalyzeLinear()}
          disabled={!linearReady}
          className="m3-btn-filled w-full"
          data-testid="linear-analyze-btn"
        >
          Analyzovať Linear dôkazy
        </button>
      </div>
    </div>
  );
}
