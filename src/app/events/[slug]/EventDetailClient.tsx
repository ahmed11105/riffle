"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth/AuthProvider";
import { createClient } from "@/lib/supabase/client";
import { sfxClaim } from "@/lib/sfx";

type EventRow = {
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

type LeaderboardRow = {
  user_id: string;
  score: number;
  display_name: string;
  tag: number | null;
};

function formatTimeLeft(endIso: string): string {
  const end = new Date(endIso).getTime();
  const ms = end - Date.now();
  if (ms <= 0) return "Ended";
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  if (d >= 1) return `${d}d ${h}h left`;
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return `${h}h ${m}m left`;
}

export function EventDetailClient({
  event,
  leaderboard,
}: {
  event: EventRow;
  leaderboard: LeaderboardRow[];
}) {
  const { user, refreshProfile } = useAuth();
  const [score, setScore] = useState(0);
  const [claims, setClaims] = useState<number[]>([]);
  const [busyIdx, setBusyIdx] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("event_entries")
        .select("score, milestone_claims")
        .eq("event_id", event.id)
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      if (data) {
        setScore(data.score ?? 0);
        setClaims(data.milestone_claims ?? []);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, event.id]);

  async function claim(idx: number) {
    if (!user) return;
    setBusyIdx(idx);
    setError(null);
    try {
      const supabase = createClient();
      const { data, error: err } = await supabase.rpc("claim_event_milestone", {
        p_event_id: event.id,
        p_milestone_index: idx,
      });
      if (err) {
        setError(err.message);
        return;
      }
      const result = data as { ok?: boolean; reason?: string } | null;
      if (!result?.ok) {
        setError(result?.reason ?? "Could not claim");
        return;
      }
      setClaims((prev) => [...prev, idx]);
      sfxClaim();
      await refreshProfile();
    } finally {
      setBusyIdx(null);
    }
  }

  return (
    <div className="mt-6 flex w-full max-w-3xl flex-col gap-8">
      <div
        className="rounded-3xl border-4 border-stone-900 p-6 text-amber-50 shadow-[0_8px_0_0_rgba(0,0,0,0.9)]"
        style={{ background: `linear-gradient(135deg, ${event.accent_color}, #292524)` }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[11px] font-black uppercase tracking-widest text-amber-200/80">
              Live event · {formatTimeLeft(event.ends_at)}
            </div>
            <h1 className="mt-1 flex items-center gap-3 text-4xl font-black uppercase tracking-tight">
              <span>{event.icon}</span>
              {event.name}
            </h1>
            {event.description && (
              <p className="mt-2 text-sm font-bold text-amber-100/80">{event.description}</p>
            )}
          </div>
          <div className="text-right">
            <div className="text-[10px] font-black uppercase tracking-wider text-amber-200/60">
              Your score
            </div>
            <div className="text-5xl font-black text-amber-200">{score}</div>
          </div>
        </div>
        <div className="mt-4 text-xs font-bold text-amber-100/70">
          Score points by solving today&rsquo;s Riffle. Faster solves = more points.
        </div>
      </div>

      <section>
        <h2 className="text-2xl font-black text-amber-100">Milestones</h2>
        <p className="mt-1 text-sm text-amber-100/60">
          Hit each score to claim Riffs. Free for everyone.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {event.milestone_thresholds.map((m, idx) => {
            const reached = score >= m.score;
            const claimed = claims.includes(idx);
            const busy = busyIdx === idx;
            return (
              <div
                key={idx}
                className={`relative overflow-hidden rounded-2xl border-4 border-stone-900 p-4 shadow-[0_4px_0_0_rgba(0,0,0,0.9)] ${
                  claimed
                    ? "bg-emerald-200 text-emerald-900"
                    : reached
                      ? "bg-amber-400 text-stone-900"
                      : "bg-stone-50 text-stone-900"
                }`}
              >
                <div className="text-xs font-black uppercase tracking-wider opacity-70">
                  Milestone {idx + 1}
                </div>
                <div className="mt-1 text-3xl font-black">{m.score} pts</div>
                <div className="text-base font-bold">+{m.riffs} Riffs</div>
                <button
                  type="button"
                  onClick={() => claim(idx)}
                  disabled={!reached || claimed || busy || !user}
                  className="mt-3 w-full rounded-full border-4 border-stone-900 bg-stone-900 px-4 py-2 text-xs font-black uppercase tracking-wider text-amber-300 disabled:opacity-50"
                >
                  {claimed ? "Claimed ✓" : busy ? "Claiming…" : reached ? "Claim" : "Locked"}
                </button>
              </div>
            );
          })}
        </div>
        {error && (
          <p className="mt-3 text-sm font-bold text-rose-300">{error}</p>
        )}
      </section>

      <section>
        <h2 className="text-2xl font-black text-amber-100">Leaderboard</h2>
        <p className="mt-1 text-sm text-amber-100/60">Top 50 by score.</p>
        {leaderboard.length === 0 ? (
          <p className="mt-4 text-amber-100/60">Be the first to score.</p>
        ) : (
          <ol className="mt-4 divide-y-2 divide-stone-800 overflow-hidden rounded-2xl border-4 border-stone-900 bg-stone-900/50">
            {leaderboard.map((row, idx) => (
              <li
                key={row.user_id}
                className={`flex items-center justify-between px-4 py-2.5 text-sm font-bold ${
                  user && row.user_id === user.id
                    ? "bg-amber-400/20 text-amber-100"
                    : "text-amber-100/80"
                }`}
              >
                <span className="flex items-center gap-3">
                  <span className="w-6 text-right font-black text-amber-300">#{idx + 1}</span>
                  <span>
                    {row.display_name}
                    {row.tag !== null ? (
                      <span className="text-amber-100/40">#{String(row.tag).padStart(4, "0")}</span>
                    ) : null}
                  </span>
                </span>
                <span className="font-black text-amber-200">{row.score}</span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <Link
        href="/daily"
        className="self-start rounded-full border-4 border-stone-900 bg-amber-400 px-5 py-2.5 text-sm font-black uppercase tracking-wider text-stone-900 shadow-[0_3px_0_0_rgba(0,0,0,0.9)]"
      >
        Score points → Today&rsquo;s Riffle
      </Link>
    </div>
  );
}
