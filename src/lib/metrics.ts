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
