"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { createClient } from "@/lib/supabase/client";
import { sfxClaim } from "@/lib/sfx";
import { RiffsIcon } from "@/components/RiffsIcon";

const RESTORE_COST = 100;

// Banner shown on /daily when the user's streak just broke and they
// have a recoverable pre-break streak (>=3, within 48h). Pays in Riffs,
// not real money — keeps this on the right side of dark-pattern lines.
// Once-per-break: server clears pre_break_streak on success, so this
// component naturally vanishes.
export function StreakRestoreOffer() {
  const { streak, profile, refreshProfile, refreshStreak } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!streak) return null;
  const lost = streak.pre_break_streak;
  if (lost < 3) return null;
  if (!streak.broken_at) return null;
  const brokenAt = new Date(streak.broken_at).getTime();
  if (Date.now() - brokenAt > 48 * 3_600_000) return null;
  if (streak.current_streak >= lost) return null;

  const balance = profile?.coin_balance ?? 0;
  const canAfford = balance >= RESTORE_COST;

  async function handleRestore() {
    setBusy(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data, error: rpcErr } = await supabase.rpc("restore_streak_with_riffs", {
        p_cost: RESTORE_COST,
      });
      if (rpcErr) {
        setError(rpcErr.message);
        return;
      }
      const result = data as { ok?: boolean; reason?: string } | null;
      if (!result?.ok) {
        setError(result?.reason === "not_eligible" ? "No longer eligible" : "Restore failed");
        return;
      }
      sfxClaim();
      await Promise.all([refreshProfile(), refreshStreak()]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex w-full max-w-md flex-col items-center gap-3 rounded-2xl border-4 border-stone-900 bg-gradient-to-b from-amber-400 to-amber-500 px-5 py-4 text-stone-900 shadow-[0_4px_0_0_rgba(0,0,0,0.9)]">
      <div className="text-center">
        <div className="text-2xl">🔥</div>
        <div className="text-base font-black uppercase tracking-wider">
          Your {lost}-day streak broke
        </div>
        <div className="text-xs font-bold opacity-80">
          Restore it before it&rsquo;s gone for good
        </div>
      </div>
      <button
        type="button"
        disabled={!canAfford || busy}
        onClick={handleRestore}
        className="relative flex w-full items-center justify-center gap-2 rounded-full border-4 border-stone-900 bg-stone-900 px-5 py-2 text-sm font-black uppercase tracking-wider text-amber-300 shadow-[0_3px_0_0_rgba(0,0,0,0.7)] transition active:translate-y-1 active:shadow-[0_1px_0_0_rgba(0,0,0,0.7)] disabled:opacity-50"
      >
        <span className="absolute -right-1 -top-1 inline-flex h-5 w-5 items-center justify-center rounded-full border-2 border-stone-900 bg-stone-50 shadow-[0_2px_0_0_rgba(0,0,0,0.9)]">
          <RiffsIcon size={12} />
        </span>
        {busy ? "Restoring…" : `Restore — ${RESTORE_COST} Riffs`}
      </button>
      {!canAfford && (
        <div className="text-xs font-bold uppercase tracking-wider opacity-70">
          Not enough Riffs ({balance}/{RESTORE_COST})
        </div>
      )}
      {error && (
        <div className="text-xs font-bold uppercase tracking-wider text-red-700">
          {error}
        </div>
      )}
    </div>
  );
}
