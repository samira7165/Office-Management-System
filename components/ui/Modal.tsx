"use client";

import { X } from "lucide-react";
import { useEffect } from "react";

export default function Modal({
  open, onClose, title, children, wide,
}: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode; wide?: boolean;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    // Phones: a sheet that slides up from the bottom, full width. sm and up: centered dialog.
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className={`relative bg-card rounded-t-2xl sm:rounded-2xl border border-border shadow-xl w-full ${wide ? "sm:max-w-2xl" : "sm:max-w-md"} max-h-[92dvh] sm:max-h-[90vh] overflow-y-auto overscroll-contain`}>
        <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3.5 sm:py-4 border-b border-border sticky top-0 z-10 bg-card rounded-t-2xl">
          <h2 className="font-semibold text-base truncate">{title}</h2>
          <button onClick={onClose} className="shrink-0 w-8 h-8 -mr-1.5 rounded-lg flex items-center justify-center text-muted hover:text-foreground hover:bg-background" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 sm:p-6 pb-[max(1rem,env(safe-area-inset-bottom))]">{children}</div>
      </div>
    </div>
  );
}
