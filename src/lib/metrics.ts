"use client";

import { createClient } from "@/lib/supabase/client";

// Client-side metric incrementer. Fire-and-forget — game events
// shouldn't block on the round trip.
//
// recordEvent bumps a date-scoped key under the hood
// (`<key>:<today_utc>`) so daily counters reset at midnight without
// any server-side cleanup. The challenges UI reads the same scoped
// key when computing progress.
//
// For Phase 2 we'll add weekly + lifetime scopes here so a single
// recordEvent call increments all three buckets at once.

export const METRIC_CHANGE_EVENT = "riffle:metric-change";

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export function dailyMetricKey(metric: string, dateStr?: string): string {
  return `${metric}:${dateStr ?? todayUtc()}`;
}

export function recordEvent(metric: string, amount = 1) {
  if (typeof window === "undefined") return;
  const supabase = createClient();
  supabase
    .rpc("bump_metric", { p_key: dailyMetricKey(metric), p_amount: amount })
    .then(({ error }) => {
      if (error) {
        console.warn("bump_metric failed:", error.message, "metric:", metric);
        return;
      }
      window.dispatchEvent(new Event(METRIC_CHANGE_EVENT));
    });
}

// XP grant. Server returns whether one or more levels were crossed
// + the cumulative Riffs reward; we surface that as a level-up
// event so the UI can fire a celebration toast + flying-coin
// animation.
export const LEVEL_UP_EVENT = "riffle:level-up";

// Anyone can dispatch this when a server write may have changed
// fields on the caller's profile (xp / level / balance / inventory
// / login_* / etc.). AuthProvider listens and refetches.
export const PROFILE_REFRESH_EVENT = "riffle:profile-refresh";

// Fired immediately when awardXp is called (optimistic). Carries the
// amount + a human-readable source label so the HomeStats XP bar can
// flash a transient "+N XP from <source>" chip. Decoupled from
// PROFILE_REFRESH_EVENT so the chip shows the granular source even
// when the bar update is debounced/refetched.
export const XP_GAINED_EVENT = "riffle:xp-gained";

export type XpGainedDetail = {
  amount: number;
  source: string;
};

export function requestProfileRefresh() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(PROFILE_REFRESH_EVENT));
}

export type LevelUpDetail = {
  // Level reached after this grant.
  level: number;
  // Sum of per-level rewards across the levels gained.
  reward_riffs: number;
  // 1 for a normal level-up; >1 when an XP grant crossed multiple
  // thresholds (rare — the toast renders "Lv prev → Lv new" in that
  // case so the player sees how much they jumped).
  levels_gained: number;
};

export function awardXp(amount: number, source = "Action") {
  if (typeof window === "undefined") return;
  if (amount <= 0) return;
  // Optimistic source flash. Fires before the round-trip so the
  // player sees feedback the instant they act, not after the server
  // resolves. If the RPC errors below, the bar simply doesn't update
  // — the chip is purely informational and short-lived (~1.5s).
  window.dispatchEvent(
    new CustomEvent<XpGainedDetail>(XP_GAINED_EVENT, {
      detail: { amount, source },
    }),
  );
  const supabase = createClient();
  supabase.rpc("add_xp", { p_amount: amount }).then(({ data, error }) => {
    if (error) {
      console.warn("add_xp failed:", error.message);
      return;
    }
    const result = data as
      | (LevelUpDetail & { xp: number; new_balance?: number })
      | null;
    if (!result) return;
    if (result.levels_gained > 0) {
      window.dispatchEvent(
        new CustomEvent<LevelUpDetail>(LEVEL_UP_EVENT, {
          detail: {
            level: result.level,
            reward_riffs: result.reward_riffs,
            levels_gained: result.levels_gained,
          },
        }),
      );
    }
    // xp / level / balance all may have changed — push a profile
    // refetch so the chrome (HomeStats XP bar, Riffs balance pill)
    // reflects the new server state. Without this the UI stays at
    // stale local memory until the next route navigation.
    requestProfileRefresh();
  });
}
