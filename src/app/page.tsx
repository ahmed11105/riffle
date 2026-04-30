import Link from "next/link";
import { Logo } from "@/components/branding/Logo";
import { Mascot } from "@/components/branding/Mascot";
import { HomeStats } from "@/components/HomeStats";
import { HomeHelpLinks } from "@/components/HomeHelpLinks";
import { StarterPackOffer } from "@/components/StarterPackOffer";
import { ActiveEventBanner } from "@/components/ActiveEventBanner";
import { MainNav } from "@/components/MainNav";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center px-6 py-4 text-[--color-foreground] sm:py-10">
      <header className="flex w-full max-w-5xl items-center justify-between">
        <Logo />
        <MainNav />
      </header>

      <section className="mt-4 flex w-full max-w-xl flex-col items-center text-center sm:mt-10">
        {/* Mascot shrinks on mobile so the buttons sit within thumb reach
            without scrolling. */}
        <Mascot
          size={140}
          className="mb-1 h-20 w-20 drop-shadow-[0_6px_0_rgba(0,0,0,0.9)] sm:mb-4 sm:h-[140px] sm:w-[140px] sm:drop-shadow-[0_8px_0_rgba(0,0,0,0.9)]"
        />
        <h1 className="text-4xl font-black leading-none tracking-tighter text-amber-100 sm:text-7xl">
          Name the tune.<br />
          <span className="text-amber-400">Trust your ear.</span>
        </h1>
        <div className="mt-5 flex w-full flex-col gap-3 sm:mt-8 sm:flex-row sm:justify-center">
          <Link
            href="/daily"
            className="rounded-full border-4 border-stone-900 bg-amber-400 px-6 py-3 text-base font-black text-stone-900 shadow-[0_6px_0_0_rgba(0,0,0,0.9)] transition active:translate-y-1 active:shadow-[0_2px_0_0_rgba(0,0,0,0.9)] sm:px-8 sm:py-4 sm:text-lg"
          >
            Play today&rsquo;s song
          </Link>
          <Link
            href="/rooms"
            className="rounded-full border-4 border-stone-900 bg-stone-50 px-6 py-3 text-base font-black text-stone-900 shadow-[0_6px_0_0_rgba(0,0,0,0.9)] transition active:translate-y-1 active:shadow-[0_2px_0_0_rgba(0,0,0,0.9)] sm:px-8 sm:py-4 sm:text-lg"
          >
            Play with Friends
          </Link>
        </div>

        <HomeStats />
        <ActiveEventBanner />
        <div className="mt-6 w-full">
          <StarterPackOffer />
        </div>
        <HomeHelpLinks />
      </section>

    </main>
  );
}
