"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { createClient } from "@/lib/supabase/client";
import { sfxClaim } from "@/lib/sfx";

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
      <div className="mb-3 grid grid-cols-7 gap-1.5">
        {[1, 2, 3, 4, 5, 6, 7].map((day) => {
          const isHighlight = day === highlightDay;
          const isPast = claimedToday ? day <= (profile?.login_day_index ?? 0) : day < upcomingDay;
          const reward = REWARDS[day];
          return (
            <div
              key={day}
              className={[
                "flex flex-col items-center justify-center gap-0.5 rounded-lg border-2 py-2 text-center transition",
                isHighlight && !claimedToday
                  ? "border-amber-400 bg-amber-400 text-stone-900 shadow-[0_2px_0_0_rgba(0,0,0,0.7)]"
                  : isPast
                    ? "border-stone-800 bg-stone-800 text-amber-100/40"
                    : "border-stone-800 bg-stone-900 text-amber-100/70",
                day === 7 ? "ring-2 ring-amber-300/40" : "",
              ].join(" ")}
            >
              <span className="text-[9px] font-black uppercase tracking-wider opacity-60">
                D{day}
              </span>
              <span className={`text-xs font-black ${day === 7 ? "text-amber-200" : ""} ${isHighlight && !claimedToday ? "text-stone-900" : ""}`}>
                {reward}
              </span>
            </div>
          );
        })}
      </div>
      <button
        type="button"
        onClick={handleClaim}
        disabled={claimedToday || busy}
        className="w-full rounded-full border-4 border-stone-900 bg-amber-400 px-4 py-2 text-sm font-black uppercase tracking-wider text-stone-900 shadow-[0_3px_0_0_rgba(0,0,0,0.9)] transition active:translate-y-1 active:shadow-[0_1px_0_0_rgba(0,0,0,0.9)] disabled:cursor-not-allowed disabled:opacity-40"
      >
        {claimedToday
          ? "Come back tomorrow"
          : busy
            ? "Claiming…"
            : `Claim ${REWARDS[upcomingDay]} Riffs`}
      </button>
    </div>
  );
}
