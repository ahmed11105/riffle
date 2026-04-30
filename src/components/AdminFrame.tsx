"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Settings as SettingsIcon } from "lucide-react";
import { useAdminMode } from "@/lib/admin";
import { AdminDrawer } from "@/components/AdminDrawer";

// Single admin entry point. Pill at top of every page → opens the
// AdminDrawer with tabs for Simulator / Resets / Settings / Songs.
// The drawer absorbs everything that used to live on the /admin
// page except the song scheduler (which is too wide for a side
// panel and stays at /admin).
export function AdminFrame() {
  const [on, setAdmin] = useAdminMode();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  if (!on) return null;

  function exit() {
    setAdmin(false);
    setOpen(false);
    if (pathname.startsWith("/admin")) router.push("/");
  }

  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-[100] border-4 border-amber-400 shadow-[inset_0_0_24px_rgba(251,191,36,0.25)]"
      />
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open admin tools"
        className="fixed left-1/2 top-2 z-[101] inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full border-2 border-stone-900 bg-amber-400 px-3 py-1 text-[11px] font-black uppercase tracking-[0.25em] text-stone-900 shadow-[0_3px_0_0_rgba(0,0,0,0.9)] active:translate-y-0.5 active:shadow-[0_1px_0_0_rgba(0,0,0,0.9)] hover:bg-amber-300"
      >
        <SettingsIcon className="h-3 w-3" aria-hidden />
        <span>Admin</span>
      </button>
      <AdminDrawer open={open} onClose={() => setOpen(false)} onExit={exit} />
    </>
  );
}
