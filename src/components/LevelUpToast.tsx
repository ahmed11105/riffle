"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { LEVEL_UP_EVENT, type LevelUpDetail } from "@/lib/metrics";
import { sfxClaim } from "@/lib/sfx";
import { flyCoinsFrom } from "@/lib/coinFly";
import { RiffsIcon } from "@/components/RiffsIcon";

// Centered celebration card that drops in when add_xp returns a
// level up. Sticks for ~5s, scales out, the Riffs reward flies into
// the balance pill via the standard coin-fly animation. Tap the
// card to dismiss early.
//
// Multi-level case (rare — only when one XP grant crosses several
// thresholds, e.g. a big challenge backlog that pushes the player
// past 2-3 levels in one go): the headline shows "Lv prev → Lv new"
// with a "× N" chip so the magnitude reads at a glance instead of
// hiding the jump behind the final number.
//
// Mounted globally in the layout so any place that calls awardXp()
// triggers the same celebration.
export function LevelUpToast() {
  const { refreshProfile } = useAuth();
  const [detail, setDetail] = useState<LevelUpDetail | null>(null);
  const [visible, setVisible] = useState(false);
  // Track timers so a tap-dismiss or a fresh level-up can cancel
  // the previous auto-dismiss instead of double-firing.
  const dismissTimer = useRef<number | null>(null);
  const unmountTimer = useRef<number | null>(null);

  function clearTimers() {
    if (dismissTimer.current != null) {
      window.clearTimeout(dismissTimer.current);
      dismissTimer.current = null;
    }
    if (unmountTimer.current != null) {
      window.clearTimeout(unmountTimer.current);
      unmountTimer.current = null;
    }
  }

  function dismiss() {
    clearTimers();
    setVisible(false);
    unmountTimer.current = window.setTimeout(() => {
      setDetail(null);
      unmountTimer.current = null;
    }, 320);
  }

  useEffect(() => {
    function handle(e: Event) {
      const next = (e as CustomEvent<LevelUpDetail>).detail;
      if (!next) return;
      clearTimers();
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
      // Auto-dismiss. Bumped from 3.5s to 5s — the previous duration
      // was easy to miss if the player happened to look down for a
      // moment after a long round.
      dismissTimer.current = window.setTimeout(() => {
        setVisible(false);
        dismissTimer.current = null;
        unmountTimer.current = window.setTimeout(() => {
          setDetail(null);
          unmountTimer.current = null;
        }, 320);
      }, 5000);
    }
    window.addEventListener(LEVEL_UP_EVENT, handle);
    return () => {
      window.removeEventListener(LEVEL_UP_EVENT, handle);
      clearTimers();
    };
  }, [refreshProfile]);

  if (!detail) return null;

  const multi = detail.levels_gained > 1;
  const prevLevel = detail.level - detail.levels_gained;

  return (
    <div
      id="level-up-toast"
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-[120] flex items-start justify-center pt-24"
      style={{ pointerEvents: visible ? "auto" : "none" }}
      onClick={dismiss}
    >
      <button
        type="button"
        aria-label="Dismiss level up"
        onClick={(e) => {
          e.stopPropagation();
          dismiss();
        }}
        className="cursor-pointer overflow-hidden rounded-2xl border-4 border-stone-900 bg-gradient-to-br from-amber-300 via-amber-500 to-amber-700 px-6 py-4 text-center text-stone-900 shadow-[0_8px_0_0_rgba(0,0,0,0.9),0_0_30px_rgba(251,191,36,0.5)]"
        style={{
          willChange: "transform, opacity",
          transform: visible ? "scale(1) translateY(0)" : "scale(0.5) translateY(-30px)",
          opacity: visible ? 1 : 0,
          transition:
            "transform 380ms cubic-bezier(0.16, 1, 0.3, 1), opacity 260ms cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        <div className="flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-amber-900/80">
          <Sparkles className="h-3 w-3" />
          {multi ? `Level up × ${detail.levels_gained}` : "Level up"}
          <Sparkles className="h-3 w-3" />
        </div>
        <div className="mt-1 text-3xl font-black uppercase leading-none tracking-tight drop-shadow-[0_2px_0_rgba(0,0,0,0.3)]">
          {multi ? (
            <span className="inline-flex items-center gap-2 whitespace-nowrap">
              <span className="opacity-60">Lv {prevLevel}</span>
              <span aria-hidden className="text-2xl">→</span>
              <span>Lv {detail.level}</span>
            </span>
          ) : (
            <>Level {detail.level}</>
          )}
        </div>
        {detail.reward_riffs > 0 && (
          <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border-2 border-stone-900 bg-stone-900 px-3 py-1 text-sm font-black text-amber-200 shadow-[0_2px_0_0_rgba(0,0,0,0.5)]">
            +{detail.reward_riffs}
            <RiffsIcon size={14} />
          </div>
        )}
      </button>
    </div>
  );
}
