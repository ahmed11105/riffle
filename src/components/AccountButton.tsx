"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth/AuthProvider";

// Account entry point shown in the top-right header (desktop) and as a
// floating top-right pill on mobile. Three states:
//   - Loading: render nothing (avoids layout flash on first paint).
//   - Anonymous: "Sign in" pill -> /account.
//   - Identified: avatar circle with first-letter initial -> /account.
//     Pro users get a small amber "PRO" tag overlay.
export function AccountButton({ variant = "header" }: { variant?: "header" | "floating" }) {
  const { user, profile, isAnonymous, isPro, loading } = useAuth();

  if (loading) return null;

  const floating = variant === "floating";
  const baseShadow = "shadow-[0_2px_0_0_rgba(0,0,0,0.9)]";

  if (!user || isAnonymous) {
    return (
      <Link
        href="/account"
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

  const seed =
    profile?.display_name ?? user.email ?? user.user_metadata?.email ?? "?";
  const initial = seed.trim().charAt(0).toUpperCase() || "?";

  return (
    <Link
      href="/account"
      aria-label={`Account (${seed})`}
      className={
        floating
          ? `fixed right-3 top-3 z-40 sm:hidden`
          : "relative inline-block"
      }
    >
      <span
        className={`relative flex h-11 w-11 items-center justify-center rounded-full border-2 border-stone-900 bg-amber-400 text-base font-black text-stone-900 ${baseShadow} transition hover:bg-amber-300 active:translate-y-0.5 active:shadow-[0_1px_0_0_rgba(0,0,0,0.9)]`}
      >
        {initial}
        {isPro && (
          <span className="absolute -bottom-1 -right-1 rounded-full border-2 border-stone-900 bg-stone-900 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider text-amber-300">
            Pro
          </span>
        )}
      </span>
    </Link>
  );
}
