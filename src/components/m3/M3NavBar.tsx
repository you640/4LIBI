import { NavLink, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  AlertIcon,
  ClockIcon,
  FilesIcon,
  PeopleIcon,
} from "../Icons";
import { getLastCaseId } from "../../lib/caseUtils";
import { useOptionalCaseContext } from "../../lib/caseContext";

function GraphIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2a3 3 0 0 1 1 5.83V11h3.17A3 3 0 1 1 17 13h-3.17v3.17A3 3 0 1 1 12 15.17V13H8.83A3 3 0 1 1 7 11h3.17V7.83A3 3 0 0 1 12 2z" />
    </svg>
  );
}

interface M3NavBarProps {
  onNeedCase?: () => void;
}

export function M3NavBar({ onNeedCase }: M3NavBarProps) {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const caseCtx = useOptionalCaseContext();
  const caseId = id || getLastCaseId();
  const inCase = Boolean(id) && location.pathname.startsWith("/spisy/") && location.pathname !== "/spisy";
  const badge = caseCtx?.openContradictionCount ?? 0;

  const caseTabs = [
    { key: "timeline", label: "Timeline", Icon: ClockIcon },
    { key: "rozpory", label: "Rozpory", Icon: AlertIcon, badge: true },
    { key: "graf", label: "Graf", Icon: GraphIcon },
    { key: "osoby", label: "Osoby", Icon: PeopleIcon },
  ] as const;

  const goCaseTab = (tab: string) => {
    if (!caseId) {
      onNeedCase?.();
      return;
    }
    navigate(`/spisy/${caseId}/${tab}`);
  };

  const onSpisyList =
    location.pathname === "/" ||
    location.pathname === "/spisy" ||
    location.pathname === "/profil";

  return (
    <nav className="m3-nav-bar" aria-label="Hlavná navigácia" data-testid="m3-nav-bar">
      <NavLink
        to="/spisy"
        className="flex-1 flex flex-col items-center justify-start gap-1 min-h-11 pt-0.5"
      >
        {() => {
          const active = onSpisyList;
          return (
            <>
              <span className={`m3-nav-pill ${active ? "m3-nav-pill-active" : "text-surface-on"}`}>
                <FilesIcon className="w-6 h-6" />
              </span>
              <span className={`text-[11px] text-surface-on ${active ? "font-bold" : ""}`}>
                Spisy
              </span>
            </>
          );
        }}
      </NavLink>

      {caseTabs.map(({ key, label, Icon, ...rest }) => {
        const showBadge = "badge" in rest && rest.badge && badge > 0;
        const active = inCase && location.pathname.includes(`/${key}`);
        return (
          <button
            key={key}
            type="button"
            onClick={() => goCaseTab(key)}
            className="flex-1 flex flex-col items-center justify-start gap-1 relative bg-transparent border-0 p-0 min-h-11 pt-0.5"
          >
            {showBadge && (
              <span className="absolute -top-0.5 right-[calc(50%-28px)] min-w-4 h-4 px-1 rounded-full bg-error text-error-on text-[10px] font-semibold leading-4 text-center z-10">
                {badge}
              </span>
            )}
            <span className={`m3-nav-pill ${active ? "m3-nav-pill-active" : "text-surface-on"}`}>
              <Icon className="w-6 h-6" />
            </span>
            <span className={`text-[11px] text-surface-on ${active ? "font-bold" : ""}`}>
              {label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
