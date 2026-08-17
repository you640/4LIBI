import { SearchIcon } from "../Icons";

interface AppBarProps {
  title: string;
  searchOpen?: boolean;
  onToggleSearch?: () => void;
  trailing?: React.ReactNode;
}

export function AppBar({
  title,
  searchOpen,
  onToggleSearch,
  trailing,
}: AppBarProps) {
  return (
    <header className="m3-app-bar" data-testid="m3-app-bar">
      <h1 className="text-[22px] font-semibold leading-7 text-surface-on truncate">
        {title}
      </h1>
      <div className="flex items-center gap-1">
        {onToggleSearch && (
          <button
            type="button"
            onClick={onToggleSearch}
            className="w-11 h-11 grid place-items-center rounded-full text-surface-on"
            aria-label={searchOpen ? "Zavrieť hľadanie" : "Hľadať"}
            aria-pressed={searchOpen}
          >
            <SearchIcon className="w-5 h-5" />
          </button>
        )}
        {trailing}
      </div>
    </header>
  );
}
