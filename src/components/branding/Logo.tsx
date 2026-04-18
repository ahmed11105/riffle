"use client";

import { useAdminTapGesture } from "@/lib/admin";

export function Logo({ className = "" }: { className?: string }) {
  const tap = useAdminTapGesture();
  return (
    <div
      className={`inline-flex cursor-pointer items-center gap-2 font-black tracking-tight ml-12 sm:ml-0 ${className}`}
      aria-label="Riffle"
      onClick={tap}
    >
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border-2 border-stone-900 bg-amber-400 text-stone-900 shadow-[0_4px_0_0_rgba(0,0,0,0.9)]">
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden>
          <rect x="3" y="9" width="2.5" height="6" rx="1" />
          <rect x="7" y="6" width="2.5" height="12" rx="1" />
          <rect x="11" y="3" width="2.5" height="18" rx="1" />
          <rect x="15" y="7" width="2.5" height="10" rx="1" />
          <rect x="19" y="10" width="2.5" height="4" rx="1" />
        </svg>
      </span>
      <span className="text-3xl">Riffle</span>
    </div>
  );
}
