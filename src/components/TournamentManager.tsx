"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { createClient } from "@/lib/supabase/client";
import { sfxClaim } from "@/lib/sfx";
import { flyCoinsFrom } from "@/lib/coinFly";
import { CloseButton } from "@/components/CloseButton";
import { RiffsIcon } from "@/components/RiffsIcon";
import { OPEN_TOURNAMENT_EVENT } from "@/lib/tournament";

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
export function TournamentManager() {
  const { user, refreshProfile } = useAuth();
  const [open, setOpen] = useState(false);
  const [event, setEvent] = useState<ActiveEvent | null>(null);
  const [entry, setEntry] = useState<Entry | null>(null);
  const [busyIdx, setBusyIdx] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

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
        if (!cancelled) setEntry(entryData ?? { score: 0, milestone_claims: [] });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, user]);

  useEffect(() => {
    function handle() {
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

  // Escape closes.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  async function claim(idx: number, sourceEl: HTMLElement | null) {
    if (!user || !event) return;
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
      const result = data as { ok?: boolean; reason?: string; riffs?: number } | null;
      if (!result?.ok) {
        setError(result?.reason ?? "Could not claim");
        return;
      }
      const reward = result.riffs ?? event.milestone_thresholds[idx]?.riffs ?? 0;
      if (reward > 0) flyCoinsFrom(sourceEl, reward);
      sfxClaim();
      setEntry((prev) =>
        prev ? { ...prev, milestone_claims: [...prev.milestone_claims, idx] } : prev,
      );
      await refreshProfile();
    } finally {
      setBusyIdx(null);
    }
  }

  if (!open) return null;
  if (!event) {
    return (
      <Backdrop onClose={() => setOpen(false)}>
        <Card onClose={() => setOpen(false)}>
          <p className="text-amber-100/70">No active event right now.</p>
        </Card>
      </Backdrop>
    );
  }

  const score = entry?.score ?? 0;
  const claimed = entry?.milestone_claims ?? [];

  return (
    <Backdrop onClose={() => setOpen(false)}>
      <Card onClose={() => setOpen(false)} accent={event.accent_color}>
        <div className="mb-4 flex items-start justify-between gap-3 pr-6">
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-amber-200/80">
              Live event · {formatTimeLeft(event.ends_at)}
              {tick === undefined ? null : ""}
            </div>
            <h2 className="mt-1 flex items-center gap-2 text-xl font-black uppercase tracking-tight text-amber-50">
              <span>{event.icon}</span>
              {event.name}
            </h2>
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

        <div className="grid gap-2 sm:grid-cols-2">
          {event.milestone_thresholds.map((m, idx) => {
            const reached = score >= m.score;
            const isClaimed = claimed.includes(idx);
            const busy = busyIdx === idx;
            return (
              <div
                key={idx}
                className={`relative overflow-hidden rounded-xl border-2 border-stone-900 p-3 shadow-[0_3px_0_0_rgba(0,0,0,0.9)] ${
                  isClaimed
                    ? "bg-emerald-200 text-emerald-900"
                    : reached
                      ? "bg-amber-400 text-stone-900"
                      : "bg-stone-50 text-stone-900"
                }`}
              >
                <div className="text-[10px] font-black uppercase tracking-wider opacity-70">
                  Milestone {idx + 1}
                </div>
                <div className="mt-0.5 text-xl font-black">{m.score} pts</div>
                <div className="text-sm font-bold flex items-center gap-1">
                  +{m.riffs}
                  <RiffsIcon size={14} />
                </div>
                <button
                  type="button"
                  onClick={(e) => claim(idx, e.currentTarget)}
                  disabled={!reached || isClaimed || busy || !user}
                  className="mt-2 w-full rounded-full border-2 border-stone-900 bg-stone-900 px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-amber-300 disabled:opacity-50"
                >
                  {isClaimed ? "Claimed ✓" : busy ? "Claiming…" : reached ? "Claim" : "Locked"}
                </button>
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
            onClick={() => setOpen(false)}
            className="text-xs font-black uppercase tracking-wider text-amber-300 underline-offset-2 hover:underline"
          >
            View full leaderboard →
          </Link>
          <Link
            href="/daily"
            onClick={() => setOpen(false)}
            className="rounded-full border-2 border-stone-900 bg-amber-400 px-4 py-1.5 text-xs font-black uppercase tracking-wider text-stone-900 shadow-[0_2px_0_0_rgba(0,0,0,0.9)]"
          >
            Earn points → Daily
          </Link>
        </div>
      </Card>
    </Backdrop>
  );
}

function Backdrop({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Tournament"
      className="fixed inset-0 z-[80] flex items-center justify-center bg-stone-950/70 px-4 backdrop-blur-sm"
      onClick={onClose}
    >
      {children}
    </div>
  );
}

function Card({
  children,
  onClose,
  accent,
}: {
  children: React.ReactNode;
  onClose: () => void;
  accent?: string;
}) {
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="relative w-full max-w-md overflow-hidden rounded-2xl border-4 border-stone-900 shadow-[0_6px_0_0_rgba(0,0,0,0.9)]"
      style={{
        background: accent
          ? `linear-gradient(135deg, ${accent}, #292524)`
          : "rgb(28 25 23 / 0.95)",
      }}
    >
      <div className="p-5">
        <CloseButton
          onClick={onClose}
          ariaLabel="Close tournament"
          className="absolute -right-2 -top-2"
        />
        {children}
      </div>
    </div>
  );
}
