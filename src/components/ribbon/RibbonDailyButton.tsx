"use client";

import { useEffect, useState } from "react";
import { CalendarDays } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { openDailyRiffs } from "@/lib/dailyRiffs";

// Circular icon button on the ribbon. Click → fires the open-daily
// event the DailyRiffsManager listens for. Shows a red notification
// dot in the corner when there's a claim available so the player's
// eye is drawn back even after dismissing the auto-popup.
export function RibbonDailyButton() {
  const { profile, loading } = useAuth();
  const [today, setToday] = useState<string | null>(null);

  useEffect(() => {
    setToday(new Date().toISOString().slice(0, 10));
  }, []);

  if (loading || !profile || !today) {
    return <RibbonIconButtonShell label="Daily" disabled icon={<CalendarDays className="h-5 w-5" />} />;
  }

  const claimable = profile.login_last_claimed_on !== today;

  return (
    <RibbonIconButtonShell
      label="Daily Riffs"
      onClick={openDailyRiffs}
      icon={<CalendarDays className="h-5 w-5" />}
      badge={claimable ? "1" : undefined}
    />
  );
}

// Shared icon-button visual so the ribbon stays consistent. Amber
// circle, chunky stone-900 border, drop shadow, optional corner
// badge for notification count.
export function RibbonIconButtonShell({
  label,
  icon,
  onClick,
  badge,
  disabled = false,
  progress,
}: {
  label: string;
  icon: React.ReactNode;
  onClick?: () => void;
  badge?: string;
  disabled?: boolean;
  // 0..1 — when supplied, draws a thin progress bar under the icon
  // (inside the circle outline).
  progress?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || !onClick}
      aria-label={label}
      className={[
        "relative inline-flex h-11 w-11 items-center justify-center rounded-full border-2 border-stone-900 text-stone-900 shadow-[0_2px_0_0_rgba(0,0,0,0.9)] transition active:translate-y-0.5 active:shadow-[0_1px_0_0_rgba(0,0,0,0.9)] disabled:opacity-60",
        disabled ? "bg-stone-200" : "bg-amber-400 hover:bg-amber-300",
      ].join(" ")}
    >
      {icon}
      {progress != null && (
        <span
          aria-hidden
          className="absolute inset-x-1 bottom-1 h-1 overflow-hidden rounded-full bg-stone-900/30"
        >
          <span
            className="block h-full bg-emerald-500"
            style={{ width: `${Math.max(0, Math.min(1, progress)) * 100}%` }}
          />
        </span>
      )}
      {badge && (
        <span
          aria-hidden
          className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-stone-900 bg-rose-500 px-1 text-[10px] font-black text-white shadow-[0_1px_0_0_rgba(0,0,0,0.9)]"
        >
          {badge}
        </span>
      )}
    </button>
  );
}
