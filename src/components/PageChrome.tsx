"use client";

import { Logo } from "@/components/branding/Logo";
import { MainNav } from "@/components/MainNav";
import { RibbonDailyButton } from "@/components/ribbon/RibbonDailyButton";
import { RibbonTournamentButton } from "@/components/ribbon/RibbonTournamentButton";
import { RibbonStats } from "@/components/ribbon/RibbonStats";
import { RibbonRiffsBalance } from "@/components/ribbon/RibbonRiffsBalance";
import { SimulationBanner } from "@/components/SimulationBanner";

// Global page chrome. Two stacked rows:
//   Row 1 — Logo + MainNav  (was per-page <header> on every page)
//   Row 2 — Daily + Tournament icons | Riffs balance pill
// Divider sits between the rows.
//
// Mounted once in the root layout (before {children}) so every page
// renders below it. Per-page <header> blocks containing the same
// Logo + nav have been removed.
//
// Row 1 is sticky at the top of the viewport so the brand mark and
// nav stay anchored as the player scrolls. The ribbon row (icons +
// balance) scrolls naturally so the player isn't paying for the
// streak/balance permanent space at the cost of viewport real
// estate — they just scroll up to peek if needed.
export function PageChrome() {
  return (
    <header className="sticky top-0 z-30 w-full bg-stone-950/85 backdrop-blur-sm">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-center px-6 pt-4 pb-3 sm:justify-between sm:pt-6 sm:pb-4">
        <Logo />
        <MainNav />
      </div>
      <div className="mx-auto w-full max-w-5xl px-6">
        <div className="border-t-2 border-amber-100/10" aria-hidden />
      </div>
      <div className="mx-auto flex w-full max-w-5xl items-center gap-2 px-6 pt-3 pb-4 sm:gap-3">
        <div className="flex shrink-0 items-center gap-2">
          <RibbonDailyButton />
          <RibbonTournamentButton />
        </div>
        <RibbonStats />
        {/* Flex spacer absorbs any leftover horizontal space so the
            stats stay compact next to the icons and the Riffs pill
            stays anchored on the right. */}
        <div className="flex-1" aria-hidden />
        <RibbonRiffsBalance />
      </div>
      <SimulationBanner />
    </header>
  );
}
