import { ProfileIcon } from "../components/Icons";

export function ProfilePage() {
  return (
    <div className="px-5 pt-4 pb-8">
      <h1 className="text-xl font-bold text-slate-100 mb-1">Profil</h1>
      <p className="text-xs text-slate-500 mb-6">Účet a nastavenia</p>

      <div className="flex flex-col items-center justify-center py-12 text-center mb-8">
        <div className="w-20 h-20 rounded-full bg-cta/10 flex items-center justify-center mb-4">
          <ProfileIcon className="w-10 h-10 text-cta" />
        </div>
        <p className="text-sm text-slate-300 font-medium">Neprihlásený</p>
        <p className="text-xs text-slate-500 mt-1">Free plán</p>
      </div>

      <div className="space-y-2">
        <div className="card p-4 flex items-center justify-between">
          <span className="text-sm text-slate-300">Prihlásiť sa</span>
          <span className="text-xs text-slate-500">Auth</span>
        </div>
        <div className="card p-4 flex items-center justify-between">
          <span className="text-sm text-slate-300">Upgradovať na Pro</span>
          <span className="text-xs text-cta">9,99 €/mes</span>
        </div>
        <div className="card p-4 flex items-center justify-between">
          <span className="text-sm text-slate-300">Jazyk</span>
          <span className="text-xs text-slate-500">Slovenčina</span>
        </div>
        <div className="card p-4 flex items-center justify-between">
          <span className="text-sm text-slate-300">O aplikácii</span>
          <span className="text-xs text-slate-500">v0.1</span>
        </div>
      </div>

      <div className="mt-8 pt-6 border-t border-white/5">
        <p className="text-[11px] text-slate-600 text-center leading-relaxed">
          ForenzDetectiv — AI, ktorá v spise nájde rozpor a nemožné alibi.
          <br />
          Rozhodnutia ostávajú na vás.
        </p>
      </div>
    </div>
  );
}
