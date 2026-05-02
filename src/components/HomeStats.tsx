"use client";

import { useAuth } from "@/lib/auth/AuthProvider";

export function HomeStats() {
  const { profile, streak, loading } = useAuth();

  const streakNum = streak?.current_streak ?? 0;
  const freezes = streak?.freezes_available ?? 0;
  const riffs = profile?.coin_balance ?? 0;
  const level = profile?.level ?? 1;
  const xp = profile?.xp ?? 0;
  // Same curve as add_xp on the server: 50 XP to advance from N→N+1.
  const xpThreshold = 50 * level;
  const xpRatio = Math.min(1, xp / xpThreshold);

  return (
    <div className="mt-8 flex w-full max-w-sm flex-col items-center gap-3">
      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-amber-100/60">
        <div>
          <span className="font-black text-amber-300">🔥 {loading ? "—" : streakNum}</span>{" "}
          day streak
        </div>
        {!loading && freezes > 0 && (
          <div>
            <span className="font-black text-cyan-300">❄️ {freezes}</span>{" "}
            {freezes === 1 ? "freeze" : "freezes"}
          </div>
        )}
        <div>
          <span className="font-black text-amber-300">{loading ? "—" : riffs}</span>{" "}
          Riffs
        </div>
      </div>
      {/* Level + XP bar — visible progress feeds the dopamine on every
          win. Fills smoothly between levels; level-up toast handles
          the cross-threshold celebration. */}
      <div className="flex w-full items-center gap-2 text-xs font-black uppercase tracking-wider">
        <span className="text-amber-300">Lv {loading ? "—" : level}</span>
        <div className="h-2 flex-1 overflow-hidden rounded-full border border-amber-100/30 bg-stone-900/80">
          <div
            className="h-full bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 transition-[width] duration-500"
            style={{ width: `${Math.max(xpRatio * 100, 2)}%` }}
          />
        </div>
        <span className="font-mono tabular-nums text-amber-100/50">
          {loading ? "" : `${xp}/${xpThreshold}`}
        </span>
      </div>
    </div>
  );
}
