import { useState } from "react";
import { Outlet } from "react-router-dom";
import { M3NavBar } from "./m3/M3NavBar";

export function AppLayout() {
  const [toast, setToast] = useState<string | null>(null);

  const showNeedCase = () => {
    setToast("Najprv otvorte spis");
    window.clearTimeout((showNeedCase as { _t?: number })._t);
    (showNeedCase as { _t?: number })._t = window.setTimeout(
      () => setToast(null),
      1800
    );
  };

  return (
    <>
      {/* Visual island/camera chrome only — swallows hits, no controls */}
      <div className="island-safe-zone" aria-hidden="true" data-testid="island-safe-zone">
        <div className="dynamic-island" />
      </div>
      <div className="app-body">
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <Outlet />
        </div>
        <M3NavBar onNeedCase={showNeedCase} />
      </div>
      {toast && (
        <div
          className="absolute left-1/2 bottom-[110px] -translate-x-1/2 z-[60] px-4 py-2.5 rounded-lg text-sm pointer-events-none"
          style={{
            background: "var(--md-sys-color-inverse-surface)",
            color: "var(--md-sys-color-on-inverse-surface)",
          }}
          role="status"
        >
          {toast}
        </div>
      )}
    </>
  );
}
