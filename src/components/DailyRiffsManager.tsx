"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { createClient } from "@/lib/supabase/client";
import { sfxClaim } from "@/lib/sfx";
import { flyCoinsFrom } from "@/lib/coinFly";
import { CloseButton } from "@/components/CloseButton";
import { RiffsIcon } from "@/components/RiffsIcon";
import { OPEN_DAILY_EVENT } from "@/lib/dailyRiffs";
import { saveSim, useSimulation } from "@/lib/simulation";

const REWARDS: Record<number, number> = {
  1: 5,
  2: 8,
  3: 12,
  4: 15,
  5: 20,
  6: 30,
  7: 75,
};

const AUTO_SHOWN_KEY = "riffle:daily-riffs:auto-shown";

// Mirrors claim_login_reward SQL so the UI shows the right tile pre-
// claim. Pure function — `today` passed in for hydration safety.
function nextDayIndex(
  profile: { login_day_index: number; login_last_claimed_on: string | null },
  today: string,
): number {
  if (!profile.login_last_claimed_on) return 1;
  if (profile.login_last_claimed_on === today) {
    return profile.login_day_index >= 7 ? 1 : profile.login_day_index + 1;
  }
  const yesterday = new Date(
    new Date(today + "T00:00:00.000Z").getTime() - 86400000,
  ).toISOString().slice(0, 10);
  if (profile.login_last_claimed_on === yesterday && profile.login_day_index < 7) {
    return profile.login_day_index + 1;
  }
  return 1;
}

// Daily Riffs popup. Modal-only — the trigger now lives in the
// ribbon (RibbonDailyButton). Two paths to open the modal:
//   - The ribbon button's onClick fires OPEN_DAILY_EVENT, we listen.
//   - /daily fires OPEN_DAILY_EVENT after the player completes today's
//     puzzle, but only the first time today (AUTO_SHOWN_KEY guard).
//     Onboarding + How-to-play already crowd the first-visit flow, so
//     deferring the daily-claim popup to AFTER the round keeps the
//     intro moment from drowning in modals.
//
// Once the player has already claimed today, the modal shows a
// "next claim in" countdown to the UTC reset so they know when to
// come back.
export function DailyRiffsManager() {
  const { profile, refreshProfile, loading } = useAuth();
  const sim = useSimulation();
  const [today, setToday] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [justClaimed, setJustClaimed] = useState(false);
  const claimTileRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    setToday(new Date().toISOString().slice(0, 10));
  }, []);

  const claimedToday =
    (today != null && profile?.login_last_claimed_on === today) || justClaimed;
  const upcomingDay = useMemo(() => {
    if (!profile || !today) return 1;
    return nextDayIndex(profile, today);
  }, [profile, today]);
  const highlightDay = claimedToday ? profile?.login_day_index ?? 1 : upcomingDay;

  // Open on demand from the ribbon's Daily icon button OR from
  // /daily after the round ends. Both dispatch OPEN_DAILY_EVENT.
  useEffect(() => {
    function handle() {
      setOpen(true);
    }
    window.addEventListener(OPEN_DAILY_EVENT, handle);
    return () => window.removeEventListener(OPEN_DAILY_EVENT, handle);
  }, []);

  function markAutoShown() {
    if (!today) return;
    try {
      localStorage.setItem(AUTO_SHOWN_KEY, today);
    } catch {}
  }

  function handleClose() {
    markAutoShown();
    setOpen(false);
  }

  async function handleClaim() {
    if (!profile || busy || claimedToday) return;
    setBusy(true);
    try {
      // Simulation path: never hit the RPC (would mutate the real
      // DB). Instead patch the sim state to look like the player
      // just claimed and let the UI react via the overlay.
      if (sim.active) {
        const amount = REWARDS[upcomingDay];
        flyCoinsFrom(claimTileRef.current, amount);
        sfxClaim();
        const next = {
          ...sim,
          profile: {
            ...sim.profile,
            login_day_index: upcomingDay,
            login_last_claimed_on: today,
            coin_balance: (sim.profile.coin_balance ?? profile.coin_balance ?? 0) + amount,
          },
        };
        saveSim(next);
        setJustClaimed(true);
        markAutoShown();
        window.setTimeout(() => setOpen(false), 1500);
        return;
      }

      const supabase = createClient();
      const { data, error } = await supabase.rpc("claim_login_reward");
      if (error) {
        console.warn("claim_login_reward failed:", error.message);
        return;
      }
      const result = data as { ok?: boolean; awarded?: number } | null;
      if (!result?.ok) return;

      const amount = result.awarded ?? REWARDS[upcomingDay];
      flyCoinsFrom(claimTileRef.current, amount);
      sfxClaim();
      setJustClaimed(true);
      markAutoShown();

      // Close the modal once the coins finish landing — long enough
      // for the user to feel the reward, short enough to feel snappy.
      window.setTimeout(() => {
        setOpen(false);
        refreshProfile();
      }, 1500);
    } finally {
      setBusy(false);
    }
  }

  if (loading || !profile || !today) return null;

  return open ? (
    <DailyRiffsDialog
      claimedToday={claimedToday}
      highlightDay={highlightDay}
      upcomingDay={upcomingDay}
      claimedDayIndex={profile?.login_day_index ?? 0}
      busy={busy}
      claimTileRef={claimTileRef}
      onClaim={handleClaim}
      onClose={handleClose}
    />
  ) : null;
}

function DailyRiffsDialog({
  claimedToday,
  highlightDay,
  upcomingDay,
  claimedDayIndex,
  busy,
  claimTileRef,
  onClaim,
  onClose,
}: {
  claimedToday: boolean;
  highlightDay: number;
  upcomingDay: number;
  claimedDayIndex: number;
  busy: boolean;
  claimTileRef: React.MutableRefObject<HTMLButtonElement | null>;
  onClaim: () => void;
  onClose: () => void;
}) {
  // Close on Escape so keyboard users aren't trapped.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Daily Riffs"
      className="fixed inset-0 z-[80] flex items-center justify-center bg-stone-950/70 px-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-2xl border-4 border-stone-900 bg-stone-900/95 p-5 shadow-[0_6px_0_0_rgba(0,0,0,0.9)]"
        onClick={(e) => e.stopPropagation()}
      >
        <CloseButton
          onClick={onClose}
          ariaLabel="Close daily Riffs"
          className="absolute -right-2 -top-2"
        />
        <div className="mb-3 flex items-center justify-between pr-6">
          <span className="text-xs font-black uppercase tracking-wider text-amber-100/70">
            Daily Riffs
          </span>
          {claimedToday ? (
            <NextClaimCountdown />
          ) : (
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-300">
              Day {upcomingDay} ready
            </span>
          )}
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {[1, 2, 3, 4, 5, 6, 7].map((day) => {
            const isHighlight = day === highlightDay;
            const claimable = isHighlight && !claimedToday;
            const isPast = claimedToday ? day <= claimedDayIndex : day < upcomingDay;
            const reward = REWARDS[day];

            const baseTile =
              "relative flex flex-col items-center justify-start gap-0.5 overflow-hidden rounded-lg border-2 pt-2 text-center transition";
            const stateTile = claimable
              ? "border-emerald-700 bg-emerald-500 text-emerald-50 shadow-[0_3px_0_0_rgba(0,0,0,0.6),inset_0_1px_0_0_rgba(255,255,255,0.5),inset_0_-2px_0_0_rgba(0,0,0,0.18)] hover:bg-emerald-400 active:translate-y-0.5 active:shadow-[0_1px_0_0_rgba(0,0,0,0.6),inset_0_1px_0_0_rgba(255,255,255,0.5),inset_0_-2px_0_0_rgba(0,0,0,0.18)] disabled:opacity-60"
              : isPast
                ? "border-stone-800 bg-stone-800 text-amber-100/40"
                : "border-stone-800 bg-stone-900 text-amber-100/70";
            const ring = day === 7 && !claimable ? "ring-2 ring-amber-300/40" : "";

            const inner = (
              <>
                <RiffsIcon size={14} className={claimable ? "" : isPast ? "opacity-40" : "opacity-70"} />
                <span className={`text-xs font-black ${day === 7 && !claimable ? "text-amber-200" : ""}`}>
                  {reward}
                </span>
                <div className="mt-1 h-4 w-full">
                  {claimable && (
                    <div className="flex h-full w-full items-center justify-center bg-white text-[9px] font-black uppercase tracking-wider text-green-800">
                      {busy ? "…" : "Claim"}
                    </div>
                  )}
                </div>
              </>
            );

            if (claimable) {
              return (
                <button
                  key={day}
                  ref={claimTileRef}
                  type="button"
                  onClick={onClaim}
                  disabled={busy}
                  aria-label={`Claim ${reward} Riffs`}
                  className={[baseTile, stateTile, ring].join(" ")}
                >
                  {inner}
                </button>
              );
            }
            return (
              <div key={day} className={[baseTile, stateTile, ring].join(" ")}>
                {inner}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Live countdown to the next UTC midnight reset. Mirrors the
// /daily NextDailyCountdown — once the player has claimed today,
// the modal swaps the "Day N ready" caption for this so they
// know when to come back. Updates once per second while the
// modal is open.
function NextClaimCountdown() {
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
    <span className="text-[10px] font-black uppercase tracking-wider text-emerald-300">
      Next claim · {text}
    </span>
  );
}
