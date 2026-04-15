import { NextRequest, NextResponse } from "next/server";
import { itunesSearch } from "@/lib/itunes";

// Curated seed terms used when no category is chosen. Designed to surface
// real recordings, not karaoke compilations.
const MIX_SEEDS = [
  "top hits 2024",
  "billboard hot 100",
  "top pop hits",
  "dance hits",
  "rap hits",
  "rock anthems",
  "classic rock",
  "90s hits",
  "2000s hits",
  "2010s hits",
  "indie pop",
  "r&b hits",
  "latin hits",
];

const CATEGORY_SEEDS: Record<string, string[]> = {
  popular: ["top hits 2024", "billboard hot 100", "top pop hits"],
  "2020s": ["hits 2024", "hits 2023", "hits 2022", "hits 2021", "hits 2020"],
  "2010s": ["hits 2019", "hits 2015", "hits 2012", "hits 2010"],
  "2000s": ["hits 2008", "hits 2005", "hits 2002", "hits 2000"],
  "90s": ["hits 1999", "hits 1995", "hits 1992", "hits 1990"],
  "80s": ["hits 1989", "hits 1985", "hits 1982", "hits 1980"],
  rock: ["rock anthems", "classic rock hits", "alternative rock"],
  hiphop: ["rap hits", "hip hop hits"],
  rnb: ["r&b hits", "neo soul"],
  dance: ["dance hits", "edm"],
  indie: ["indie pop", "indie rock"],
  latin: ["latin hits", "reggaeton"],
};

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export async function GET(req: NextRequest) {
  const categories = req.nextUrl.searchParams.getAll("cat");
  const seeds = categories.length
    ? categories.flatMap((c) => CATEGORY_SEEDS[c] ?? []).filter(Boolean)
    : MIX_SEEDS;
  const pick = shuffle(seeds).slice(0, 3);
  const batches = await Promise.all(pick.map((s) => itunesSearch(s, 25).catch(() => [])));
  const merged = shuffle(batches.flat()).slice(0, 30);
  return NextResponse.json({ tracks: merged });
}
