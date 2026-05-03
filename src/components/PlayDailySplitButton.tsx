"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Headphones } from "lucide-react";

// Split-button: main label routes to /daily on click, the chevron on
// the right toggles a dropdown that surfaces /solo as a secondary
// "Play Unlimited" entry. Lets the home page lead with the highest-
// intent action (daily puzzle) without burying the unlimited-play
// path one more click away.
//
// Implementation notes:
//   - The two halves are siblings inside a flex shell so clicks land
//     on whichever target the user actually tapped (no nested
//     interactives — browsers don't allow <button> inside <a>).
//   - The dropdown closes on outside click + Escape.
//   - Animation matches the existing pill button's press-down feel
//     (translate-y on active) so the split halves still read as one
//     button at rest.
export function PlayDailySplitButton() {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrapperRef} className="relative inline-flex">
      <div className="inline-flex overflow-hidden rounded-full border-4 border-stone-900 bg-amber-400 shadow-[0_6px_0_0_rgba(0,0,0,0.9)] transition active:translate-y-1 active:shadow-[0_2px_0_0_rgba(0,0,0,0.9)]">
        <Link
          href="/daily"
          className="px-6 py-3 text-base font-black text-stone-900 hover:bg-amber-300 sm:px-8 sm:py-4 sm:text-lg"
        >
          Play today&rsquo;s song
        </Link>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label="More play options"
          aria-expanded={open}
          aria-haspopup="menu"
          className="flex items-center justify-center border-l-2 border-stone-900/30 px-3 text-stone-900 hover:bg-amber-300 sm:px-4"
        >
          <ChevronDown
            className={`h-5 w-5 transition-transform ${open ? "rotate-180" : ""}`}
            strokeWidth={3}
          />
        </button>
      </div>
      {open && (
        <div
          role="menu"
          className="absolute left-1/2 top-full z-20 mt-2 w-[min(20rem,calc(100vw-2rem))] -translate-x-1/2 overflow-hidden rounded-2xl border-4 border-stone-900 bg-stone-50 text-stone-900 shadow-[0_6px_0_0_rgba(0,0,0,0.9)]"
        >
          <Link
            href="/solo"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-4 py-3 text-sm font-black hover:bg-amber-200"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-stone-900 bg-amber-400">
              <Headphones className="h-5 w-5 text-stone-900" strokeWidth={2.5} />
            </span>
            <span className="flex flex-col items-start leading-tight">
              <span>Play Unlimited</span>
              <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500">
                Endless songs · No pressure
              </span>
            </span>
          </Link>
        </div>
      )}
    </div>
  );
}
