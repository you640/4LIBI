import { Outlet, NavLink, useLocation } from "react-router-dom";
import { HomeIcon, SherlockIcon, FilesIcon, ProfileIcon } from "./Icons";

const NAV_ITEMS = [
  { to: "/", label: "Domov", Icon: HomeIcon },
  { to: "/sherlock", label: "Sherlock", Icon: SherlockIcon },
  { to: "/spisy", label: "Spisy", Icon: FilesIcon },
  { to: "/profil", label: "Profil", Icon: ProfileIcon },
];

export function AppLayout() {
  const location = useLocation();

  return (
    <>
      {/* Hlavný obsah — scroll medzi safe area top a bottom nav */}
      <main className="app-content no-scrollbar">
        <Outlet />
      </main>

      {/* Bottom navigation — fixed na spodku s safe area */}
      <nav className="bottom-nav flex-shrink-0 bg-bg-surface/95 backdrop-blur-md border-t border-white/5">
        <div className="flex items-center justify-around px-2 pt-2 pb-1">
          {NAV_ITEMS.map(({ to, label, Icon }) => {
            const isActive =
              to === "/"
                ? location.pathname === "/"
                : location.pathname.startsWith(to);

            return (
              <NavLink
                key={to}
                to={to}
                className="flex flex-col items-center gap-0.5 py-1 px-3 min-w-[64px] transition-colors"
              >
                <Icon
                  className={`w-6 h-6 transition-colors ${
                    isActive ? "text-cta" : "text-slate-500"
                  }`}
                />
                <span
                  className={`text-[10px] font-medium transition-colors ${
                    isActive ? "text-cta" : "text-slate-500"
                  }`}
                >
                  {label}
                </span>
              </NavLink>
            );
          })}
        </div>
      </nav>
    </>
  );
}
