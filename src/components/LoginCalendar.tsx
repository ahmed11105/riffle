"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { createClient } from "@/lib/supabase/client";
import { sfxClaim } from "@/lib/sfx";
import { RiffsIcon } from "@/components/RiffsIcon";

const REWARDS: Record<number, number> = {
  1: 5,
  2: 8,
  3: 12,
  4: 15,
  5: 20,
  6: 30,
  7: 75,
};

// Compute the next claim's day index given current state and today's
// UTC date. Mirrors the SQL claim_login_reward logic so the UI shows
// the right tile pre-claim. Pure function — `today` is passed in to
// keep this hydration-safe.
function nextDayIndex(
  profile: {
    login_day_index: number;
    login_last_claimed_on: string | null;
  },
  today: string,
): number {
  if (!profile.login_last_claimed_on) return 1;
  if (profile.login_last_claimed_on === today) {
    return profile.login_day_index >= 7 ? 1 : profile.login_day_index + 1;
  }
  const yesterday = new Date(
    new Date(today + "T00:00:00.000Z").getTime() - 86400000,
  ).toISOString().slice(0, 10);
  if (profile.login_last_claimed_on === yesterday && profile.login_day_index < 7) {
    return profile.login_day_index + 1;
  }
  return 1;
}

// 7-tile login calendar. Pre-fills past days as claimed, highlights
// today's tile, dims future days. Renders nothing until mounted so
// `new Date()` never runs during prerender — Next 16 cacheComponents
// flags Date calls outside Suspense as blocking-route errors.
export function LoginCalendar() {
  const { profile, refreshProfile, loading } = useAuth();
  const [busy, setBusy] = useState(false);
  const [justClaimed, setJustClaimed] = useState(false);
  const [today, setToday] = useState<string | null>(null);

  useEffect(() => {
    setToday(new Date().toISOString().slice(0, 10));
  }, []);

  const claimedToday = (today != null && profile?.login_last_claimed_on === today) || justClaimed;
  const upcomingDay = useMemo(() => {
    if (!profile || !today) return 1;
    return nextDayIndex(profile, today);
  }, [profile, today]);

  // The tile to highlight today: if not claimed, it's upcomingDay; if
  // claimed, it's the day they just landed on (login_day_index).
  const highlightDay = claimedToday ? profile?.login_day_index ?? 1 : upcomingDay;

  async function handleClaim() {
    if (!profile || busy || claimedToday) return;
    setBusy(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("claim_login_reward");
      if (error) {
        console.warn("claim_login_reward failed:", error.message);
        return;
      }
      const result = data as { ok?: boolean } | null;
      if (result?.ok) {
        setJustClaimed(true);
        sfxClaim();
      }
      await refreshProfile();
    } finally {
      setBusy(false);
    }
  }

  if (loading || !profile || !today) return null;

  return (
    <div className="mt-8 w-full max-w-md rounded-2xl border-4 border-stone-900 bg-stone-900/50 p-4 shadow-[0_4px_0_0_rgba(0,0,0,0.9)]">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-black uppercase tracking-wider text-amber-100/70">
          Daily Riffs
        </span>
        {claimedToday ? (
          <span className="text-[10px] font-black uppercase tracking-wider text-emerald-300">
            ✓ Claimed today
          </span>
        ) : (
          <span className="text-[10px] font-black uppercase tracking-wider text-amber-300">
            Day {upcomingDay} ready
          </span>
        )}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {[1, 2, 3, 4, 5, 6, 7].map((day) => {
          const isHighlight = day === highlightDay;
          const claimable = isHighlight && !claimedToday;
          const isPast = claimedToday ? day <= (profile?.login_day_index ?? 0) : day < upcomingDay;
          const reward = REWARDS[day];

          // Claimable tiles ARE the click target — the old big "Claim
          // N Riffs" button was duplicate UI. CLAIM ribbon at the
          // bottom of the tile communicates affordance inside the
          // box itself.
          const baseTile =
            "relative flex flex-col items-center justify-start gap-0.5 overflow-hidden rounded-lg border-2 pt-2 text-center transition";
          const stateTile = claimable
            ? "border-emerald-700 bg-emerald-500 text-emerald-50 shadow-[0_3px_0_0_rgba(0,0,0,0.6),inset_0_1px_0_0_rgba(255,255,255,0.5),inset_0_-2px_0_0_rgba(0,0,0,0.18)] hover:bg-emerald-400 active:translate-y-0.5 active:shadow-[0_1px_0_0_rgba(0,0,0,0.6),inset_0_1px_0_0_rgba(255,255,255,0.5),inset_0_-2px_0_0_rgba(0,0,0,0.18)] disabled:opacity-60"
            : isPast
              ? "border-stone-800 bg-stone-800 text-amber-100/40"
              : "border-stone-800 bg-stone-900 text-amber-100/70";
          const ring = day === 7 && !claimable ? "ring-2 ring-amber-300/40" : "";

          const inner = (
            <>
              <RiffsIcon size={14} className={claimable ? "" : isPast ? "opacity-40" : "opacity-70"} />
              <span className={`text-xs font-black ${day === 7 && !claimable ? "text-amber-200" : ""}`}>
                {reward}
              </span>
              <div className="mt-1 h-4 w-full">
                {claimable && (
                  // White ribbon + dark money-green text. green-800 is
                  // closest to USD-bill green in Tailwind without
                  // diverging from the site's amber/stone palette.
                  <div className="flex h-full w-full items-center justify-center bg-white text-[9px] font-black uppercase tracking-wider text-green-800">
                    {busy ? "…" : "Claim"}
                  </div>
                )}
              </div>
            </>
          );

          if (claimable) {
            return (
              <button
                key={day}
                type="button"
                onClick={handleClaim}
                disabled={busy}
                aria-label={`Claim ${reward} Riffs`}
                className={[baseTile, stateTile, ring].join(" ")}
              >
                {inner}
              </button>
            );
          }
          return (
            <div key={day} className={[baseTile, stateTile, ring].join(" ")}>
              {inner}
            </div>
          );
        })}
      </div>
    </div>
  );
}
