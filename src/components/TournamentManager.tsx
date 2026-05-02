"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Trophy, X } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { createClient } from "@/lib/supabase/client";
import { sfxClaim } from "@/lib/sfx";
import { flyCoinsFrom } from "@/lib/coinFly";
import { RiffsIcon } from "@/components/RiffsIcon";
import { IconModalShell, type OriginRect } from "@/components/IconModalShell";
import {
  OPEN_TOURNAMENT_EVENT,
  type OpenTournamentDetail,
} from "@/lib/tournament";
import {
  applyTournamentEntryOverlay,
  saveSim,
  useSimulation,
} from "@/lib/simulation";

type ActiveEvent = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  accent_color: string;
  icon: string;
  ends_at: string;
  milestone_thresholds: { score: number; riffs: number }[];
  badge_label: string | null;
};

type Entry = { score: number; milestone_claims: number[] };

function formatTimeLeft(endIso: string): string {
  const ms = new Date(endIso).getTime() - Date.now();
  if (ms <= 0) return "Ended";
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  if (d >= 1) return `${d}d ${h}h left`;
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return `${h}h ${m}m left`;
}

// Tournament modal manager. Listens for OPEN_TOURNAMENT_EVENT (fired
// by RibbonTournamentButton) and opens a dialog showing the active
// event's milestones with claim buttons. Keeps the dedicated
// /events/<slug> page for the full leaderboard view; the modal is the
// quick "what can I claim right now" surface.
//
// Visual chrome matches ChallengesManager: trophy medallion above a
// gold header strip, amber frame, animated entry from the icon. Use
// IconModalShell for the open animation so any future icon-triggered
// modal can drop in the same wrapper.
export function TournamentManager() {
  const { user, refreshProfile } = useAuth();
  const sim = useSimulation();
  const [open, setOpen] = useState(false);
  const [originRect, setOriginRect] = useState<OriginRect | null>(null);
  const [event, setEvent] = useState<ActiveEvent | null>(null);
  const [rawEntry, setRawEntry] = useState<Entry | null>(null);
  const [busyIdx, setBusyIdx] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, setTick] = useState(0);
  const entry = applyTournamentEntryOverlay(rawEntry, sim);

  // Fetch active event + the player's entry. Refetched whenever the
  // modal opens so the milestones are fresh after a recent claim.
  useEffect(() => {
    if (!open) return;
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
        if (!cancelled) setRawEntry(entryData ?? { score: 0, milestone_claims: [] });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, user]);

  useEffect(() => {
    function handle(e: Event) {
      const detail = (e as CustomEvent<OpenTournamentDetail>).detail;
      setOriginRect(detail?.originRect ?? null);
      setOpen(true);
      setError(null);
    }
    window.addEventListener(OPEN_TOURNAMENT_EVENT, handle);
    return () => window.removeEventListener(OPEN_TOURNAMENT_EVENT, handle);
  }, []);

  // Tick the time-left line once a minute while the modal is open.
  useEffect(() => {
    if (!open) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 60_000);
    return () => window.clearInterval(id);
  }, [open]);

  function handleClose() {
    setOpen(false);
  }

  async function claim(idx: number, sourceEl: HTMLElement | null) {
    if (!user || !event) return;
    setBusyIdx(idx);
    setError(null);
    try {
      const reward = event.milestone_thresholds[idx]?.riffs ?? 0;

      if (sim.active) {
        // Sim path: patch the overlay, no DB write.
        if (reward > 0) flyCoinsFrom(sourceEl, reward);
        sfxClaim();
        const prevEntry = entry ?? { score: 0, milestone_claims: [] };
        const next = {
          ...sim,
          tournament: {
            ...sim.tournament,
            milestone_claims: [...prevEntry.milestone_claims, idx],
          },
          profile: {
            ...sim.profile,
            coin_balance: (sim.profile.coin_balance ?? 0) + reward,
          },
        };
        saveSim(next);
        return;
      }

      const supabase = createClient();
      const { data, error: err } = await supabase.rpc("claim_event_milestone", {
        p_event_id: event.id,
        p_milestone_index: idx,
      });
      if (err) {
        setError(err.message);
        return;
      }
      const result = data as { ok?: boolean; reason?: string; riffs?: number } | null;
      if (!result?.ok) {
        setError(result?.reason ?? "Could not claim");
        return;
      }
      const earned = result.riffs ?? reward;
      if (earned > 0) flyCoinsFrom(sourceEl, earned);
      sfxClaim();
      setRawEntry((prev) =>
        prev ? { ...prev, milestone_claims: [...prev.milestone_claims, idx] } : prev,
      );
      await refreshProfile();
    } finally {
      setBusyIdx(null);
    }
  }

  const score = entry?.score ?? 0;
  const claimed = entry?.milestone_claims ?? [];

  return (
    <IconModalShell
      open={open}
      onClose={handleClose}
      originRect={originRect}
      ariaLabel="Tournament"
      contentClassName="relative w-full max-w-md pt-7"
    >
      {/* Trophy medallion — matches the Crown medallion on the
          challenges modal so the two icon-triggered modals feel like
          a family. */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 z-30 flex h-14 w-14 -translate-x-1/2 items-center justify-center rounded-full border-4 border-stone-900 bg-gradient-to-br from-amber-200 via-amber-400 to-amber-600 shadow-[0_4px_0_0_rgba(0,0,0,0.7),inset_0_2px_0_0_rgba(255,235,180,0.6)]"
      >
        <Trophy className="h-7 w-7 text-stone-900" strokeWidth={2.5} />
      </div>
      <div className="relative flex max-h-[90vh] w-full flex-col overflow-hidden rounded-3xl border-4 border-violet-500 bg-gradient-to-br from-violet-950 via-stone-900 to-violet-950 shadow-[0_8px_0_0_rgba(0,0,0,0.9),0_0_30px_rgba(167,139,250,0.3)]">
        {/* Violet header strip — the daily challenges use gold, so
            tournaments take a royal violet to read as a separate kind
            of event surface while keeping the gold trophy medallion
            as the unifying anchor. */}
        <div className="relative overflow-hidden border-b-4 border-stone-900 bg-gradient-to-b from-violet-400 via-violet-500 to-violet-700 px-5 pb-3 pt-7 text-center shadow-[inset_0_-4px_0_0_rgba(0,0,0,0.25),inset_0_2px_0_0_rgba(255,255,255,0.35)]">
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close tournament"
            className="absolute right-3 top-3 z-20 inline-flex h-7 w-7 items-center justify-center rounded-full border-2 border-stone-900 bg-stone-900/90 text-violet-200 shadow-[0_2px_0_0_rgba(0,0,0,0.6),inset_0_1px_0_0_rgba(196,181,253,0.2)] transition active:translate-y-0.5 active:shadow-[0_1px_0_0_rgba(0,0,0,0.6)] hover:bg-stone-800 hover:text-violet-100"
          >
            <X className="h-4 w-4" strokeWidth={3} aria-hidden />
          </button>
          <div className="text-[10px] font-black uppercase tracking-[0.4em] text-violet-950/80">
            Live event
          </div>
          <div className="mt-0.5 text-lg font-black uppercase tracking-tight text-stone-50 drop-shadow-[0_1px_0_rgba(0,0,0,0.4)]">
            {event ? event.name : "Tournament"}
          </div>
          {event && (
            <div className="mt-0.5 text-[10px] font-black uppercase tracking-widest text-stone-50/80">
              {formatTimeLeft(event.ends_at)}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {!event ? (
            <div className="rounded-2xl border-2 border-dashed border-violet-500/50 bg-gradient-to-br from-violet-900/30 via-stone-900 to-violet-900/30 p-8 text-center shadow-[inset_0_1px_0_0_rgba(196,181,253,0.15)]">
              <div className="text-4xl">🏆</div>
              <div className="mt-2 text-base font-black uppercase tracking-[0.2em] text-violet-200">
                No active event
              </div>
              <p className="mt-2 text-xs leading-relaxed text-violet-100/60">
                Tournaments rotate weekly. Check back soon for the next one.
              </p>
            </div>
          ) : (
            <>
              {/* Score card — sits at the top so the player sees their
                  current standing before scrolling milestones. The
                  inner icon stays gold so it harmonises with the gold
                  trophy medallion at the modal's crown. */}
              <div className="mb-3 rounded-2xl border-2 border-violet-700 bg-gradient-to-r from-stone-900 via-violet-950 to-stone-900 p-3 shadow-[0_2px_0_0_rgba(0,0,0,0.5),inset_0_1px_0_0_rgba(196,181,253,0.15)]">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-stone-900 bg-gradient-to-br from-amber-200 via-amber-300 to-amber-500 text-2xl shadow-[0_2px_0_0_rgba(0,0,0,0.5),inset_0_1px_0_0_rgba(255,255,255,0.5)]">
                      <span>{event.icon}</span>
                    </div>
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-wider text-violet-200/70">
                        Your score
                      </div>
                      <div className="text-2xl font-black text-violet-100 leading-none">
                        {score}
                      </div>
                    </div>
                  </div>
                  {event.description && (
                    <p className="max-w-[55%] text-right text-[11px] font-bold leading-tight text-violet-100/70">
                      {event.description}
                    </p>
                  )}
                </div>
              </div>

              {/* Milestones — same card-with-progress visual language as
                  the daily challenges so the two surfaces feel identical. */}
              <div className="flex flex-col gap-2.5">
                {event.milestone_thresholds.map((m, idx) => {
                  const reached = score >= m.score;
                  const isClaimed = claimed.includes(idx);
                  const ready = reached && !isClaimed;
                  const busy = busyIdx === idx;
                  const ratio = Math.min(1, score / Math.max(1, m.score));

                  const cardClass = isClaimed
                    ? "border-emerald-700 bg-gradient-to-r from-emerald-100 via-emerald-200 to-emerald-100 text-emerald-900 shadow-[0_2px_0_0_rgba(0,0,0,0.4),inset_0_1px_0_0_rgba(255,255,255,0.4)]"
                    : ready
                      ? "border-violet-700 bg-gradient-to-r from-violet-200 via-violet-300 to-violet-400 text-stone-900 shadow-[0_3px_0_0_rgba(0,0,0,0.6),inset_0_1px_0_0_rgba(255,255,255,0.5)] ring-2 ring-violet-300/50"
                      : "border-violet-200/30 bg-gradient-to-r from-violet-50 via-stone-50 to-violet-50 text-stone-800 shadow-[0_2px_0_0_rgba(0,0,0,0.4)]";

                  return (
                    <div
                      key={idx}
                      className={`relative overflow-hidden rounded-2xl border-2 p-3 transition ${cardClass}`}
                    >
                      {ready && (
                        <span
                          aria-hidden
                          className="pointer-events-none absolute inset-0 -translate-x-full animate-[shine_2.5s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/40 to-transparent"
                        />
                      )}
                      <div className="relative flex items-center gap-3">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-stone-900 bg-gradient-to-br from-violet-200 via-violet-300 to-violet-500 text-2xl shadow-[0_2px_0_0_rgba(0,0,0,0.5),inset_0_1px_0_0_rgba(255,255,255,0.5)]">
                          {isClaimed ? "✓" : `🏅`}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-black leading-tight">
                            Milestone {idx + 1} · {m.score} pts
                          </div>
                          <div className="mt-1.5 flex items-center gap-2">
                            <div className="h-2.5 flex-1 overflow-hidden rounded-full border-2 border-stone-900 bg-stone-200/80 shadow-[inset_0_1px_0_0_rgba(0,0,0,0.2)]">
                              <div
                                className="h-full bg-gradient-to-r from-emerald-400 via-violet-500 to-violet-400 transition-[width] duration-500"
                                style={{ width: `${Math.max(ratio * 100, 4)}%` }}
                              />
                            </div>
                            <span className="font-mono text-[11px] font-bold tabular-nums">
                              {Math.min(score, m.score)}/{m.score}
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => claim(idx, e.currentTarget)}
                          disabled={!ready || isClaimed || busy || !user}
                          aria-label={
                            isClaimed
                              ? "Already claimed"
                              : ready
                                ? `Claim ${m.riffs} Riffs`
                                : `${m.riffs} Riffs available at ${m.score} points`
                          }
                          className={`flex min-w-[68px] items-center justify-center gap-1 rounded-full border-2 border-stone-900 px-3 py-1 text-xs font-black shadow-[0_2px_0_0_rgba(0,0,0,0.7),inset_0_1px_0_0_rgba(255,255,255,0.5)] transition disabled:cursor-not-allowed ${
                            isClaimed
                              ? "bg-gradient-to-b from-emerald-200 to-emerald-400 text-emerald-900"
                              : ready
                                ? "animate-pulse-soft bg-gradient-to-b from-violet-300 to-violet-500 text-stone-900 hover:from-violet-200 hover:to-violet-400 active:translate-y-0.5"
                                : "bg-gradient-to-b from-stone-300 to-stone-400 text-stone-600 opacity-70"
                          }`}
                        >
                          {isClaimed ? (
                            <span>✓</span>
                          ) : busy ? (
                            <span>…</span>
                          ) : (
                            <>
                              <span>+{m.riffs}</span>
                              <RiffsIcon size={12} />
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {error && (
                <p className="mt-3 text-sm font-bold text-rose-300">{error}</p>
              )}

              <div className="mt-4 flex items-center justify-between gap-2">
                <Link
                  href={`/events/${event.slug}`}
                  onClick={handleClose}
                  className="text-[11px] font-black uppercase tracking-wider text-violet-300 underline-offset-2 hover:underline"
                >
                  Full leaderboard →
                </Link>
                <Link
                  href="/daily"
                  onClick={handleClose}
                  className="rounded-full border-2 border-stone-900 bg-gradient-to-b from-violet-300 to-violet-500 px-4 py-1.5 text-[11px] font-black uppercase tracking-wider text-stone-900 shadow-[0_2px_0_0_rgba(0,0,0,0.9)]"
                >
                  Earn points
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </IconModalShell>
  );
}
