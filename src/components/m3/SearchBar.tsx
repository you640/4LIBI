interface SearchBarProps {
  open: boolean;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function SearchBar({
  open,
  value,
  onChange,
  placeholder = "Hľadať…",
}: SearchBarProps) {
  if (!open) return null;

  return (
    <div className="m3-search-bar">
      <input
        type="search"
        className="input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus
        autoComplete="off"
      />
    </div>
  );
}
