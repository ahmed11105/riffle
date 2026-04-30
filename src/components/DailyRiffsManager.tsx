"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { createClient } from "@/lib/supabase/client";
import { sfxClaim } from "@/lib/sfx";
import { flyCoinsFrom } from "@/lib/coinFly";
import { CloseButton } from "@/components/CloseButton";
import { RiffsIcon } from "@/components/RiffsIcon";

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

// Daily Riffs is now a popup, not always-on inline UI. The manager
// renders three things in sequence:
//  1. A small floating calendar pill (always visible) that re-opens
//     the modal on demand.
//  2. The modal itself, with the 7-tile grid + the claim affordance
//     embedded in the highlighted tile.
//  3. Auto-open behavior: the first time today the player visits and
//     a claim is available, the modal pops itself open. After they
//     claim OR close, we set a per-day flag in localStorage so we
//     don't re-trigger on every navigation.
export function DailyRiffsManager() {
  const { profile, refreshProfile, loading } = useAuth();
  const [today, setToday] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [justClaimed, setJustClaimed] = useState(false);
  const autoShownRef = useRef(false);
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

  // Auto-open on first eligible visit per day.
  useEffect(() => {
    if (loading || !profile || !today) return;
    if (claimedToday) return;
    if (autoShownRef.current) return;
    try {
      const flag = localStorage.getItem(AUTO_SHOWN_KEY);
      if (flag === today) return;
    } catch {}
    autoShownRef.current = true;
    setOpen(true);
  }, [loading, profile, today, claimedToday]);

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

  return (
    <>
      <DailyRiffsTriggerButton
        claimable={!claimedToday}
        onClick={() => setOpen(true)}
      />
      {open && (
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
      )}
    </>
  );
}

function DailyRiffsTriggerButton({
  claimable,
  onClick,
}: {
  claimable: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={claimable ? "Open daily Riffs (claim available)" : "Open daily Riffs"}
      className="fixed left-4 top-14 z-40 inline-flex items-center gap-2 rounded-full border-2 border-stone-900 bg-stone-50 px-3 py-1.5 text-xs font-black uppercase tracking-wider text-stone-900 shadow-[0_2px_0_0_rgba(0,0,0,0.9)] transition active:translate-y-0.5 active:shadow-[0_1px_0_0_rgba(0,0,0,0.9)] hover:bg-stone-100 sm:left-6 sm:top-16"
    >
      <CalendarDays className="h-4 w-4" aria-hidden />
      <span>Daily</span>
      {claimable && (
        <span className="ml-0.5 inline-flex h-2.5 w-2.5 rounded-full border border-stone-900 bg-emerald-500 shadow-[0_1px_0_0_rgba(0,0,0,0.7)]" />
      )}
    </button>
  );
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
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-300">
              ✓ Claimed today
            </span>
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
