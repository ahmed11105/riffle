"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/branding/Logo";

const PRIMARY = [
  { href: "/", label: "Home" },
  { href: "/daily", label: "Daily" },
  { href: "/solo", label: "Solo" },
  { href: "/rooms", label: "Friends Rooms" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/shop", label: "Shop" },
];

const SECONDARY = [
  { href: "/contact", label: "Contact" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
];

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close on route change so the drawer doesn't stay open after a tap.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Lock background scroll while the drawer is open.
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // Close on Escape so keyboard users aren't trapped.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        aria-expanded={open}
        className="fixed left-3 top-3 z-40 flex h-11 w-11 items-center justify-center rounded-full border-2 border-stone-900 bg-amber-400 text-stone-900 shadow-[0_3px_0_0_rgba(0,0,0,0.9)] sm:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div
        onClick={() => setOpen(false)}
        aria-hidden="true"
        className={`fixed inset-0 z-50 bg-stone-950/80 backdrop-blur-sm transition-opacity sm:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Site navigation"
        className={`fixed inset-y-0 left-0 z-50 flex w-72 max-w-[80vw] transform flex-col border-r-4 border-stone-900 bg-stone-50 text-stone-900 transition-transform duration-200 sm:hidden ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b-4 border-stone-900 px-5 py-4">
          {/* Drop Logo's mobile left margin (it exists to clear the floating
              hamburger on page headers, not needed inside the drawer). */}
          <Logo className="!ml-0" />
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
            className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-stone-900 bg-stone-100 text-stone-900 shadow-[0_2px_0_0_rgba(0,0,0,0.9)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex flex-col gap-1 px-3 py-4">
          {PRIMARY.map((item) => {
            const active =
              item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={
                  active
                    ? "rounded-xl border-2 border-stone-900 bg-amber-400 px-4 py-3 text-base font-black uppercase tracking-wider shadow-[0_3px_0_0_rgba(0,0,0,0.9)]"
                    : "rounded-xl border-2 border-transparent px-4 py-3 text-base font-black uppercase tracking-wider hover:bg-stone-100"
                }
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto border-t-2 border-stone-200 px-3 py-3">
          <nav className="flex flex-col gap-1">
            {SECONDARY.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-lg px-4 py-2 text-sm font-bold uppercase tracking-wider text-stone-500 hover:bg-stone-100 hover:text-stone-900"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </aside>
    </>
  );
}
