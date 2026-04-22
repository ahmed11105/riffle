"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth/AuthProvider";

// Shown on the daily reveal for anonymous players. The right moment
// to ask for an email is right after a win — the user has a streak
// they don't want to lose. Hidden for signed-in users automatically.
export function SaveProgressNudge() {
  const { isAnonymous, loading, streak } = useAuth();
  if (loading || !isAnonymous) return null;

  const current = streak?.current_streak ?? 0;
  const headline =
    current > 0
      ? `Don't lose your ${current}-day streak`
      : "Save your progress";
  const sub =
    current > 0
      ? "Add an email so your streak follows you to other devices. One-tap magic link, no password."
      : "Add an email to keep your streak, Riffs, and unlocks across devices. One-tap magic link.";

  return (
    <div className="w-full rounded-2xl border-4 border-stone-900 bg-amber-300 p-4 text-stone-900 shadow-[0_6px_0_0_rgba(0,0,0,0.9)]">
      <p className="text-base font-black">{headline}</p>
      <p className="mt-1 text-sm">{sub}</p>
      <Link
        href="/signin"
        className="mt-3 inline-flex items-center rounded-full border-4 border-stone-900 bg-stone-900 px-5 py-2 text-sm font-black text-amber-300 shadow-[0_3px_0_0_rgba(0,0,0,0.9)] active:translate-y-0.5 active:shadow-[0_1px_0_0_rgba(0,0,0,0.9)]"
      >
        Save my progress →
      </Link>
    </div>
  );
}
