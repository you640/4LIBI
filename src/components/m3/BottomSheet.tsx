import { useEffect, useState, type ReactNode } from "react";

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

export function BottomSheet({ open, onClose, title, children }: BottomSheetProps) {
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [startY, setStartY] = useState(0);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const offsetY = open ? dragY : 0;

  return (
    <>
      <div
        className={`absolute left-0 right-0 bottom-0 z-40 transition-opacity duration-200 ${
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        style={{
          top: "var(--island-band)",
          background: "var(--md-sys-color-scrim)",
        }}
        onClick={() => {
          setDragY(0);
          setDragging(false);
          onClose();
        }}
        aria-hidden={!open}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheet-title"
        className={`absolute left-0 right-0 bottom-0 z-50 bg-surface-lowest rounded-t-[28px] px-5 pt-3 pb-[calc(24px+env(safe-area-inset-bottom,0px))] max-h-[78%] overflow-y-auto ${
          dragging ? "" : "transition-transform duration-200"
        }`}
        style={{
          transform: open ? `translateY(${offsetY}px)` : "translateY(110%)",
          boxShadow: "var(--md-sys-elevation-2)",
        }}
      >
        <div
          className="w-9 h-1 rounded bg-outline-variant mx-auto mb-4 cursor-grab touch-none"
          onPointerDown={(e) => {
            setDragging(true);
            setStartY(e.clientY);
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (!dragging) return;
            setDragY(Math.max(0, e.clientY - startY));
          }}
          onPointerUp={(e) => {
            setDragging(false);
            if (e.clientY - startY > 80) {
              setDragY(0);
              onClose();
            } else {
              setDragY(0);
            }
          }}
        />
        <h2 id="sheet-title" className="text-[22px] font-semibold mb-2 text-surface-on">
          {title}
        </h2>
        {children}
      </div>
    </>
  );
}
