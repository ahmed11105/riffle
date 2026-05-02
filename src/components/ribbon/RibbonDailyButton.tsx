"use client";

import { useEffect, useState } from "react";
import { CalendarDays } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { openDailyRiffs } from "@/lib/dailyRiffs";

// Daily ribbon button. Listens for the "claimable count" event the
// ChallengesManager emits whenever metrics or claims change. Badge
// shows the number of challenges currently ready to claim; when 0
// the icon goes hollow (nothing to do right now).
export function RibbonDailyButton() {
  const { profile, loading } = useAuth();
  const [count, setCount] = useState(0);

  useEffect(() => {
    function handle(e: Event) {
      const detail = (e as CustomEvent<{ count: number }>).detail;
      setCount(detail?.count ?? 0);
    }
    window.addEventListener("riffle:claimable-count", handle);
    return () => window.removeEventListener("riffle:claimable-count", handle);
  }, []);

  if (loading || !profile) {
    return (
      <RibbonIconButtonShell
        label="Daily"
        disabled
        appearance="hollow"
        icon={<CalendarDays className="h-5 w-5" />}
      />
    );
  }

  return (
    <RibbonIconButtonShell
      label="Daily challenges"
      onClick={(el) => openDailyRiffs(el?.getBoundingClientRect())}
      icon={<CalendarDays className="h-5 w-5" />}
      appearance={count > 0 ? "active" : "hollow"}
      badge={count > 0 ? String(count) : undefined}
    />
  );
}

// Shared icon-button visual. Three appearance modes match the user's
// brief: "active" amber for unread/claimable, "ongoing" pale amber
// for tournaments that are running but have nothing to claim right
// now, "hollow" transparent for done/ended.
export type RibbonIconAppearance = "active" | "ongoing" | "hollow";

export function RibbonIconButtonShell({
  label,
  icon,
  onClick,
  badge,
  disabled = false,
  progress,
  appearance = "active",
}: {
  label: string;
  icon: React.ReactNode;
  onClick?: (el: HTMLButtonElement | null) => void;
  badge?: string;
  disabled?: boolean;
  // 0..1 — when supplied, draws a thin progress bar inside the
  // bottom of the circle.
  progress?: number;
  appearance?: RibbonIconAppearance;
}) {
  // Base visuals shared by all three states.
  const base =
    "relative inline-flex h-11 w-11 items-center justify-center rounded-full border-2 shadow-[0_2px_0_0_rgba(0,0,0,0.9)] transition active:translate-y-0.5 active:shadow-[0_1px_0_0_rgba(0,0,0,0.9)] disabled:opacity-60";
  const skin = (() => {
    if (disabled) return "border-stone-900 bg-stone-200 text-stone-500";
    switch (appearance) {
      case "active":
        return "border-stone-900 bg-amber-400 text-stone-900 hover:bg-amber-300";
      case "ongoing":
        // Pale amber — same family as active but visually softer so
        // it reads as "running, nothing to grab right now".
        return "border-stone-900 bg-amber-200 text-amber-900 hover:bg-amber-300/90";
      case "hollow":
        return "border-stone-700 bg-transparent text-stone-400 hover:border-stone-500 hover:text-stone-300";
    }
  })();

  return (
    <button
      type="button"
      onClick={(e) => onClick?.(e.currentTarget)}
      disabled={disabled || !onClick}
      aria-label={label}
      className={`${base} ${skin}`}
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
          className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-stone-900 bg-pink-500 px-1 text-[10px] font-black text-white shadow-[0_1px_0_0_rgba(0,0,0,0.9)]"
        >
          {badge}
        </span>
      )}
    </button>
  );
}
