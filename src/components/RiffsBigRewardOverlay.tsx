"use client";

import { useEffect, useState } from "react";
import { RiffsIcon } from "@/components/RiffsIcon";
import {
  RIFFS_BIG_REWARD_EVENT,
  type RiffsBigRewardDetail,
} from "@/lib/riffsReward";
import { COINS_ARRIVED_EVENT } from "@/lib/coinFly";

// Big-reward celebration overlay. Mounted once globally; listens for
// RIFFS_BIG_REWARD_EVENT and runs a four-phase animation:
//   1. dim   — full-screen dim fades in (canvas-confetti renders at
//              z-100 by default, our dim sits at z-90 so the bursts
//              from RevealCard remain visible above the dim)
//   2. zoom  — icon + "× N" badge scales in from 0.4 → 1.05 with a
//              soft overshoot
//   3. hold  — sits centered, gentle pulse, ~700ms
//   4. fly   — icon translates + scales toward #riffs-balance-target
//              (the same anchor the coin-fly layer uses) and the
//              dim fades out in parallel
//
// On arrival we fire COINS_ARRIVED_EVENT so the balance pill pops
// the same way it does for coin-fly grants.

type Phase = "idle" | "zoom" | "hold" | "fly" | "done";

export function RiffsBigRewardOverlay() {
  const [amount, setAmount] = useState(0);
  const [phase, setPhase] = useState<Phase>("idle");
  // Translate offset in viewport pixels: icon center → balance pill
  // center. Computed when we transition into the fly phase so the
  // target rect is fresh (sticky header makes the pill move with the
  // viewport).
  const [flyOffset, setFlyOffset] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    function handle(e: Event) {
      const detail = (e as CustomEvent<RiffsBigRewardDetail>).detail;
      if (!detail || detail.amount <= 0) return;
      setAmount(detail.amount);
      setFlyOffset(null);
      setPhase("zoom");
    }
    window.addEventListener(RIFFS_BIG_REWARD_EVENT, handle);
    return () => window.removeEventListener(RIFFS_BIG_REWARD_EVENT, handle);
  }, []);

  useEffect(() => {
    if (phase === "zoom") {
      const t = window.setTimeout(() => setPhase("hold"), 480);
      return () => window.clearTimeout(t);
    }
    if (phase === "hold") {
      const t = window.setTimeout(() => {
        const target = document.getElementById("riffs-balance-target");
        if (target) {
          const r = target.getBoundingClientRect();
          const tx = r.left + r.width / 2;
          const ty = r.top + r.height / 2;
          const cx = window.innerWidth / 2;
          const cy = window.innerHeight / 2;
          setFlyOffset({ x: tx - cx, y: ty - cy });
        } else {
          setFlyOffset({ x: 0, y: -200 });
        }
        setPhase("fly");
      }, 750);
      return () => window.clearTimeout(t);
    }
    if (phase === "fly") {
      // Mirror the coin-fly arrival event so the pill pops + any
      // listeners that key off coin arrival run normally.
      const arrived = window.setTimeout(() => {
        window.dispatchEvent(
          new CustomEvent(COINS_ARRIVED_EVENT, { detail: { amount } }),
        );
      }, 540);
      const done = window.setTimeout(() => setPhase("done"), 720);
      return () => {
        window.clearTimeout(arrived);
        window.clearTimeout(done);
      };
    }
    if (phase === "done") {
      const t = window.setTimeout(() => {
        setPhase("idle");
        setAmount(0);
        setFlyOffset(null);
      }, 200);
      return () => window.clearTimeout(t);
    }
  }, [phase, amount]);

  if (phase === "idle") return null;

  const visible = phase === "zoom" || phase === "hold" || phase === "fly";
  const dimOpacity = phase === "fly" || phase === "done" ? 0 : 0.65;

  // Medallion transform per phase. Zoom + hold are identity-anchored;
  // fly translates by the captured offset and scales down toward the
  // pill size while fading.
  let medallionTransform = "translate3d(-50%, -50%, 0) scale(0.4)";
  let medallionOpacity = 0;
  if (phase === "zoom" || phase === "hold") {
    medallionTransform = "translate3d(-50%, -50%, 0) scale(1)";
    medallionOpacity = 1;
  }
  if (phase === "fly" && flyOffset) {
    medallionTransform = `translate3d(calc(-50% + ${flyOffset.x}px), calc(-50% + ${flyOffset.y}px), 0) scale(0.25)`;
    medallionOpacity = 0.4;
  }

  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-[90] bg-stone-950 transition-opacity duration-500 ease-out"
        style={{ opacity: dimOpacity }}
      />
      <div
        aria-hidden
        className="pointer-events-none fixed left-1/2 top-1/2 z-[95]"
        style={{
          transform: medallionTransform,
          opacity: medallionOpacity,
          willChange: "transform, opacity",
          transition:
            phase === "zoom"
              ? "transform 460ms cubic-bezier(0.16, 1, 0.3, 1), opacity 280ms cubic-bezier(0.16, 1, 0.3, 1)"
              : phase === "fly"
                ? "transform 700ms cubic-bezier(0.7, 0, 0.6, 1), opacity 700ms ease-in"
                : "transform 380ms cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        <div
          className={`flex items-center gap-3 rounded-full border-4 border-stone-900 bg-gradient-to-br from-amber-200 via-amber-400 to-amber-600 px-7 py-4 shadow-[0_8px_0_0_rgba(0,0,0,0.9),0_0_60px_rgba(251,191,36,0.55)] ${
            visible && phase !== "fly" ? "riffle-reward-pulse" : ""
          }`}
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-full border-4 border-stone-900 bg-stone-900 shadow-[inset_0_2px_0_0_rgba(255,200,80,0.3)]">
            <RiffsIcon size={36} />
          </div>
          <div className="flex flex-col items-start leading-none text-stone-900">
            <span className="text-[11px] font-black uppercase tracking-[0.3em] text-stone-900/70">
              Reward
            </span>
            <span className="mt-1 text-4xl font-black tracking-tight drop-shadow-[0_2px_0_rgba(255,235,180,0.7)]">
              ×{amount}
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
