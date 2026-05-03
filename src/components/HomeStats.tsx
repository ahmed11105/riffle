"use client";

import { useEffect, useRef, useState } from "react";
import { Flame, Snowflake } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { XP_GAINED_EVENT, type XpGainedDetail } from "@/lib/metrics";

// Transient "+N XP from <source>" chip that drifts up out of the
// XP bar and fades, so the player understands what just gave them
// XP. Without this the bar grows mysteriously after a claim/spin.
type FlashItem = {
  id: number;
  amount: number;
  source: string;
};

export function HomeStats() {
  const { profile, streak, loading } = useAuth();
  const [flashes, setFlashes] = useState<FlashItem[]>([]);
  const idRef = useRef(1);

  useEffect(() => {
    function handle(e: Event) {
      const detail = (e as CustomEvent<XpGainedDetail>).detail;
      if (!detail || detail.amount <= 0) return;
      const id = idRef.current++;
      setFlashes((prev) => [...prev, { id, ...detail }]);
      // Each chip self-removes after the float-out animation. Keeps
      // the array from growing unboundedly across a long session.
      window.setTimeout(() => {
        setFlashes((prev) => prev.filter((f) => f.id !== id));
      }, 1800);
    }
    window.addEventListener(XP_GAINED_EVENT, handle);
    return () => window.removeEventListener(XP_GAINED_EVENT, handle);
  }, []);

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
        <div className="inline-flex items-center gap-1.5">
          <Flame className="h-4 w-4 text-orange-500" strokeWidth={2.5} fill="currentColor" />
          <span className="font-black text-amber-300">{loading ? "—" : streakNum}</span>{" "}
          day streak
        </div>
        {!loading && freezes > 0 && (
          <div className="inline-flex items-center gap-1.5">
            <Snowflake className="h-4 w-4 text-cyan-300" strokeWidth={2.5} />
            <span className="font-black text-cyan-300">{freezes}</span>{" "}
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
          the cross-threshold celebration. The flash chips stack above
          the right end of the bar so the source label reads next to
          where the bar is filling. */}
      <div className="relative flex w-full items-center gap-2 text-xs font-black uppercase tracking-wider">
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

        {/* Flash chips. Each one runs a one-shot keyframe animation
            so we don't need React state transitions per-frame. The
            container sits directly above the bar via bottom-full so
            chips drift up out of the bar into empty space. */}
        <div
          aria-hidden
          className="pointer-events-none absolute bottom-full right-0 mb-1 flex flex-col items-end gap-1"
        >
          {flashes.map((f) => (
            <span
              key={f.id}
              className="riffle-xp-flash inline-flex items-center gap-1 whitespace-nowrap rounded-full border-2 border-stone-900 bg-gradient-to-b from-amber-300 to-amber-500 px-2 py-0.5 text-[10px] font-black text-stone-900 shadow-[0_2px_0_0_rgba(0,0,0,0.6)]"
            >
              <span>+{f.amount} XP</span>
              <span className="opacity-70">· {f.source}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
