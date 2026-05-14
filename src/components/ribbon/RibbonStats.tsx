"use client";

import { Flame, Snowflake } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthProvider";

// Compact stats strip for the chrome ribbon: level + XP bar followed
// by streak and freeze counts. Lives between the
// daily/tournament icons and the Riffs pill so the player has a
// permanent HUD across every page (HomeStats below the home buttons
// is removed in favour of this).
//
// Icons-only, no "streak" / "freezes" labels — the icon does the
// work. Each chip carries a `title` attribute so hovering on
// desktop reveals what the icon represents (touch users see the
// numbers and learn-by-doing).
export function RibbonStats() {
  const { profile, streak, loading } = useAuth();
  if (loading || !profile) return null;

  const level = profile.level ?? 1;
  const xp = profile.xp ?? 0;
  // Same curve as add_xp on the server: 50 XP to advance N → N+1.
  const xpThreshold = 50 * level;
  const xpRatio = Math.min(1, xp / xpThreshold);
  const streakNum = streak?.current_streak ?? 0;
  const freezes = streak?.freezes_available ?? 0;

  return (
    <div className="flex shrink-0 items-center gap-2 px-1 sm:gap-3 sm:px-2">
      <div
        className="flex shrink-0 items-center gap-1.5"
        title={`Level ${level} · ${xp}/${xpThreshold} XP to next level`}
      >
        <span className="shrink-0 text-[10px] font-black tracking-wider text-amber-300">
          LV {level}
        </span>
        {/* Bar capped at a fixed width so it doesn't grow to fill the
            ribbon. Leaves room for future chips between the stats and
            the Riffs pill. */}
        <div className="h-2 w-16 overflow-hidden rounded-full border border-amber-100/30 bg-stone-900/80 sm:w-20">
          <div
            className="h-full bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 transition-[width] duration-500"
            style={{ width: `${Math.max(xpRatio * 100, 2)}%` }}
          />
        </div>
      </div>
      <div
        className="flex shrink-0 items-center gap-0.5 font-black"
        title={`Daily streak — ${streakNum} ${streakNum === 1 ? "day" : "days"} in a row`}
      >
        <Flame
          className="h-4 w-4 text-orange-500"
          strokeWidth={2.5}
          fill="currentColor"
        />
        <span className="text-xs text-amber-300">{streakNum}</span>
      </div>
      {freezes > 0 && (
        <div
          className="flex shrink-0 items-center gap-0.5 font-black"
          title={`Streak freezes — ${freezes} ${freezes === 1 ? "save" : "saves"} banked for missed days`}
        >
          <Snowflake className="h-4 w-4 text-cyan-300" strokeWidth={2.5} />
          <span className="text-xs text-cyan-300">{freezes}</span>
        </div>
      )}
    </div>
  );
}
