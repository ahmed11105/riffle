"use client";

import { X } from "lucide-react";

// Reusable circular close button. Red bg, white X, border + drop shadow,
// same chunky toy-button feel as everything else in the UI.
export function CloseButton({
  onClick,
  ariaLabel = "Close",
  className = "",
}: {
  onClick: () => void;
  ariaLabel?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className={`inline-flex h-7 w-7 items-center justify-center rounded-full border-2 border-stone-900 bg-rose-500 text-stone-50 shadow-[0_2px_0_0_rgba(0,0,0,0.9)] transition active:translate-y-0.5 active:shadow-[0_1px_0_0_rgba(0,0,0,0.9)] hover:bg-rose-400 ${className}`}
    >
      <X className="h-4 w-4" strokeWidth={3} aria-hidden />
    </button>
  );
}
