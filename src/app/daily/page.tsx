import Link from "next/link";
import { DailyGame } from "./DailyGame";
import { Logo } from "@/components/branding/Logo";

async function fetchTodayTrack() {
  "use cache";
  const { itunesSearch } = await import("@/lib/itunes");
  // Seed by date so everyone gets the same "daily" song (MVP — no DB yet).
  const seeds = [
    "top hits 2024",
    "billboard hot 100",
    "pop hits",
    "rock anthems",
    "2010s hits",
    "2000s hits",
    "90s hits",
    "rap hits",
  ];
  const today = new Date();
  const dayKey = `${today.getUTCFullYear()}-${today.getUTCMonth()}-${today.getUTCDate()}`;
  let hash = 0;
  for (const ch of dayKey) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  const seed = seeds[Math.abs(hash) % seeds.length];
  const tracks = await itunesSearch(seed, 50);
  const pick = tracks[Math.abs(hash) % Math.max(1, tracks.length)];
  return pick ?? null;
}

export default async function DailyPage() {
  const track = await fetchTodayTrack();
  return (
    <main className="flex flex-1 flex-col items-center px-4 py-8">
      <header className="flex w-full max-w-md items-center justify-between gap-3">
        <Link href="/"><Logo /></Link>
        <span className="rounded-full border-2 border-stone-900 bg-stone-50 px-3 py-1 text-xs font-black text-stone-900">
          🔥 0
        </span>
      </header>
      <h1 className="mt-6 text-3xl font-black text-amber-100">Today&rsquo;s Riffle</h1>
      <p className="mb-6 text-sm text-amber-100/60">A fresh song every day</p>
      {track ? (
        <DailyGame track={track} />
      ) : (
        <p className="text-amber-100/70">Couldn&rsquo;t load today&rsquo;s song. Try again soon.</p>
      )}
    </main>
  );
}
