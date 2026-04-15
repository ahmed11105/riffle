// Server-side track picker shared by the room advance route.
// Turns a set of genre chip IDs + an optional free-text artist query into a
// clean iTunes track, avoiding karaoke / compilation albums via the filter
// already in lib/itunes.ts.

import { itunesSearch, type RiffleTrack } from "@/lib/itunes";

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

const MIX_SEEDS = [
  "billboard hot 100",
  "top hits 2024",
  "rock anthems",
  "classic rock",
  "90s hits",
  "2000s hits",
  "2010s hits",
  "hip hop hits",
  "indie pop",
];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export async function pickTrack(opts: {
  genres?: string[];
  artistQuery?: string | null;
  exclude?: string[];
}): Promise<RiffleTrack | null> {
  const { genres = [], artistQuery, exclude = [] } = opts;

  // Build candidate seed list: artist query (if present) first, then genres,
  // else mix.
  const seeds: string[] = [];
  if (artistQuery && artistQuery.trim()) {
    seeds.push(artistQuery.trim());
  }
  if (genres.length) {
    for (const g of genres) seeds.push(...(CATEGORY_SEEDS[g] ?? []));
  } else if (!artistQuery) {
    seeds.push(...MIX_SEEDS);
  }

  const unique = [...new Set(seeds)];
  const picks = shuffle(unique).slice(0, 3);
  for (const seed of picks) {
    const results = await itunesSearch(seed, 25).catch(() => []);
    const filtered = results.filter((t) => !exclude.includes(t.id));
    if (filtered.length) {
      return filtered[Math.floor(Math.random() * filtered.length)];
    }
  }
  return null;
}
