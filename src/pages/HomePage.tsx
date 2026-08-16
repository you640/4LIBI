import { useNavigate } from "react-router-dom";
import {
  UploadIcon,
  ScanIcon,
  AlertIcon,
  ClockIcon,
  CheckIcon,
  PeopleIcon,
} from "../components/Icons";

export function HomePage() {
  const navigate = useNavigate();

  return (
    <div className="px-5 pt-4 pb-8">
      {/* Brand header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-cta/10 flex items-center justify-center">
            <ScanIcon className="w-5 h-5 text-cta" />
          </div>
          <span className="font-semibold text-slate-100">ForenzDetectiv</span>
        </div>
        <span className="text-xs text-slate-500 font-medium">v0.1</span>
      </div>

      {/* Hero */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-100 leading-tight mb-2">
          Nájdite rozpor vo výpovediach
        </h1>
        <p className="text-sm text-slate-400 leading-relaxed">
          V spise, ktorý ste prečítali stokrát, nájdete rozpor za sekundu — a uvidíte
          presné miesto, kde sa lúšti alibi.
        </p>
      </div>

      {/* Primary CTA — full width amber */}
      <button
        onClick={() => navigate("/sherlock?tab=upload")}
        className="btn-primary flex items-center justify-center gap-2 mb-3"
      >
        <UploadIcon className="w-5 h-5" />
        Nahrať výpoveď (foto/PDF)
      </button>

      {/* Secondary CTA — outline */}
      <button
        onClick={() => navigate("/sherlock?demo=true")}
        className="btn-secondary flex items-center justify-center gap-2 mb-8"
      >
        <ClockIcon className="w-5 h-5 text-cta" />
        Vyskúšať demo spis (BA-KE alibi)
      </button>

      {/* Proof strip */}
      <div className="card p-4 mb-6">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <AlertIcon className="w-6 h-6 text-danger mx-auto mb-1" />
            <p className="text-[11px] text-slate-400 leading-tight">Rozpory</p>
          </div>
          <div>
            <ScanIcon className="w-6 h-6 text-accent mx-auto mb-1" />
            <p className="text-[11px] text-slate-400 leading-tight">Alibi mapa</p>
          </div>
          <div>
            <CheckIcon className="w-6 h-6 text-success mx-auto mb-1" />
            <p className="text-[11px] text-slate-400 leading-tight">Citát zo zdroja</p>
          </div>
        </div>
      </div>

      {/* Feature highlights */}
      <div className="space-y-3">
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide px-1">
          Čo Sherlock dokáže
        </h2>

        <div className="card p-4">
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-danger/10 flex items-center justify-center">
              <AlertIcon className="w-5 h-5 text-danger" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-100 text-sm mb-0.5">
                Deteguje rozpory
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Porovná výpovede a nájde, kde si odporujú — s citátom z dokumentu.
              </p>
            </div>
          </div>
        </div>

        <div className="card p-4">
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
              <ClockIcon className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-100 text-sm mb-0.5">
                Časová os udalostí
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Chronologicky zoradí udalosti a ukáže, kedy alibi neplatí.
              </p>
            </div>
          </div>
        </div>

        <div className="card p-4">
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center">
              <PeopleIcon className="w-5 h-5 text-success" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-100 text-sm mb-0.5">
                Osoby a vzťahy
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Roztriedi osoby, dôkazy a vzťahy — prehľadne na jednej obrazovke.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

