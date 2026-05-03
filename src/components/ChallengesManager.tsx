"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { createClient } from "@/lib/supabase/client";
import { sfxClaim } from "@/lib/sfx";
import { flyCoinsFrom } from "@/lib/coinFly";
import { X, Crown, Lock, Check } from "lucide-react";
import { RiffsIcon } from "@/components/RiffsIcon";
import { DailyWheel } from "@/components/DailyWheel";
import { IconModalShell } from "@/components/IconModalShell";
import { OPEN_DAILY_EVENT, type OpenDailyDetail } from "@/lib/dailyRiffs";
import {
  METRIC_CHANGE_EVENT,
  dailyMetricKey,
  weeklyMetricKey,
  lifetimeMetricKey,
  recordEvent,
  awardXp,
} from "@/lib/metrics";
import {
  selectDailyChallenges,
  todayDateStr,
  WEEKLY_TEMPLATES,
  ACHIEVEMENT_TEMPLATES,
  type DailyChallengeTemplate,
  type WeeklyChallengeTemplate,
  type AchievementTemplate,
} from "@/lib/challenges";

type Tab = "spin" | "daily" | "weekly" | "achievements";

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
  const [tab, setTab] = useState<Tab>("spin");
  const [metrics, setMetrics] = useState<Record<string, number>>({});
  const [claimedKeys, setClaimedKeys] = useState<Set<string>>(new Set());
  const [weeklyClaimedKeys, setWeeklyClaimedKeys] = useState<Set<string>>(new Set());
  const [achievementClaimedKeys, setAchievementClaimedKeys] = useState<Set<string>>(new Set());
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [originRect, setOriginRect] = useState<
    OpenDailyDetail["originRect"] | null
  >(null);

  // Bump app_open once when authenticated so the simplest challenge
  // is auto-completed by being here.
  useEffect(() => {
    if (loading || !user) return;
    recordEvent("app_open");
  }, [loading, user]);

  // Fetch metrics + claims once on open and on metric-change events.
  // Three claim scopes (daily / weekly / achievement) all live in the
  // same modal but key off different ledger tables, so we pull them
  // in parallel.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    async function fetchAll() {
      const supabase = createClient();
      const [m, dailyC, weeklyC, achC] = await Promise.all([
        supabase.rpc("get_user_metrics"),
        supabase.rpc("get_today_claims"),
        supabase.rpc("get_this_week_claims"),
        supabase.rpc("get_achievement_claims"),
      ]);
      if (cancelled) return;
      setMetrics((m.data as Record<string, number>) ?? {});
      setClaimedKeys(new Set((dailyC.data as string[]) ?? []));
      setWeeklyClaimedKeys(new Set((weeklyC.data as string[]) ?? []));
      setAchievementClaimedKeys(new Set((achC.data as string[]) ?? []));
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

  // Open via ribbon Daily button. Pick the initial tab based on
  // whether the daily wheel has been spun yet — fresh visit lands
  // on Spin (the high-anticipation moment), already-spun visit lands
  // on Daily (the still-actionable list). Animation + escape +
  // click-outside are owned by IconModalShell.
  useEffect(() => {
    function handle(e: Event) {
      const detail = (e as CustomEvent<OpenDailyDetail>).detail;
      setOriginRect(detail?.originRect ?? null);
      setTab(claimedKeys.has("daily_wheel") ? "daily" : "spin");
      setOpen(true);
    }
    window.addEventListener(OPEN_DAILY_EVENT, handle);
    return () => window.removeEventListener(OPEN_DAILY_EVENT, handle);
  }, [claimedKeys]);

  function handleClose() {
    setOpen(false);
  }

  const today = todayDateStr();
  const templates = useMemo(() => selectDailyChallenges(today), [today]);

  function progressForDaily(t: DailyChallengeTemplate): number {
    return metrics[dailyMetricKey(t.metric, today)] ?? 0;
  }
  function progressForWeekly(t: WeeklyChallengeTemplate): number {
    return metrics[weeklyMetricKey(t.metric)] ?? 0;
  }
  function progressForAchievement(t: AchievementTemplate): number {
    return metrics[lifetimeMetricKey(t.metric)] ?? 0;
  }

  async function claimDaily(
    t: DailyChallengeTemplate,
    sourceEl: HTMLElement | null,
  ) {
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
      const result = data as { ok?: boolean } | null;
      if (!result?.ok) return;

      flyCoinsFrom(sourceEl, t.reward.riffs);
      sfxClaim();
      setClaimedKeys((prev) => new Set(prev).add(t.key));
      // 10 XP per claimed challenge — keeps the level curve moving
      // for the player who actually engages with the daily list.
      awardXp(10, "Challenge claimed");
      await refreshProfile();
    } finally {
      setBusyKey(null);
    }
  }

  async function claimWeekly(
    t: WeeklyChallengeTemplate,
    sourceEl: HTMLElement | null,
  ) {
    if (!profile || busyKey) return;
    setBusyKey(t.key);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("claim_weekly_challenge", {
        p_template_key: t.key,
        p_metric_key: weeklyMetricKey(t.metric),
        p_target: t.target,
        p_riffs: t.reward.riffs,
      });
      if (error) {
        console.warn("claim_weekly_challenge error:", error.message);
        return;
      }
      const result = data as { ok?: boolean } | null;
      if (!result?.ok) return;
      flyCoinsFrom(sourceEl, t.reward.riffs);
      sfxClaim();
      setWeeklyClaimedKeys((prev) => new Set(prev).add(t.key));
      // Weekly claims earn more XP than daily — bigger commitment.
      awardXp(25, "Weekly challenge claimed");
      await refreshProfile();
    } finally {
      setBusyKey(null);
    }
  }

  async function claimAchievement(
    t: AchievementTemplate,
    sourceEl: HTMLElement | null,
  ) {
    if (!profile || busyKey) return;
    setBusyKey(t.key);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("claim_achievement", {
        p_template_key: t.key,
        p_metric_key: lifetimeMetricKey(t.metric),
        p_target: t.target,
        p_riffs: t.reward.riffs,
      });
      if (error) {
        console.warn("claim_achievement error:", error.message);
        return;
      }
      const result = data as { ok?: boolean } | null;
      if (!result?.ok) return;
      flyCoinsFrom(sourceEl, t.reward.riffs);
      sfxClaim();
      setAchievementClaimedKeys((prev) => new Set(prev).add(t.key));
      // Achievements are rare events — give them more XP than weekly.
      awardXp(50, "Achievement unlocked");
      await refreshProfile();
    } finally {
      setBusyKey(null);
    }
  }

  // Notification dot count: claimable challenges + an unspun daily
  // wheel. Used by RibbonDailyButton via a custom event since this
  // manager owns the count source of truth.
  const claimableCount = useMemo(() => {
    let n = 0;
    for (const t of templates) {
      if (claimedKeys.has(t.key)) continue;
      if (progressForDaily(t) >= t.target) n++;
    }
    for (const t of WEEKLY_TEMPLATES) {
      if (weeklyClaimedKeys.has(t.key)) continue;
      if (progressForWeekly(t) >= t.target) n++;
    }
    for (const t of ACHIEVEMENT_TEMPLATES) {
      if (achievementClaimedKeys.has(t.key)) continue;
      if (progressForAchievement(t) >= t.target) n++;
    }
    if (!claimedKeys.has("daily_wheel")) n++;
    return n;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templates, metrics, claimedKeys, weeklyClaimedKeys, achievementClaimedKeys]);

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("riffle:claimable-count", {
        detail: { count: claimableCount },
      }),
    );
  }, [claimableCount]);

  if (loading || !profile) return null;

  return (
    <IconModalShell
      open={open}
      onClose={handleClose}
      originRect={originRect}
      ariaLabel="Daily challenges"
      contentClassName="relative w-full max-w-md pt-7"
    >
        {/* Crown medallion — circular gold disk with the lucide
            Crown SVG inside. Sits half above / half overlapping the
            gold header. Sibling of (not inside) the overflow-hidden
            modal so it can extend upward freely; the wrapper above
            has pt-7 to reserve space so the medallion never collides
            with the modal frame from outside. */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-0 z-30 flex h-14 w-14 -translate-x-1/2 items-center justify-center rounded-full border-4 border-stone-900 bg-gradient-to-br from-amber-200 via-amber-400 to-amber-600 shadow-[0_4px_0_0_rgba(0,0,0,0.7),inset_0_2px_0_0_rgba(255,235,180,0.6)]"
        >
          <Crown className="h-7 w-7 text-stone-900" strokeWidth={2.5} />
        </div>
        <div className="relative flex max-h-[90vh] w-full flex-col overflow-hidden rounded-3xl border-4 border-amber-500 bg-gradient-to-br from-amber-950 via-stone-900 to-amber-950 shadow-[0_8px_0_0_rgba(0,0,0,0.9),0_0_30px_rgba(251,191,36,0.25)]">
        {/* Gold header strip. Top padding accommodates the crown
            medallion above (which overlaps into this space). Close
            button sits inside the header instead of clipping the
            rounded corner. */}
        <div className="relative overflow-hidden border-b-4 border-stone-900 bg-gradient-to-b from-amber-400 via-amber-500 to-amber-700 px-5 pb-3 pt-7 text-center shadow-[inset_0_-4px_0_0_rgba(0,0,0,0.2),inset_0_2px_0_0_rgba(255,255,255,0.4)]">
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close challenges"
            className="absolute right-3 top-3 z-20 inline-flex h-7 w-7 items-center justify-center rounded-full border-2 border-stone-900 bg-stone-900/90 text-amber-200 shadow-[0_2px_0_0_rgba(0,0,0,0.6),inset_0_1px_0_0_rgba(255,200,80,0.2)] transition active:translate-y-0.5 active:shadow-[0_1px_0_0_rgba(0,0,0,0.6)] hover:bg-stone-800 hover:text-amber-100"
          >
            <X className="h-4 w-4" strokeWidth={3} aria-hidden />
          </button>
          <div className="text-[10px] font-black uppercase tracking-[0.4em] text-amber-900/80">
            Challenges
          </div>
          <div className="mt-0.5 text-lg font-black uppercase tracking-tight text-stone-900 drop-shadow-[0_1px_0_rgba(255,220,150,0.6)]">
            {tab === "spin"
              ? "Daily spin"
              : tab === "daily"
                ? "Today's challenges"
                : tab === "weekly"
                  ? "Weekly challenges"
                  : "Achievements"}
          </div>
        </div>

        <nav className="flex gap-1 border-b-2 border-stone-900 bg-stone-950 p-1">
          {(
            [
              { id: "spin", label: "Spin" },
              { id: "daily", label: "Daily" },
              { id: "weekly", label: "Weekly" },
              { id: "achievements", label: "Goals" },
            ] as { id: Tab; label: string }[]
          ).map(({ id, label }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`flex-1 rounded-lg px-2 py-2 text-[11px] font-black uppercase tracking-wider transition ${
                  active
                    ? "bg-gradient-to-b from-amber-300 to-amber-500 text-stone-900 shadow-[0_2px_0_0_rgba(0,0,0,0.6),inset_0_1px_0_0_rgba(255,255,255,0.5)]"
                    : "text-amber-100/60 hover:bg-stone-900 hover:text-amber-100"
                }`}
              >
                {label}
              </button>
            );
          })}
        </nav>

        <div className="flex-1 overflow-y-auto p-4">
          {tab === "spin" && (
            <div className="flex flex-col gap-3">
              <DailyWheel />
              <NextResetCountdown />
            </div>
          )}
          {tab === "daily" && (
            <div className="flex flex-col gap-2.5">
              {templates.map((t) => (
                <ChallengeCard
                  key={t.key}
                  template={t}
                  progress={progressForDaily(t)}
                  claimed={claimedKeys.has(t.key)}
                  busy={busyKey === t.key}
                  onClaim={(el) => claimDaily(t, el)}
                />
              ))}
              <NextResetCountdown />
            </div>
          )}
          {tab === "weekly" && (
            <div className="flex flex-col gap-2.5">
              {WEEKLY_TEMPLATES.map((t) => (
                <ChallengeCard
                  key={t.key}
                  template={t}
                  progress={progressForWeekly(t)}
                  claimed={weeklyClaimedKeys.has(t.key)}
                  busy={busyKey === t.key}
                  onClaim={(el) => claimWeekly(t, el)}
                />
              ))}
              <WeeklyResetCountdown />
            </div>
          )}
          {tab === "achievements" && (
            <div className="flex flex-col gap-2.5">
              {ACHIEVEMENT_TEMPLATES.map((t) => (
                <ChallengeCard
                  key={t.key}
                  template={t}
                  progress={progressForAchievement(t)}
                  claimed={achievementClaimedKeys.has(t.key)}
                  busy={busyKey === t.key}
                  onClaim={(el) => claimAchievement(t, el)}
                />
              ))}
              <p className="mt-2 text-center text-[10px] font-black uppercase tracking-wider text-amber-100/40">
                Lifetime goals · keep playing to unlock
              </p>
            </div>
          )}
        </div>
        </div>
    </IconModalShell>
  );
}

// Daily/Weekly/Achievement templates all share the same visible
// shape — render them through one card so the three tabs feel
// uniform.
type AnyChallengeTemplate =
  | DailyChallengeTemplate
  | WeeklyChallengeTemplate
  | AchievementTemplate;

function ChallengeCard({
  template,
  progress,
  claimed,
  busy,
  onClaim,
}: {
  template: AnyChallengeTemplate;
  progress: number;
  claimed: boolean;
  busy: boolean;
  onClaim: (el: HTMLElement | null) => void;
}) {
  const ratio = Math.min(1, progress / template.target);
  const ready = progress >= template.target && !claimed;

  // Three palettes — each card is a "card surface" that visually
  // communicates state at a glance instead of relying on text.
  const cardClass = claimed
    ? "border-emerald-700 bg-gradient-to-r from-emerald-100 via-emerald-200 to-emerald-100 text-emerald-900 shadow-[0_2px_0_0_rgba(0,0,0,0.4),inset_0_1px_0_0_rgba(255,255,255,0.4)]"
    : ready
      ? "border-amber-700 bg-gradient-to-r from-amber-200 via-amber-300 to-amber-400 text-stone-900 shadow-[0_3px_0_0_rgba(0,0,0,0.6),inset_0_1px_0_0_rgba(255,255,255,0.5)] ring-2 ring-amber-300/50"
      : "border-amber-200/30 bg-gradient-to-r from-amber-50 via-stone-50 to-amber-50 text-stone-800 shadow-[0_2px_0_0_rgba(0,0,0,0.4)]";

  return (
    <div className={`relative overflow-hidden rounded-2xl border-2 p-3 transition ${cardClass}`}>
      {/* Subtle shine sweep on a claimable card to draw the eye. */}
      {ready && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 -translate-x-full animate-[shine_2.5s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/40 to-transparent"
        />
      )}

      <div className="relative flex items-center gap-3">
        {/* Lucide icon in a gold-bordered circle. Used to be an emoji
            string but emoji rendering is unreliable across older
            Android/Linux browsers (renders as tofu). Each template
            picks an icon + color in the data so the visual stays
            distinct without depending on the OS emoji set. */}
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-stone-900 bg-gradient-to-br from-amber-200 via-amber-300 to-amber-500 shadow-[0_2px_0_0_rgba(0,0,0,0.5),inset_0_1px_0_0_rgba(255,255,255,0.5)]">
          {claimed ? (
            <Check className="h-6 w-6 text-emerald-700" strokeWidth={3} />
          ) : (
            <template.Icon
              className={`h-6 w-6 ${template.iconColor}`}
              strokeWidth={2.5}
            />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="text-sm font-black leading-tight">
            {template.description}
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <div className="h-2.5 flex-1 overflow-hidden rounded-full border-2 border-stone-900 bg-stone-200/80 shadow-[inset_0_1px_0_0_rgba(0,0,0,0.2)]">
              <div
                className="h-full bg-gradient-to-r from-emerald-400 via-emerald-500 to-amber-400 transition-[width] duration-500"
                style={{ width: `${Math.max(ratio * 100, 4)}%` }}
              />
            </div>
            <span className="font-mono text-[11px] font-bold tabular-nums">
              {Math.min(progress, template.target)}/{template.target}
            </span>
          </div>
        </div>

        {/* The reward pill IS the claim affordance. Three visual
            states map to player action:
              - locked (grey): in progress, can't tap
              - ready (gold + pulse): tap to claim
              - claimed (emerald + ✓): done, dimmed
            Bonus extras (e.g. "+1 hint") stack below as a small
            non-interactive label so the button stays single-purpose. */}
        <div className="flex flex-col items-end gap-1">
          <button
            type="button"
            onClick={(e) => onClaim(e.currentTarget)}
            disabled={!ready || claimed || busy}
            aria-label={
              claimed
                ? "Already claimed"
                : ready
                  ? `Claim ${template.reward.riffs} Riffs`
                  : `Locked — ${template.reward.riffs} Riffs available when complete`
            }
            className={`flex min-w-[68px] items-center justify-center gap-1 rounded-full border-2 border-stone-900 px-3 py-1 text-xs font-black shadow-[0_2px_0_0_rgba(0,0,0,0.7),inset_0_1px_0_0_rgba(255,255,255,0.5)] transition disabled:cursor-not-allowed ${
              claimed
                ? "bg-gradient-to-b from-emerald-200 to-emerald-400 text-emerald-900"
                : ready
                  ? "animate-pulse-soft bg-gradient-to-b from-amber-300 to-amber-500 text-stone-900 hover:from-amber-200 hover:to-amber-400 active:translate-y-0.5"
                  : "bg-gradient-to-b from-stone-300 to-stone-400 text-stone-600 opacity-70"
            }`}
          >
            {claimed ? (
              <Check className="h-3.5 w-3.5" strokeWidth={4} />
            ) : busy ? (
              <span>…</span>
            ) : (
              <>
                <span>+{template.reward.riffs}</span>
                <RiffsIcon size={12} />
              </>
            )}
          </button>
          {template.reward.extra?.label && !claimed && (
            <span
              className={`rounded-full border border-stone-900 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider shadow-[0_1px_0_0_rgba(0,0,0,0.5)] ${
                ready
                  ? "bg-gradient-to-b from-sky-300 to-sky-500 text-stone-900"
                  : "bg-stone-200 text-stone-500 opacity-70"
              }`}
            >
              {template.reward.extra.label}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function ComingSoon({ kind }: { kind: string }) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-amber-500/50 bg-gradient-to-br from-amber-900/30 via-stone-900 to-amber-900/30 p-8 text-center shadow-[inset_0_1px_0_0_rgba(255,200,80,0.15)]">
      <Lock className="mx-auto h-10 w-10 text-stone-400" strokeWidth={2.5} />
      <div className="mt-2 text-base font-black uppercase tracking-[0.2em] text-amber-200">
        {kind}
      </div>
      <div className="mt-1 text-xs font-black uppercase tracking-wider text-amber-300/60">
        Coming soon
      </div>
      <p className="mt-3 text-xs leading-relaxed text-amber-100/50">
        Phase 2 unlocks weekly challenges with bigger rewards and
        lifetime achievements with tiered medals.
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

// Same idea as NextResetCountdown but counting down to next ISO
// week boundary (Monday 00:00 UTC). Shown at the bottom of the
// Weekly tab so the player sees how long they have left to grind.
function WeeklyResetCountdown() {
  const [text, setText] = useState("");
  useEffect(() => {
    function tick() {
      const now = new Date();
      const day = now.getUTCDay() || 7; // Mon=1..Sun=7
      const daysUntilMonday = 8 - day; // 7 if today is Monday, ..., 1 if Sunday
      const next = new Date(now);
      next.setUTCDate(next.getUTCDate() + daysUntilMonday);
      next.setUTCHours(0, 0, 0, 0);
      const ms = next.getTime() - now.getTime();
      const d = Math.floor(ms / 86_400_000);
      const h = Math.floor((ms % 86_400_000) / 3_600_000);
      const m = Math.floor((ms % 3_600_000) / 60_000);
      setText(d > 0 ? `${d}d ${h}h ${m}m` : `${h}h ${m}m`);
    }
    tick();
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, []);
  return (
    <div className="mt-1 text-center text-[10px] font-black uppercase tracking-wider text-amber-100/50">
      Resets Monday · {text}
    </div>
  );
}
