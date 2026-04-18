import Link from "next/link";
import { Logo } from "@/components/branding/Logo";
import { Mascot } from "@/components/branding/Mascot";
import { HomeStats } from "@/components/HomeStats";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center px-6 py-10 text-[--color-foreground]">
      <header className="flex w-full max-w-5xl items-center justify-between">
        <Logo />
        <nav className="hidden gap-6 text-sm font-bold uppercase tracking-wider sm:flex">
          <Link href="/daily" className="hover:text-amber-300">Daily</Link>
          <Link href="/solo" className="hover:text-amber-300">Solo</Link>
          <Link href="/rooms" className="hover:text-amber-300">Rooms</Link>
          <Link href="/leaderboard" className="hover:text-amber-300">Leaderboard</Link>
          <Link href="/shop" className="hover:text-amber-300">Shop</Link>
        </nav>
      </header>

      <section className="mt-10 flex w-full max-w-xl flex-col items-center text-center">
        <Mascot size={140} className="mb-4 drop-shadow-[0_8px_0_rgba(0,0,0,0.9)]" />
        <h1 className="text-6xl font-black leading-none tracking-tighter text-amber-100 sm:text-7xl">
          Name the tune.<br />
          <span className="text-amber-400">Trust your ear.</span>
        </h1>
        <p className="mt-5 max-w-md text-lg text-amber-100/70">
          Riffle is a daily song-guessing game you can play solo, share with
          friends, or play live in rooms with a points-based wager mechanic.
          One second of a song is all you need. Probably.
        </p>

        <div className="mt-8 flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/daily"
            className="rounded-full border-4 border-stone-900 bg-amber-400 px-8 py-4 text-lg font-black text-stone-900 shadow-[0_6px_0_0_rgba(0,0,0,0.9)] transition active:translate-y-1 active:shadow-[0_2px_0_0_rgba(0,0,0,0.9)]"
          >
            Play today&rsquo;s song
          </Link>
          <Link
            href="/rooms"
            className="rounded-full border-4 border-stone-900 bg-stone-50 px-8 py-4 text-lg font-black text-stone-900 shadow-[0_6px_0_0_rgba(0,0,0,0.9)] transition active:translate-y-1 active:shadow-[0_2px_0_0_rgba(0,0,0,0.9)]"
          >
            Play with Friends
          </Link>
        </div>

        <HomeStats />
      </section>

    </main>
  );
}
