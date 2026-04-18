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

// Returns the lead (first-credited) artist from an iTunes artistName
// string, which can look like "Vaultboy", "eaJ featuring Mikel Stevens", or
// "Vaultboy, eaJ & Some Kid". We strip everything after the first collab
// separator so callers can compare identity on the primary performer only.
function primaryArtist(artistName: string): string {
  return artistName
    .split(/\s*(?:,|&|\bfeat\.?\b|\bfeaturing\b|\bwith\b|\bvs\.?\b|\bx\b|\/)\s*/i)[0]
    .trim();
}

export async function pickTrack(opts: {
  genres?: string[];
  artistQuery?: string | null;
  exclude?: string[];
  // When false (default), tracks where the requested artist only appears as
  // a featured performer are rejected. Flip this on via the lobby's
  // "Advanced settings" to include feature-only appearances.
  allowFeaturedTracks?: boolean;
}): Promise<RiffleTrack | null> {
  const {
    genres = [],
    artistQuery,
    exclude = [],
    allowFeaturedTracks = false,
  } = opts;

  // Build candidate seed list. `artistQuery` may be a comma-separated list
  // (the host can add multiple artists in the lobby), each artist becomes
  // its own seed so a round can come from any of them at random.
  const artistSeeds = (artistQuery ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const seeds: { term: string; artist: string | null }[] = [];
  if (artistSeeds.length) {
    for (const a of artistSeeds) seeds.push({ term: a, artist: a });
  }
  if (genres.length) {
    for (const g of genres) {
      for (const s of CATEGORY_SEEDS[g] ?? []) seeds.push({ term: s, artist: null });
    }
  } else if (artistSeeds.length === 0) {
    for (const s of MIX_SEEDS) seeds.push({ term: s, artist: null });
  }

  const seen = new Set<string>();
  const unique = seeds.filter((s) => {
    const k = `${s.artist ?? ""}::${s.term}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const picks = shuffle(unique).slice(0, 3);
  for (const seed of picks) {
    const results = await itunesSearch(seed.term, 25).catch(() => []);
    let filtered = results.filter((t) => !exclude.includes(t.id));
    if (seed.artist && !allowFeaturedTracks) {
      const target = seed.artist.toLowerCase();
      filtered = filtered.filter(
        (t) => primaryArtist(t.artist).toLowerCase() === target,
      );
    }
    if (filtered.length) {
      return filtered[Math.floor(Math.random() * filtered.length)];
    }
  }
  return null;
}
