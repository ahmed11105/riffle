"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth/AuthProvider";
import { createClient } from "@/lib/supabase/client";

type ActiveEvent = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  accent_color: string;
  icon: string;
  starts_at: string;
  ends_at: string;
  milestone_thresholds: { score: number; riffs: number }[];
  badge_label: string | null;
};

type Entry = { score: number; milestone_claims: number[] };

function formatTimeLeft(endIso: string): string {
  const end = new Date(endIso).getTime();
  const ms = end - Date.now();
  if (ms <= 0) return "Ending…";
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  if (d >= 1) return `${d}d ${h}h left`;
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return `${h}h ${m}m left`;
}

// Active-event takeover card on the home page. Shows the event icon
// + name, time-left countdown, the player's current score, and the
// next milestone progress bar (goal-gradient front-loading). Hidden
// when no event is active.
export function ActiveEventBanner() {
  const { user } = useAuth();
  const [event, setEvent] = useState<ActiveEvent | null>(null);
  const [entry, setEntry] = useState<Entry | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    (async () => {
      const { data } = await supabase.rpc("get_active_event");
      if (cancelled) return;
      const row = (data as ActiveEvent[] | null)?.[0] ?? null;
      setEvent(row);
      if (row && user) {
        const { data: entryData } = await supabase
          .from("event_entries")
          .select("score, milestone_claims")
          .eq("event_id", row.id)
          .eq("user_id", user.id)
          .maybeSingle();
        if (!cancelled) setEntry(entryData ?? { score: 0, milestone_claims: [] });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Re-render every minute so the time-left counter ticks down.
  useEffect(() => {
    if (!event) return;
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, [event]);

  if (!event) return null;

  const score = entry?.score ?? 0;
  const milestones = event.milestone_thresholds ?? [];
  const nextMilestone = milestones.find(
    (_, i) => !(entry?.milestone_claims ?? []).includes(i) && score < milestones[i].score,
  );
  const claimableMilestoneIdx = milestones.findIndex(
    (m, i) => score >= m.score && !(entry?.milestone_claims ?? []).includes(i),
  );

  const nextThreshold = nextMilestone?.score ?? milestones[milestones.length - 1]?.score ?? 100;
  const progressPct = Math.min(100, Math.round((score / nextThreshold) * 100));

  return (
    <Link
      href={`/events/${event.slug}`}
      className="group mt-6 block w-full overflow-hidden rounded-3xl border-4 border-stone-900 shadow-[0_6px_0_0_rgba(0,0,0,0.9)] transition active:translate-y-0.5 active:shadow-[0_2px_0_0_rgba(0,0,0,0.9)]"
      style={{
        background: `linear-gradient(135deg, ${event.accent_color}, #292524)`,
      }}
      aria-hidden={tick === undefined ? false : false}
    >
      <div className="flex items-start justify-between gap-3 p-5">
        <div className="flex-1">
          <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-amber-200/80">
            <span>Live event</span>
            <span>·</span>
            <span>{formatTimeLeft(event.ends_at)}</span>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-3xl">{event.icon}</span>
            <h3 className="text-2xl font-black uppercase tracking-tight text-amber-50">
              {event.name}
            </h3>
          </div>
          {event.description && (
            <p className="mt-1 text-xs font-bold text-amber-100/70">{event.description}</p>
          )}
        </div>
        <div className="text-right">
          <div className="text-[10px] font-black uppercase tracking-wider text-amber-200/60">
            Your score
          </div>
          <div className="text-3xl font-black text-amber-200">{score}</div>
        </div>
      </div>
      <div className="border-t-2 border-stone-900 bg-stone-900/60 px-5 py-3">
        <div className="mb-1.5 flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-amber-100/70">
          <span>
            {claimableMilestoneIdx >= 0
              ? `🎁 Milestone ready — claim ${milestones[claimableMilestoneIdx].riffs} Riffs`
              : nextMilestone
                ? `Next milestone: ${nextThreshold} pts → ${nextMilestone.riffs} Riffs`
                : "All milestones claimed"}
          </span>
          <span>{Math.min(score, nextThreshold)}/{nextThreshold}</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full border-2 border-stone-900 bg-stone-900">
          <div
            className="h-full bg-amber-400 transition-[width] duration-500"
            style={{ width: `${Math.max(8, progressPct)}%` }}
          />
        </div>
      </div>
    </Link>
  );
}
