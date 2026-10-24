"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

/** A bottom sheet on phones, a centred dialog on laptops. Esc or a tap outside closes it. */
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    // Hide page scrolling without letting the page jump when the scrollbar disappears.
    const gap = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (gap > 0 && !CSS.supports("scrollbar-gutter", "stable")) document.body.style.paddingRight = `${gap}px`;
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      document.body.style.paddingRight = "";
      prev?.focus?.();
    };
  }, [onClose]);

  return (
    <div className="sheet-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref}>
        <div className="sheet-grip" aria-hidden />
        <button type="button" className="ghost sheet-x" onClick={onClose} aria-label="Close">
          <X aria-hidden />
        </button>
        {children}
      </div>
    </div>
  );
}
