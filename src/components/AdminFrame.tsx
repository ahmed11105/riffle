"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import {
  adminHeaders,
  resetClientProgress,
  resetDailyProgress,
  useAdminMode,
} from "@/lib/admin";

// Floating admin pill, always available while admin mode is on. Click
// (or hover) the pill to drop a menu with reset options + exit. The
// reset options pair the in-browser localStorage wipe with a server
// /api/admin/reset-progress call so the UI and DB reset in lockstep —
// useful for testing the brand-new-player path (login calendar,
// starter pack offer, streak from 0, etc.) without making a new
// account.
export function AdminFrame() {
  const [on, setAdmin] = useAdminMode();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<"daily" | "overall" | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  // Close the menu on outside click.
  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target as Node)) setOpen(false);
    }
    window.addEventListener("mousedown", handle);
    return () => window.removeEventListener("mousedown", handle);
  }, [open]);

  // Auto-clear the toast a couple seconds after each action.
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(id);
  }, [toast]);

  if (!on) return null;

  function exit() {
    setAdmin(false);
    setOpen(false);
    if (pathname.startsWith("/admin")) router.push("/");
  }

  async function callReset(kind: "daily" | "overall") {
    setBusy(kind);
    try {
      const res = await fetch("/api/admin/reset-progress", {
        method: "POST",
        headers: adminHeaders(),
        body: JSON.stringify({ kind }),
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setToast(json.error ? `Reset failed: ${json.error}` : "Reset failed");
        return;
      }
      if (kind === "daily") {
        resetDailyProgress();
        setToast("Daily progress reset");
      } else {
        resetClientProgress();
        setToast("Overall progress reset");
      }
      setOpen(false);
      // Hard reload so every component (auth, streak, login calendar,
      // etc.) re-fetches its server state instead of holding stale
      // client memory.
      setTimeout(() => window.location.reload(), 250);
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-[100] border-4 border-amber-400 shadow-[inset_0_0_24px_rgba(251,191,36,0.25)]"
      />
      <div
        ref={wrapperRef}
        className="fixed left-1/2 top-2 z-[101] -translate-x-1/2"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
      >
        <button
          type="button"
          onClick={() => setOpen((p) => !p)}
          aria-haspopup="menu"
          aria-expanded={open}
          className="inline-flex items-center gap-1.5 rounded-full border-2 border-stone-900 bg-amber-400 px-3 py-1 text-[11px] font-black uppercase tracking-[0.25em] text-stone-900 shadow-[0_3px_0_0_rgba(0,0,0,0.9)] active:translate-y-0.5 active:shadow-[0_1px_0_0_rgba(0,0,0,0.9)] hover:bg-amber-300"
        >
          <span>Admin mode</span>
          <ChevronDown
            className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`}
            aria-hidden
          />
        </button>
        {open && (
          // The menu container starts flush with the pill (top-full)
          // and pushes the visual card down with transparent pt-2.
          // The padding sits INSIDE the wrapper's hover region, so the
          // cursor moving from pill → menu never crosses dead space and
          // onMouseLeave doesn't accidentally fire mid-traverse.
          <div
            role="menu"
            className="absolute left-1/2 top-full -translate-x-1/2 pt-2"
          >
            <div className="w-56 overflow-hidden rounded-xl border-2 border-stone-900 bg-stone-900 text-amber-100 shadow-[0_4px_0_0_rgba(0,0,0,0.9)]">
              <button
                type="button"
                role="menuitem"
                disabled={busy !== null}
                onClick={() => callReset("daily")}
                className="block w-full px-4 py-2.5 text-left text-xs font-black uppercase tracking-wider hover:bg-stone-800 disabled:opacity-50"
              >
                {busy === "daily" ? "Resetting…" : "Reset daily progress"}
              </button>
              <button
                type="button"
                role="menuitem"
                disabled={busy !== null}
                onClick={() => callReset("overall")}
                className="block w-full border-t border-stone-700 px-4 py-2.5 text-left text-xs font-black uppercase tracking-wider hover:bg-stone-800 disabled:opacity-50"
              >
                {busy === "overall" ? "Resetting…" : "Reset overall progress"}
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={exit}
                className="block w-full border-t border-stone-700 px-4 py-2.5 text-left text-xs font-black uppercase tracking-wider text-amber-300 hover:bg-stone-800"
              >
                Exit admin mode
              </button>
            </div>
          </div>
        )}
      </div>
      {toast && (
        <div className="fixed left-1/2 top-12 z-[102] -translate-x-1/2 rounded-full border-2 border-stone-900 bg-emerald-300 px-4 py-1.5 text-xs font-black uppercase tracking-wider text-stone-900 shadow-[0_3px_0_0_rgba(0,0,0,0.9)]">
          {toast}
        </div>
      )}
    </>
  );
}
