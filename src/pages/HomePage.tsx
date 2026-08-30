import { useNavigate } from "react-router-dom";
import { AppBar } from "../components/m3/AppBar";
import { QuickTip } from "../components/home/QuickTip";

export function HomePage() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <AppBar title="ForenzDetectiv" />
      <div className="app-content px-4 pt-2" data-testid="home-hero">
        <QuickTip />

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-surface-on m-0 mb-2 leading-tight">
            Rozpor za sekundu.
            <br />
            Citát zo zdroja.
          </h1>
          <p className="text-sm text-outline m-0 leading-relaxed">
            AI forenzný analyzátor pre vyšetrovacie spisy — nájdite nemožné alibi
            skôr, než prečítate stokrát ten istý dokument.
          </p>
        </div>

        <div className="flex flex-col gap-3 mb-6">
          <button
            type="button"
            className="m3-btn-filled w-full"
            data-testid="home-cta-upload"
            onClick={() => navigate("/sherlock")}
          >
            Nahrať výpoveď (foto/PDF)
          </button>
        </div>

        <div
          className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-xs text-outline text-center"
          data-testid="home-proof-strip"
        >
          <span>Rozpory</span>
          <span aria-hidden="true">·</span>
          <span>Alibi mapa</span>
          <span aria-hidden="true">·</span>
          <span>Citát zo zdroja</span>
        </div>
      </div>
    </div>
  );
}
