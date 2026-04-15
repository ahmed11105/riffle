import Link from "next/link";
import { Logo } from "@/components/branding/Logo";
import { Mascot } from "@/components/branding/Mascot";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center px-6 py-10 text-[--color-foreground]">
      <header className="flex w-full max-w-5xl items-center justify-between">
        <Logo />
        <nav className="hidden gap-6 text-sm font-bold uppercase tracking-wider sm:flex">
          <Link href="/daily" className="hover:text-amber-300">Daily</Link>
          <Link href="/solo" className="hover:text-amber-300">Solo</Link>
          <Link href="/rooms" className="hover:text-amber-300">Rooms</Link>
        </nav>
      </header>

      <section className="mt-10 flex w-full max-w-xl flex-col items-center text-center">
        <Mascot size={140} className="mb-4 drop-shadow-[0_8px_0_rgba(0,0,0,0.9)]" />
        <h1 className="text-6xl font-black leading-none tracking-tighter text-amber-100 sm:text-7xl">
          Name the tune.<br />
          <span className="text-amber-400">Stake your claim.</span>
        </h1>
        <p className="mt-5 max-w-md text-lg text-amber-100/70">
          Riffle is a daily song-guessing game you can play solo, share with friends, or
          wager on in live rooms. One second of a song is all you need. Probably.
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

        <div className="mt-8 flex gap-6 text-sm text-amber-100/60">
          <div><span className="font-black text-amber-300">🔥 0</span> day streak</div>
          <div><span className="font-black text-amber-300">100</span> coins</div>
          <div><span className="font-black text-amber-300">Lv 1</span></div>
        </div>
      </section>

    </main>
  );
}
