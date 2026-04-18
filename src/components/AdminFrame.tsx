"use client";

import { useAdminMode } from "@/lib/admin";

// Visual indicator that admin mode is active. Draws a non-interactive
// amber border around the viewport and a small corner pill so you always
// know whether admin powers are on.
export function AdminFrame() {
  const [on] = useAdminMode();
  if (!on) return null;
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-[100] border-4 border-amber-400 shadow-[inset_0_0_24px_rgba(251,191,36,0.25)]"
      />
      <div className="pointer-events-none fixed left-1/2 top-2 z-[101] -translate-x-1/2 rounded-full border-2 border-stone-900 bg-amber-400 px-3 py-1 text-[11px] font-black uppercase tracking-[0.25em] text-stone-900 shadow-[0_3px_0_0_rgba(0,0,0,0.9)]">
        Admin mode
      </div>
    </>
  );
}
