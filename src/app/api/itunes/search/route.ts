import { NextRequest, NextResponse } from "next/server";
import { itunesSearch } from "@/lib/itunes";

// Collapse a credit string down to the lead performer so we can compare
// identity on the primary artist only (matches the logic pickTrack uses).
function primaryArtist(credit: string): string {
  return credit
    .split(/\s*(?:,|&|\bfeat\.?\b|\bfeaturing\b|\bwith\b|\bvs\.?\b|\bx\b|\/)\s*/i)[0]
    .trim();
}

export async function GET(req: NextRequest) {
  const term = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const artistsParam = req.nextUrl.searchParams.get("artists") ?? "";
  const artists = artistsParam
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  // Branch: if the caller scoped the search to specific artists, we fetch
  // each artist's catalog (iTunes cache lives an hour in itunesSearch) and
  // filter by title contains the typed query. This guarantees suggestions
  // only include songs by the artists the host has chosen. Without the
  // artist filter we fall back to a plain title search.
  try {
    if (artists.length > 0) {
      const lists = await Promise.all(
        artists.map((a) => itunesSearch(a, 50).catch(() => [])),
      );
      const seen = new Set<string>();
      const merged = lists.flat().filter((t) => {
        if (seen.has(t.id)) return false;
        seen.add(t.id);
        // Compare against the primary (first-credited) artist only so that
        // songs credited like "eaJ featuring Mikel Stevens" still count for
        // the artist "eaJ", while songs like "Vaultboy feat. eaJ" are
        // excluded because their primary artist is Vaultboy.
        const primary = primaryArtist(t.artist).toLowerCase();
        const matchesArtist = artists.some(
          (a) => primary === a.toLowerCase(),
        );
        if (!matchesArtist) return false;
        if (!term) return true;
        return t.title.toLowerCase().includes(term.toLowerCase());
      });
      return NextResponse.json({ tracks: merged.slice(0, 20) });
    }

    if (!term) return NextResponse.json({ tracks: [] });
    const tracks = await itunesSearch(term, 20);
    return NextResponse.json({ tracks });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
