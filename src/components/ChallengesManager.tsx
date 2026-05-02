"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { createClient } from "@/lib/supabase/client";
import { sfxClaim } from "@/lib/sfx";
import { flyCoinsFrom } from "@/lib/coinFly";
import { CloseButton } from "@/components/CloseButton";
import { RiffsIcon } from "@/components/RiffsIcon";
import { OPEN_DAILY_EVENT } from "@/lib/dailyRiffs";
import { METRIC_CHANGE_EVENT, dailyMetricKey, recordEvent } from "@/lib/metrics";
import {
  selectDailyChallenges,
  todayDateStr,
  type DailyChallengeTemplate,
} from "@/lib/challenges";

type Tab = "daily" | "weekly" | "achievements";

// Challenges modal. Replaces the legacy DailyRiffsManager (login
// calendar grid). Three tabs:
//   Daily — 5 templates picked deterministically by date, claim each
//     once per UTC day. The login-bonus is one of the templates.
//   Weekly — Phase 2.
//   Achievements — Phase 2.
//
// Listens for OPEN_DAILY_EVENT (the ribbon's Daily icon button still
// fires this) so the entry point doesn't change when we add the new
// content.
//
// Bumps the `app_open` metric on first mount each session so just
// landing on the app counts toward the open-Riffle challenge.
export function ChallengesManager() {
  const { user, profile, loading, refreshProfile } = useAuth();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("daily");
  const [metrics, setMetrics] = useState<Record<string, number>>({});
  const [claimedKeys, setClaimedKeys] = useState<Set<string>>(new Set());
  const [busyKey, setBusyKey] = useState<string | null>(null);

  // Bump app_open once when authenticated so the simplest challenge
  // is auto-completed by being here.
  useEffect(() => {
    if (loading || !user) return;
    recordEvent("app_open");
  }, [loading, user]);

  // Fetch metrics + claims once on open and on metric-change events.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    async function fetchAll() {
      const supabase = createClient();
      const [m, c] = await Promise.all([
        supabase.rpc("get_user_metrics"),
        supabase.rpc("get_today_claims"),
      ]);
      if (cancelled) return;
      setMetrics((m.data as Record<string, number>) ?? {});
      setClaimedKeys(new Set((c.data as string[]) ?? []));
    }
    fetchAll();
    function onChange() {
      fetchAll();
    }
    window.addEventListener(METRIC_CHANGE_EVENT, onChange);
    return () => {
      cancelled = true;
      window.removeEventListener(METRIC_CHANGE_EVENT, onChange);
    };
  }, [user]);

  // Open via ribbon Daily button.
  useEffect(() => {
    function handle() {
      setOpen(true);
    }
    window.addEventListener(OPEN_DAILY_EVENT, handle);
    return () => window.removeEventListener(OPEN_DAILY_EVENT, handle);
  }, []);

  // Escape closes.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const today = todayDateStr();
  const templates = useMemo(() => selectDailyChallenges(today), [today]);

  function progressFor(t: DailyChallengeTemplate): number {
    return metrics[dailyMetricKey(t.metric, today)] ?? 0;
  }

  async function claim(t: DailyChallengeTemplate, sourceEl: HTMLElement | null) {
    if (!profile || busyKey) return;
    setBusyKey(t.key);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("claim_daily_challenge", {
        p_template_key: t.key,
        p_metric_key: dailyMetricKey(t.metric, today),
        p_target: t.target,
        p_riffs: t.reward.riffs,
      });
      if (error) {
        console.warn("claim_daily_challenge error:", error.message);
        return;
      }
      const result = data as { ok?: boolean; reason?: string } | null;
      if (!result?.ok) return;

      flyCoinsFrom(sourceEl, t.reward.riffs);
      sfxClaim();
      setClaimedKeys((prev) => new Set(prev).add(t.key));
      await refreshProfile();
    } finally {
      setBusyKey(null);
    }
  }

  // Notification dot count: claimable but unclaimed challenges. Used
  // by RibbonDailyButton via a custom event since this manager owns
  // the count source of truth.
  const claimableCount = useMemo(() => {
    let n = 0;
    for (const t of templates) {
      if (claimedKeys.has(t.key)) continue;
      if (progressFor(t) >= t.target) n++;
    }
    return n;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templates, metrics, claimedKeys]);

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("riffle:claimable-count", {
        detail: { count: claimableCount },
      }),
    );
  }, [claimableCount]);

  if (loading || !profile) return null;
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Daily challenges"
      className="fixed inset-0 z-[80] flex items-center justify-center bg-stone-950/70 px-4 backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative flex max-h-[90vh] w-full max-w-md flex-col rounded-2xl border-4 border-stone-900 bg-stone-900 shadow-[0_6px_0_0_rgba(0,0,0,0.9)]"
      >
        <CloseButton
          onClick={() => setOpen(false)}
          ariaLabel="Close challenges"
          className="absolute -right-2 -top-2 z-10"
        />

        <div className="border-b-2 border-stone-800 px-5 py-4">
          <div className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-300">
            Challenges
          </div>
          <div className="text-base font-black uppercase tracking-tight text-amber-50">
            {tab === "daily"
              ? "Today's challenges"
              : tab === "weekly"
                ? "Weekly challenges"
                : "Achievements"}
          </div>
        </div>

        <nav className="flex border-b-2 border-stone-800">
          {(["daily", "weekly", "achievements"] as Tab[]).map((t) => {
            const active = tab === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`flex-1 px-2 py-2.5 text-[11px] font-black uppercase tracking-wider transition ${
                  active
                    ? "bg-amber-400 text-stone-900"
                    : "text-amber-100/70 hover:bg-stone-800"
                }`}
              >
                {t}
              </button>
            );
          })}
        </nav>

        <div className="flex-1 overflow-y-auto p-4">
          {tab === "daily" && (
            <div className="flex flex-col gap-2.5">
              {templates.map((t) => (
                <ChallengeCard
                  key={t.key}
                  template={t}
                  progress={progressFor(t)}
                  claimed={claimedKeys.has(t.key)}
                  busy={busyKey === t.key}
                  onClaim={(el) => claim(t, el)}
                />
              ))}
              <NextResetCountdown />
            </div>
          )}
          {tab === "weekly" && <ComingSoon kind="Weekly challenges" />}
          {tab === "achievements" && <ComingSoon kind="Achievements" />}
        </div>
      </div>
    </div>
  );
}

function ChallengeCard({
  template,
  progress,
  claimed,
  busy,
  onClaim,
}: {
  template: DailyChallengeTemplate;
  progress: number;
  claimed: boolean;
  busy: boolean;
  onClaim: (el: HTMLElement | null) => void;
}) {
  const ratio = Math.min(1, progress / template.target);
  const ready = progress >= template.target && !claimed;

  return (
    <div
      className={`relative overflow-hidden rounded-xl border-2 p-3 ${
        claimed
          ? "border-emerald-700 bg-emerald-200 text-emerald-900"
          : ready
            ? "border-stone-900 bg-amber-300 text-stone-900 shadow-[0_3px_0_0_rgba(0,0,0,0.6)]"
            : "border-stone-700 bg-stone-50 text-stone-900"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border-2 border-stone-900 bg-white text-xl">
          {template.emoji}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-black leading-tight">
            {template.description}
          </div>
          <div className="mt-1 flex items-center gap-2">
            <div className="h-2 flex-1 overflow-hidden rounded-full border border-stone-900 bg-stone-200">
              <div
                className="h-full bg-emerald-500 transition-[width] duration-300"
                style={{ width: `${ratio * 100}%` }}
              />
            </div>
            <span className="font-mono text-[11px] font-bold">
              {Math.min(progress, template.target)}/{template.target}
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <div className="flex items-center gap-1 rounded-full border-2 border-stone-900 bg-stone-50 px-2 py-0.5 text-xs font-black text-stone-900 shadow-[0_1px_0_0_rgba(0,0,0,0.7)]">
            <span>+{template.reward.riffs}</span>
            <RiffsIcon size={12} />
          </div>
          {template.reward.extra?.label && (
            <div className="rounded-full border border-stone-900 bg-stone-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-stone-700">
              {template.reward.extra.label}
            </div>
          )}
          {(claimed || ready) && (
            <button
              type="button"
              onClick={(e) => onClaim(e.currentTarget)}
              disabled={claimed || busy}
              className={`min-w-[60px] rounded-full border-2 border-stone-900 px-3 py-1 text-[11px] font-black uppercase tracking-wider shadow-[0_2px_0_0_rgba(0,0,0,0.7)] disabled:cursor-not-allowed ${
                claimed
                  ? "bg-emerald-100 text-emerald-900"
                  : "bg-emerald-500 text-emerald-50 hover:bg-emerald-400"
              }`}
            >
              {claimed ? "✓" : busy ? "…" : "Claim"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ComingSoon({ kind }: { kind: string }) {
  return (
    <div className="rounded-xl border-2 border-dashed border-stone-700 bg-stone-950 p-6 text-center">
      <div className="text-2xl">⏳</div>
      <div className="mt-2 text-sm font-black uppercase tracking-wider text-amber-100">
        {kind} coming soon
      </div>
      <p className="mt-1 text-xs text-amber-100/60">
        Phase 2 of the challenge system. For now, the Daily tab is
        the active one.
      </p>
    </div>
  );
}

function NextResetCountdown() {
  const [text, setText] = useState("");
  useEffect(() => {
    function tick() {
      const now = new Date();
      const next = new Date(now);
      next.setUTCHours(24, 0, 0, 0);
      const ms = next.getTime() - now.getTime();
      const h = Math.floor(ms / 3_600_000);
      const m = Math.floor((ms % 3_600_000) / 60_000);
      const s = Math.floor((ms % 60_000) / 1000);
      setText(`${h}h ${m}m ${s}s`);
    }
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);
  return (
    <div className="mt-1 text-center text-[10px] font-black uppercase tracking-wider text-amber-100/50">
      New challenges in · {text}
    </div>
  );
}
