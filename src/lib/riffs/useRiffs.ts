"use client";

import { useCallback, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { createClient } from "@/lib/supabase/client";
import { useAnalytics } from "@/lib/analytics/AnalyticsProvider";
import { EVENTS } from "@/lib/analytics/events";
import { sfxClaim, sfxSpend } from "@/lib/sfx";

export type SpendResult =
  | { ok: true; newBalance: number }
  | { ok: false; reason: "insufficient" | "auth" | "unknown"; message?: string };

export function useRiffs() {
  const { profile, refreshProfile, user } = useAuth();
  const { track } = useAnalytics();
  const [spending, setSpending] = useState(false);

  const balance = profile?.coin_balance ?? 0;

  const spend = useCallback(
    async (amount: number, reason: string, ref?: string): Promise<SpendResult> => {
      if (!user) return { ok: false, reason: "auth" };
      if (balance < amount) return { ok: false, reason: "insufficient" };

      setSpending(true);
      try {
        const supabase = createClient();
        const { data, error } = await supabase.rpc("spend_coins", {
          p_amount: amount,
          p_reason: reason,
          p_ref: ref ?? null,
        });
        if (error) {
          return {
            ok: false,
            reason: error.message.includes("Insufficient") ? "insufficient" : "unknown",
            message: error.message,
          };
        }
        await refreshProfile();
        track(EVENTS.HINT_PURCHASED, { amount, reason, ref });
        sfxSpend();
        return { ok: true, newBalance: data as number };
      } finally {
        setSpending(false);
      }
    },
    [user, balance, refreshProfile, track],
  );

  const claimAdReward = useCallback(
    async (amount = 25): Promise<SpendResult> => {
      if (!user) return { ok: false, reason: "auth" };
      setSpending(true);
      try {
        const supabase = createClient();
        const { data, error } = await supabase.rpc("claim_ad_reward", {
          p_amount: amount,
        });
        if (error) {
          return { ok: false, reason: "unknown", message: error.message };
        }
        await refreshProfile();
        track(EVENTS.RIFFS_EARNED_AD, { amount });
        sfxClaim();
        return { ok: true, newBalance: data as number };
      } finally {
        setSpending(false);
      }
    },
    [user, refreshProfile, track],
  );

  return { balance, spend, claimAdReward, spending, ready: !!profile };
}
