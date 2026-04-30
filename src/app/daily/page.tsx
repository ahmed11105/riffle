import { Suspense } from "react";
import { connection } from "next/server";
import { DailyGame } from "./DailyGame";
import { createClient } from "@/lib/supabase/server";
import type { RiffleTrack } from "@/lib/itunes";
import { dayKeyFor, pickTrackForDay, toRiffleTrack } from "@/lib/daily/pick";
import { obfuscateTitle } from "@/lib/obfuscate";

async function TodayTrack() {
  await connection();
  const today = new Date();
  const key = dayKeyFor(today);

  // Check for a server-side override first (admin-curated daily).
  const supabase = await createClient();
  const { data: override } = await supabase
    .from("daily_overrides")
    .select("*")
    .eq("day_key", key)
    .maybeSingle();

  if (override?.preview_url) {
    const track: RiffleTrack = {
      id: override.track_id,
      source: "itunes",
      title: obfuscateTitle(override.title),
      artist: override.artist,
      album: override.album ?? "",
      albumArtUrl: override.album_art_url ?? "",
      previewUrl: override.preview_url,
      durationMs: override.duration_ms ?? 0,
      releaseYear: override.release_year ?? undefined,
    };
    return <DailyGame track={track} />;
  }

  // Fallback: hash-pick from the static NOW pool.
  const pick = pickTrackForDay(key);
  if (!pick) {
    return (
      <p className="text-amber-100/70">
        Couldn&rsquo;t load today&rsquo;s song. Try again soon.
      </p>
    );
  }
  const riffleTrack = toRiffleTrack(pick);
  riffleTrack.title = obfuscateTitle(riffleTrack.title);
  return <DailyGame track={riffleTrack} />;
}

function DailyGameSkeleton() {
  return (
    <div className="flex min-h-[240px] w-full max-w-md flex-col items-center justify-center gap-3 text-amber-100/70">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-amber-300 border-t-transparent" />
      <p className="text-sm">Loading today&rsquo;s song…</p>
    </div>
  );
}

export default function DailyPage() {
  return (
    <main className="flex flex-1 flex-col items-center px-6 py-10">
      <h1 className="mt-6 text-3xl font-black text-amber-100">Today&rsquo;s Riffle</h1>
      <p className="mb-6 text-sm text-amber-100/60">A fresh song every day</p>
      <Suspense fallback={<DailyGameSkeleton />}>
        <TodayTrack />
      </Suspense>
    </main>
  );
}
