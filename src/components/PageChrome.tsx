"use client";

import { Logo } from "@/components/branding/Logo";
import { MainNav } from "@/components/MainNav";
import { RibbonDailyButton } from "@/components/ribbon/RibbonDailyButton";
import { RibbonTournamentButton } from "@/components/ribbon/RibbonTournamentButton";
import { RibbonRiffsBalance } from "@/components/ribbon/RibbonRiffsBalance";

// Global page chrome. Two stacked rows:
//   Row 1 — Logo + MainNav  (was per-page <header> on every page)
//   Row 2 — Daily + Tournament icons | Riffs balance pill
// Divider sits between the rows.
//
// Mounted once in the root layout (before {children}) so every page
// renders below it. Per-page <header> blocks containing the same
// Logo + nav have been removed.
export function PageChrome() {
  return (
    <header className="w-full">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 pt-4 pb-3 sm:pt-6 sm:pb-4">
        <Logo />
        <MainNav />
      </div>
      <div className="mx-auto w-full max-w-5xl px-6">
        <div className="border-t-2 border-amber-100/10" aria-hidden />
      </div>
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-6 pt-3 pb-4">
        <div className="flex items-center gap-2">
          <RibbonDailyButton />
          <RibbonTournamentButton />
        </div>
        <RibbonRiffsBalance />
      </div>
    </header>
  );
}
