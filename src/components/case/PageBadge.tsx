interface PageBadgeProps {
  page?: number | null;
}

export function PageBadge({ page }: PageBadgeProps) {
  if (page == null || page <= 0) return null;

  return (
    <span
      className="bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded text-[10px] font-mono border border-slate-200 inline-flex items-center"
      title={`Strana v pôvodnom spise: ${page}`}
    >
      s. {page}
    </span>
  );
}
