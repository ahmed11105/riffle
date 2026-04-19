"use client";

import { usePathname, useRouter } from "next/navigation";
import { X } from "lucide-react";
import { useAdminMode } from "@/lib/admin";

// Visual indicator that admin mode is active. Draws a non-interactive
// amber border around the viewport, plus a clickable corner pill that
// exits admin mode from any page. On the /admin page the pill also
// redirects home so you aren't left staring at an admin-only screen
// after powers are revoked.
export function AdminFrame() {
  const [on, setAdmin] = useAdminMode();
  const pathname = usePathname();
  const router = useRouter();
  if (!on) return null;

  function exit() {
    setAdmin(false);
    if (pathname.startsWith("/admin")) {
      router.push("/");
    }
  }

  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-[100] border-4 border-amber-400 shadow-[inset_0_0_24px_rgba(251,191,36,0.25)]"
      />
      <button
        type="button"
        onClick={exit}
        aria-label="Exit admin mode"
        className="fixed left-1/2 top-2 z-[101] inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full border-2 border-stone-900 bg-amber-400 px-3 py-1 text-[11px] font-black uppercase tracking-[0.25em] text-stone-900 shadow-[0_3px_0_0_rgba(0,0,0,0.9)] active:translate-y-0.5 active:shadow-[0_1px_0_0_rgba(0,0,0,0.9)] hover:bg-amber-300"
      >
        <span>Admin mode</span>
        <X className="h-3 w-3" aria-hidden />
      </button>
    </>
  );
}
