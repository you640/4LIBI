import { FilesIcon } from "../components/Icons";

export function FilesPage() {
  return (
    <div className="px-5 pt-4 pb-8">
      <h1 className="text-xl font-bold text-slate-100 mb-1">Moje spisy</h1>
      <p className="text-xs text-slate-500 mb-6">Nahrané dokumenty a analýzy</p>

      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 rounded-2xl bg-bg-surface flex items-center justify-center mb-4">
          <FilesIcon className="w-8 h-8 text-slate-600" />
        </div>
        <p className="text-sm text-slate-400 font-medium mb-1">
          Žiadne spisy zatiaľ
        </p>
        <p className="text-xs text-slate-500 leading-relaxed max-w-[240px]">
          Nahrajte PDF výpoveď v Sherlockovi a tu sa zobrazí.
        </p>
      </div>
    </div>
  );
}
