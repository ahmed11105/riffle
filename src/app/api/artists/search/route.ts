import { NextRequest, NextResponse } from "next/server";
import { itunesSearch } from "@/lib/itunes";

// Lightweight artist typeahead. We combine two iTunes searches:
//   1. `entity=musicArtist`, surfaces artists whose name matches the term
//      directly. This catches small/stylized artists (e.g. "MICO") whose
//      songs don't dominate the general song-search results.
//   2. `itunesSearch` (song entity), ranks artists by how many of their
//      tracks hit the term, which gives us a popularity ordering.
// We merge the two, prefer artists whose name starts with the typed prefix,
// and dedupe case-insensitively so "mico" surfaces "MICO".
export async function GET(req: NextRequest) {
  const term = req.nextUrl.searchParams.get("q")?.trim();
  if (!term || term.length < 2) return NextResponse.json({ artists: [] });
  const lowerTerm = term.toLowerCase();

  try {
    const [artistDirect, trackResults] = await Promise.all([
      fetchArtistEntities(term).catch(() => []),
      itunesSearch(term, 25).catch(() => []),
    ]);

    // Build case-insensitive map keyed by lowercase name so duplicates
    // across the two sources collapse and typed casing doesn't matter.
    type Row = { name: string; score: number; direct: boolean };
    const byKey = new Map<string, Row>();

    for (const name of artistDirect) {
      if (!name) continue;
      const key = name.toLowerCase();
      const existing = byKey.get(key);
      // Artist-entity hits get a big base score so they always out-rank
      // incidental song-search matches.
      const score = 1000 + (key.startsWith(lowerTerm) ? 500 : 0);
      if (!existing || score > existing.score) {
        byKey.set(key, { name, score, direct: true });
      }
    }

    for (const t of trackResults) {
      if (!t.artist) continue;
      // iTunes song results carry full credit lines as artistName (e.g.
      // "eaJ, Safari Riot & VALORANT Music"). Split off the lead credit so
      // we count it against the canonical artist, not the collab string.
      const primary = primaryArtist(t.artist);
      if (!primary) continue;
      const key = primary.toLowerCase();
      const existing = byKey.get(key);
      const bonus = key.startsWith(lowerTerm) ? 50 : 0;
      if (!existing) {
        byKey.set(key, { name: primary, score: 1 + bonus, direct: false });
      } else if (!existing.direct) {
        existing.score += 1;
      }
    }

    const artists = [...byKey.values()]
      .sort((a, b) => b.score - a.score)
      .map((r) => r.name)
      .slice(0, 8);
    return NextResponse.json({ artists });
  } catch (e) {
    return NextResponse.json({ artists: [], error: String(e) }, { status: 500 });
  }
}

// Collapse credit strings like "A, B & C featuring D" down to "A". Covers
// the separators iTunes actually uses in the artistName field.
function primaryArtist(credit: string): string {
  return credit
    .split(/\s*(?:,|&|\bfeat\.?\b|\bfeaturing\b|\bwith\b|\bvs\.?\b|\bx\b|\/)\s*/i)[0]
    .trim();
}

async function fetchArtistEntities(term: string): Promise<string[]> {
  const u = new URL("https://itunes.apple.com/search");
  u.searchParams.set("term", term);
  u.searchParams.set("media", "music");
  u.searchParams.set("entity", "musicArtist");
  u.searchParams.set("attribute", "artistTerm");
  u.searchParams.set("limit", "15");
  const res = await fetch(u.toString(), { next: { revalidate: 3600 } });
  if (!res.ok) return [];
  const json = (await res.json()) as {
    results?: { artistName?: string; wrapperType?: string }[];
  };
  return (json.results ?? [])
    .filter((r) => r.wrapperType === "artist" && r.artistName)
    .map((r) => r.artistName as string);
}
