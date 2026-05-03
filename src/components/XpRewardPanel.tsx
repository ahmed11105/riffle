"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthProvider";

// XP / level feedback panel that appears on a reveal screen so the
// player sees what solving earned them. Without this, the award
// fires silently — HomeStats only renders on /, and the user never
// navigates back there before the +XP chip dismisses.
//
// On mount we anchor the bar at the pre-award value (current xp
// minus the awarded amount, clamped at 0 so a level-crossing grant
// doesn't go negative), then transition to the actual value so the
// bar visibly fills. Subsequent profile updates (e.g. another grant
// lands while still on this screen) just track the latest.
export function XpRewardPanel({ awarded }: { awarded: number }) {
  const { profile } = useAuth();
  const [displayXp, setDisplayXp] = useState<number | null>(null);
  const [displayLevel, setDisplayLevel] = useState<number | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (!profile) return;
    if (!startedRef.current) {
      startedRef.current = true;
      const before = Math.max(0, profile.xp - awarded);
      setDisplayXp(before);
      setDisplayLevel(profile.level);
      const t = window.setTimeout(() => {
        setDisplayXp(profile.xp);
        setDisplayLevel(profile.level);
      }, 350);
      return () => window.clearTimeout(t);
    }
    setDisplayXp(profile.xp);
    setDisplayLevel(profile.level);
  }, [profile, awarded]);

  if (!profile || displayXp == null || displayLevel == null) return null;

  const threshold = 50 * displayLevel;
  const ratio = Math.min(1, displayXp / threshold);

  return (
    <div className="w-full overflow-hidden rounded-2xl border-2 border-amber-700 bg-gradient-to-br from-stone-900 via-amber-950 to-stone-900 p-4 shadow-[0_3px_0_0_rgba(0,0,0,0.6),inset_0_1px_0_0_rgba(255,200,80,0.15)]">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.25em] text-amber-300/70">
          <Sparkles className="h-3 w-3" />
          XP earned
        </div>
        <span className="inline-flex items-center gap-1 rounded-full border-2 border-stone-900 bg-gradient-to-b from-amber-300 to-amber-500 px-3 py-0.5 text-xs font-black text-stone-900 shadow-[0_2px_0_0_rgba(0,0,0,0.6)]">
          +{awarded} XP
        </span>
      </div>
      <div className="mt-3 flex items-center gap-2 text-xs font-black uppercase tracking-wider">
        <span className="text-amber-300">Lv {displayLevel}</span>
        <div className="h-3 flex-1 overflow-hidden rounded-full border-2 border-stone-900 bg-stone-950/80 shadow-[inset_0_1px_0_0_rgba(0,0,0,0.4)]">
          <div
            className="h-full bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 transition-[width] duration-1000 ease-out"
            style={{ width: `${Math.max(ratio * 100, 4)}%` }}
          />
        </div>
        <span className="font-mono tabular-nums text-amber-100/60">
          {displayXp}/{threshold}
        </span>
      </div>
    </div>
  );
}
