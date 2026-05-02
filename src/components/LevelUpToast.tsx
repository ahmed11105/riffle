"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { LEVEL_UP_EVENT, type LevelUpDetail } from "@/lib/metrics";
import { sfxClaim } from "@/lib/sfx";
import { flyCoinsFrom } from "@/lib/coinFly";
import { RiffsIcon } from "@/components/RiffsIcon";

// Centered celebration card that drops in when add_xp returns a
// level up. Sticks for a few seconds, scales out, the Riffs reward
// flies into the balance pill via the standard coin-fly animation.
//
// Mounted globally in the layout so any place that calls awardXp()
// triggers the same celebration.
export function LevelUpToast() {
  const { refreshProfile } = useAuth();
  const [detail, setDetail] = useState<LevelUpDetail | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function handle(e: Event) {
      const next = (e as CustomEvent<LevelUpDetail>).detail;
      if (!next) return;
      setDetail(next);
      // Two RAF so the initial render has the closed transform
      // applied before we flip to the open transform.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setVisible(true));
      });
      sfxClaim();
      // Coin-fly the Riffs portion into the balance pill once the
      // toast is on screen.
      window.setTimeout(() => {
        const target = document.getElementById("level-up-toast");
        if (next.reward_riffs > 0) flyCoinsFrom(target, next.reward_riffs);
        refreshProfile();
      }, 600);
      // Auto-dismiss after a beat.
      window.setTimeout(() => setVisible(false), 3500);
      window.setTimeout(() => setDetail(null), 3800);
    }
    window.addEventListener(LEVEL_UP_EVENT, handle);
    return () => window.removeEventListener(LEVEL_UP_EVENT, handle);
  }, [refreshProfile]);

  if (!detail) return null;

  return (
    <div
      id="level-up-toast"
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-0 z-[120] flex items-start justify-center pt-24"
    >
      <div
        className="overflow-hidden rounded-2xl border-4 border-stone-900 bg-gradient-to-br from-amber-300 via-amber-500 to-amber-700 px-6 py-4 text-center text-stone-900 shadow-[0_8px_0_0_rgba(0,0,0,0.9),0_0_30px_rgba(251,191,36,0.5)]"
        style={{
          transform: visible ? "scale(1) translateY(0)" : "scale(0.5) translateY(-30px)",
          opacity: visible ? 1 : 0,
          transition:
            "transform 380ms cubic-bezier(0.16, 1, 0.3, 1), opacity 260ms cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        <div className="flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-amber-900/80">
          <Sparkles className="h-3 w-3" />
          Level up
          <Sparkles className="h-3 w-3" />
        </div>
        <div className="mt-1 text-3xl font-black uppercase leading-none tracking-tight drop-shadow-[0_2px_0_rgba(0,0,0,0.3)]">
          Level {detail.level}
        </div>
        {detail.reward_riffs > 0 && (
          <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border-2 border-stone-900 bg-stone-900 px-3 py-1 text-sm font-black text-amber-200 shadow-[0_2px_0_0_rgba(0,0,0,0.5)]">
            +{detail.reward_riffs}
            <RiffsIcon size={14} />
          </div>
        )}
      </div>
    </div>
  );
}
