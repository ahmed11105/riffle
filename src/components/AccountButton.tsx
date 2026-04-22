"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, LogOut, User as UserIcon } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthProvider";

// Account entry point shown in the top-right header (desktop) and as a
// floating top-right pill on mobile.
//   - Loading: render nothing (avoids layout flash on first paint).
//   - Anonymous: "Sign in" pill -> /account.
//   - Identified (header variant): avatar + display name + chevron, opens
//     a click-toggle dropdown with Account / Sign out. Pro users get a
//     small amber "PRO" tag on the avatar.
//   - Identified (floating mobile variant): plain avatar -> /account.
//     Touch dropdowns are awkward, the page itself has the same actions.
export function AccountButton({ variant = "header" }: { variant?: "header" | "floating" }) {
  const { user, profile, isAnonymous, isPro, loading, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close on outside click and Escape so keyboard users aren't trapped.
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const floating = variant === "floating";
  const baseShadow = "shadow-[0_2px_0_0_rgba(0,0,0,0.9)]";

  // While auth is still resolving, show a neutral placeholder circle so
  // the header doesn't shift when the real button appears. We don't pick
  // sign-in vs avatar yet because we don't know the answer.
  if (loading) {
    const placeholderCls =
      `flex h-11 w-11 items-center justify-center rounded-full border-2 border-stone-900/30 bg-stone-50/30 ${baseShadow}`;
    return floating ? (
      <div
        aria-hidden="true"
        className={`fixed right-3 top-3 z-40 sm:hidden ${placeholderCls}`}
      />
    ) : (
      <div aria-hidden="true" className={placeholderCls} />
    );
  }

  if (!user || isAnonymous) {
    return (
      <Link
        href="/signin"
        aria-label="Sign in or create an account"
        className={
          floating
            ? `fixed right-3 top-3 z-40 flex h-11 items-center rounded-full border-2 border-stone-900 bg-amber-400 px-4 text-xs font-black uppercase tracking-wider text-stone-900 ${baseShadow} sm:hidden`
            : `inline-flex items-center rounded-full border-2 border-stone-900 bg-stone-50 px-3 py-1 text-xs font-black uppercase tracking-wider text-stone-900 ${baseShadow} transition hover:bg-amber-200 active:translate-y-0.5 active:shadow-[0_1px_0_0_rgba(0,0,0,0.9)]`
        }
      >
        Sign in
      </Link>
    );
  }

  const displayName = profile?.display_name?.trim() || "Player";
  const email = user.email ?? null;
  const initial = (displayName || email || "?").trim().charAt(0).toUpperCase() || "?";

  const Avatar = (
    <span
      className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-stone-900 bg-amber-400 text-base font-black text-stone-900 ${baseShadow}`}
    >
      {initial}
      {isPro && (
        <span className="absolute -bottom-1 -right-1 rounded-full border-2 border-stone-900 bg-stone-900 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider text-amber-300">
          Pro
        </span>
      )}
    </span>
  );

  // Mobile floating: plain avatar, taps go straight to /account.
  if (floating) {
    return (
      <Link
        href="/account"
        aria-label={`Account (${displayName})`}
        className="fixed right-3 top-3 z-40 sm:hidden"
      >
        {Avatar}
      </Link>
    );
  }

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut();
      setOpen(false);
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account menu for ${displayName}`}
        className={`inline-flex items-center gap-2 rounded-full border-2 border-stone-900 bg-stone-50 py-1 pl-1 pr-3 text-stone-900 ${baseShadow} transition hover:bg-amber-200 active:translate-y-0.5 active:shadow-[0_1px_0_0_rgba(0,0,0,0.9)]`}
      >
        {Avatar}
        <span className="max-w-[8rem] truncate text-xs font-black uppercase tracking-wider">
          {displayName}
        </span>
        <ChevronDown className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-64 overflow-hidden rounded-2xl border-4 border-stone-900 bg-stone-50 text-stone-900 shadow-[0_6px_0_0_rgba(0,0,0,0.9)]"
        >
          <div className="border-b-2 border-stone-200 px-4 py-3">
            <p className="truncate text-sm font-black">{displayName}</p>
            {email && (
              <p className="mt-0.5 truncate text-xs text-stone-500">{email}</p>
            )}
          </div>

          <Link
            href="/account"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-4 py-3 text-sm font-bold hover:bg-amber-200"
          >
            <UserIcon className="h-4 w-4" /> Your account
          </Link>

          <button
            type="button"
            role="menuitem"
            onClick={handleSignOut}
            disabled={signingOut}
            className="flex w-full items-center gap-3 border-t-2 border-stone-200 px-4 py-3 text-left text-sm font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-60"
          >
            <LogOut className="h-4 w-4" /> {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      )}
    </div>
  );
}
