import Link from "next/link";
import { Logo } from "@/components/branding/Logo";
import { Mascot } from "@/components/branding/Mascot";
import { HomeStats } from "@/components/HomeStats";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center px-6 py-4 text-[--color-foreground] sm:py-10">
      <header className="flex w-full max-w-5xl items-center justify-between">
        <Logo />
        <nav className="hidden items-center gap-6 text-sm font-bold uppercase tracking-wider sm:flex">
          <Link href="/daily" className="hover:text-amber-300">Daily</Link>
          <Link href="/solo" className="hover:text-amber-300">Solo</Link>
          <Link href="/rooms" className="hover:text-amber-300">Rooms</Link>
          <Link href="/leaderboard" className="hover:text-amber-300">Leaderboard</Link>
          <Link
            href="/shop"
            className="inline-flex items-center rounded-full border-2 border-stone-900 bg-amber-400 px-3 py-1 text-stone-900 shadow-[0_2px_0_0_rgba(0,0,0,0.9)] transition hover:bg-amber-300 active:translate-y-0.5 active:shadow-[0_1px_0_0_rgba(0,0,0,0.9)]"
          >
            Shop
          </Link>
        </nav>
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
        {/* Hide the long description on phones to keep the CTAs above the
            fold. Desktop keeps the pitch. */}
        <p className="mt-5 hidden max-w-md text-lg text-amber-100/70 sm:block">
          Riffle is a daily song-guessing game you can play solo, share with
          friends, or play live in rooms with a points-based wager mechanic.
          One second of a song is all you need. Probably.
        </p>

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
      </section>

    </main>
  );
}
