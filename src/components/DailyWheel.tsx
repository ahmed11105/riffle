"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { createClient } from "@/lib/supabase/client";
import { sfxClaim, sfxSkip } from "@/lib/sfx";
import { flyCoinsFrom } from "@/lib/coinFly";
import { RiffsIcon } from "@/components/RiffsIcon";
import { METRIC_CHANGE_EVENT, awardXp } from "@/lib/metrics";

// Daily wheel — 3x3 grid, 8 perimeter reward cells, center cell is
// the SPIN button. Once per UTC day; server picks the cell so the
// client can't fish for the jackpot. The client just animates the
// highlight cycling around the perimeter, slowing down to land on
// the server-chosen cell.
//
// Cell layout matches the SQL:
//   0 [ 5  ]  1 [ 10 ]  2 [ 25 ]
//   3 [hint]  4 [SPIN]  5 [ 50 ]
//   6 [frz ]  7 [ 15 ]  8 [100 ]

type CellId = 0 | 1 | 2 | 3 | 5 | 6 | 7 | 8;

type CellDef = {
  id: CellId;
  label: string;
  emoji: string;
  riffs?: number;
  bonus?: "hint" | "freeze";
};

const CELLS: CellDef[] = [
  { id: 0, emoji: "💰", label: "5", riffs: 5 },
  { id: 1, emoji: "💰", label: "10", riffs: 10 },
  { id: 2, emoji: "💰", label: "25", riffs: 25 },
  { id: 3, emoji: "💡", label: "Hint", bonus: "hint" },
  // 4 is the center SPIN cell, handled separately
  { id: 5, emoji: "💎", label: "50", riffs: 50 },
  { id: 6, emoji: "❄️", label: "Freeze", bonus: "freeze" },
  { id: 7, emoji: "💰", label: "15", riffs: 15 },
  { id: 8, emoji: "👑", label: "100", riffs: 100 },
];

// Highlight visits this order while spinning. Center (4) is skipped.
const PERIMETER: CellId[] = [0, 1, 2, 5, 8, 7, 6, 3];

type SpinResult = {
  ok: boolean;
  reason?: string;
  cell?: CellId;
  riffs?: number;
  hint_kind?: string;
  freeze_added?: boolean;
};

export function DailyWheel() {
  const { user, refreshProfile, refreshStreak } = useAuth();
  const [spinState, setSpinState] = useState<
    "idle" | "spinning" | "landed" | "already-spun"
  >("idle");
  const [highlight, setHighlight] = useState<CellId | null>(null);
  const [landed, setLanded] = useState<CellId | null>(null);
  const [resultLabel, setResultLabel] = useState<string | null>(null);
  const wheelRef = useRef<HTMLDivElement | null>(null);

  // Check if today's spin has already been used. The same daily_claims
  // ledger powers this — read once on mount.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase.rpc("get_today_claims");
      if (cancelled) return;
      const keys = (data as string[]) ?? [];
      if (keys.includes("daily_wheel")) {
        setSpinState("already-spun");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  async function spin() {
    if (spinState !== "idle" || !user) return;
    setSpinState("spinning");
    setLanded(null);
    setResultLabel(null);

    const supabase = createClient();
    const { data, error } = await supabase.rpc("spin_daily_wheel");
    if (error) {
      console.warn("spin_daily_wheel error:", error.message);
      setSpinState("idle");
      return;
    }
    const result = data as SpinResult;
    if (!result.ok || result.cell == null) {
      setSpinState("already-spun");
      return;
    }

    // Animate highlight cycling around the perimeter, then land
    // on the server-chosen cell. ~3s total: 2s of cycling + 1s
    // of slowdown.
    const target = result.cell;
    const targetIdx = PERIMETER.indexOf(target);
    // 3 full cycles + offset to target = lots of suspense
    const totalSteps = PERIMETER.length * 3 + targetIdx;
    let step = 0;

    function tick() {
      const cell = PERIMETER[step % PERIMETER.length];
      setHighlight(cell);
      sfxSkip();
      step++;
      if (step > totalSteps) {
        // Landed.
        setHighlight(null);
        setLanded(target);
        setSpinState("landed");
        const label = labelFor(result);
        setResultLabel(label);
        sfxClaim();

        // Coin-fly for Riffs prizes.
        if (result.riffs && result.riffs > 0) {
          // Aim from the wheel's bounding box so the coins fly out
          // of the grid into the balance.
          flyCoinsFrom(wheelRef.current, result.riffs);
        }

        // 5 XP for spinning the wheel — small, but rewards the
        // daily-login behavior.
        awardXp(5);
        refreshProfile();
        refreshStreak();
        // Tell the challenges UI a metric event happened (so the
        // already-claimed flag updates without a manual refetch).
        window.dispatchEvent(new Event(METRIC_CHANGE_EVENT));
        return;
      }
      // Easing curve: fast for first 60% of steps, then slow.
      const progress = step / totalSteps;
      let delay: number;
      if (progress < 0.55) delay = 70;
      else if (progress < 0.8) delay = 110;
      else if (progress < 0.95) delay = 200;
      else delay = 360;
      window.setTimeout(tick, delay);
    }
    tick();
  }

  return (
    <div className="rounded-2xl border-2 border-amber-700 bg-gradient-to-b from-stone-900 via-stone-950 to-stone-900 p-4 shadow-[inset_0_1px_0_0_rgba(255,200,80,0.15),0_2px_0_0_rgba(0,0,0,0.4)]">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.25em] text-amber-300">
            Daily spin
          </div>
          <div className="text-sm font-black uppercase tracking-tight text-amber-50">
            {spinState === "already-spun"
              ? "Come back tomorrow"
              : "Tap the center to spin"}
          </div>
        </div>
        {resultLabel && spinState === "landed" && (
          <div className="rounded-full border-2 border-stone-900 bg-gradient-to-b from-emerald-300 to-emerald-500 px-3 py-1 text-xs font-black text-stone-900 shadow-[0_2px_0_0_rgba(0,0,0,0.6)]">
            {resultLabel}
          </div>
        )}
      </div>

      {/* 3×3 grid */}
      <div ref={wheelRef} className="grid grid-cols-3 gap-1.5">
        {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((idx) => {
          if (idx === 4) {
            // Center = SPIN button (or sparkles when locked / landed)
            const isLocked = spinState === "already-spun";
            const isLanded = spinState === "landed";
            return (
              <button
                key={idx}
                type="button"
                onClick={spin}
                disabled={spinState !== "idle"}
                aria-label="Spin the daily wheel"
                className={`flex aspect-square items-center justify-center rounded-xl border-2 border-stone-900 text-center font-black uppercase tracking-wider shadow-[0_3px_0_0_rgba(0,0,0,0.7),inset_0_1px_0_0_rgba(255,255,255,0.4)] transition disabled:cursor-not-allowed ${
                  spinState === "spinning"
                    ? "bg-gradient-to-b from-amber-200 to-amber-500 text-stone-900"
                    : isLanded
                      ? "bg-gradient-to-b from-emerald-300 to-emerald-500 text-stone-900"
                      : isLocked
                        ? "bg-gradient-to-b from-stone-700 to-stone-900 text-stone-500"
                        : "animate-pulse-soft bg-gradient-to-b from-amber-300 to-amber-600 text-stone-900 hover:from-amber-200 hover:to-amber-500 active:translate-y-0.5"
                }`}
              >
                {spinState === "spinning" ? (
                  <span className="text-xs">…</span>
                ) : isLanded ? (
                  <span className="text-lg">🎉</span>
                ) : isLocked ? (
                  <span className="text-[10px]">Locked</span>
                ) : (
                  <span className="flex flex-col items-center gap-0.5">
                    <Sparkles className="h-5 w-5" />
                    <span className="text-[10px]">Spin</span>
                  </span>
                )}
              </button>
            );
          }
          const def = CELLS.find((c) => c.id === idx);
          if (!def) return null;
          const isHighlight = highlight === idx;
          const isLanded = landed === idx;
          return (
            <div
              key={idx}
              className={`relative flex aspect-square flex-col items-center justify-center gap-0.5 overflow-hidden rounded-xl border-2 text-center font-black shadow-[0_2px_0_0_rgba(0,0,0,0.5),inset_0_1px_0_0_rgba(255,255,255,0.4)] transition ${
                isLanded
                  ? "scale-105 border-emerald-400 bg-gradient-to-br from-emerald-200 via-emerald-300 to-emerald-500 text-stone-900 ring-4 ring-emerald-300/60"
                  : isHighlight
                    ? "scale-105 border-amber-300 bg-gradient-to-br from-amber-100 via-amber-300 to-amber-500 text-stone-900 ring-2 ring-amber-200/60"
                    : "border-amber-700/50 bg-gradient-to-br from-stone-800 to-stone-900 text-amber-100"
              }`}
            >
              <span className="text-xl leading-none">{def.emoji}</span>
              <span className="flex items-center gap-0.5 text-[10px]">
                {def.riffs != null ? (
                  <>
                    <span>+{def.label}</span>
                    <RiffsIcon size={10} />
                  </>
                ) : (
                  <span className="uppercase tracking-wider">{def.label}</span>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function labelFor(result: SpinResult): string {
  if (result.riffs && result.riffs > 0) return `+${result.riffs} Riffs`;
  if (result.hint_kind) return "+1 free hint";
  if (result.freeze_added) return "+1 streak freeze";
  return "Reward claimed";
}
