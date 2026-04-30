"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useRiffs } from "@/lib/riffs/useRiffs";

const REWARD = 10;
const AD_SECONDS = 15;
const STORAGE_KEY = "riffle:bonus_round_done";

function dayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

// Post-daily session-end hook. After the player solves (or fails)
// today's puzzle, offer a "watch ad → +10 Riffs" bonus. Pro users
// don't see it (they already get the no-ads perk). Once-per-day
// gate via localStorage; server enforces 5/day cap on claim_ad_reward.
// When real AdSense rewarded video lands this component swaps to it.
export function BonusRoundPrompt() {
  const { isPro, isAnonymous, loading } = useAuth();
  const { claimAdReward } = useRiffs();
  const [done, setDone] = useState(false);
  const [state, setState] = useState<"idle" | "watching" | "claimed" | "limit">("idle");
  const [seconds, setSeconds] = useState(AD_SECONDS);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const last = localStorage.getItem(STORAGE_KEY);
      if (last === dayKey()) setDone(true);
    } catch {}
  }, []);

  useEffect(() => {
    if (state !== "watching") return;
    if (seconds <= 0) {
      (async () => {
        const result = await claimAdReward(REWARD);
        if (result.ok) {
          setState("claimed");
          try {
            localStorage.setItem(STORAGE_KEY, dayKey());
          } catch {}
        } else if (result.message?.includes("Daily ad limit")) {
          setState("limit");
        } else {
          setState("idle");
        }
      })();
      return;
    }
    const id = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [state, seconds, claimAdReward]);

  if (loading) return null;
  if (isPro || isAnonymous) return null;
  if (done) return null;
  if (state === "claimed") {
    return (
      <div className="w-full max-w-md rounded-2xl border-4 border-emerald-700 bg-emerald-100 p-4 text-center text-emerald-900 shadow-[0_4px_0_0_rgba(0,0,0,0.9)]">
        <p className="text-sm font-black uppercase tracking-wider">
          +{REWARD} Riffs added 🎁
        </p>
        <p className="mt-1 text-xs font-bold opacity-80">
          Come back tomorrow for another bonus.
        </p>
      </div>
    );
  }
  if (state === "limit") {
    return (
      <div className="w-full max-w-md rounded-2xl border-4 border-stone-900 bg-stone-100 p-4 text-center text-stone-700 shadow-[0_4px_0_0_rgba(0,0,0,0.9)]">
        <p className="text-sm font-black uppercase tracking-wider">
          Daily ad limit reached
        </p>
        <p className="mt-1 text-xs font-bold">Try the bonus again tomorrow.</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md rounded-2xl border-4 border-stone-900 bg-stone-50 p-4 text-stone-900 shadow-[0_4px_0_0_rgba(0,0,0,0.9)]">
      <div className="flex items-start gap-3">
        <div className="rounded-xl border-2 border-stone-900 bg-amber-300 p-2">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-black uppercase tracking-wider">
            Bonus round
          </p>
          <p className="mt-0.5 text-xs font-bold text-stone-600">
            Watch a {AD_SECONDS}s ad — pocket{" "}
            <span className="text-amber-700">+{REWARD} Riffs</span>.
          </p>
        </div>
      </div>
      <button
        type="button"
        disabled={state === "watching"}
        onClick={() => setState("watching")}
        className="mt-3 w-full rounded-full border-4 border-stone-900 bg-amber-400 px-4 py-2 text-sm font-black uppercase tracking-wider text-stone-900 shadow-[0_3px_0_0_rgba(0,0,0,0.9)] transition active:translate-y-0.5 active:shadow-[0_1px_0_0_rgba(0,0,0,0.9)] disabled:opacity-60"
      >
        {state === "watching" ? `Watching… ${seconds}s` : `Watch & claim +${REWARD} Riffs`}
      </button>
    </div>
  );
}
