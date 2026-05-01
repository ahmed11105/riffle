"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Settings as SettingsIcon } from "lucide-react";
import { useAdminMode } from "@/lib/admin";
import { AdminDrawer } from "@/components/AdminDrawer";

// Admin entry point: a circular gear button anchored to the right
// edge of the viewport, vertically centered. Click → AdminDrawer
// slides in from the right with a CSS transform; click off → it
// slides back out.
//
// The amber-bordered viewport overlay still indicates admin mode
// is active so the trigger position alone isn't the only cue.
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
        className="fixed right-4 top-1/2 z-[101] inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border-2 border-stone-900 bg-amber-400 text-stone-900 shadow-[0_3px_0_0_rgba(0,0,0,0.9)] transition active:translate-y-[calc(-50%+2px)] active:shadow-[0_1px_0_0_rgba(0,0,0,0.9)] hover:bg-amber-300"
      >
        <SettingsIcon className="h-5 w-5" aria-hidden />
      </button>
      <AdminDrawer open={open} onClose={() => setOpen(false)} onExit={exit} />
    </>
  );
}
