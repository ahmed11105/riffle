import { NextRequest, NextResponse } from "next/server";
import { spotifyAlbumTracks } from "@/lib/spotify";

type ItunesResult = {
  wrapperType?: string;
  collectionType?: string;
  collectionId?: number;
  collectionName?: string;
  trackId?: number;
  trackName?: string;
  artistName?: string;
  previewUrl?: string;
  artworkUrl100?: string;
  trackTimeMillis?: number;
  releaseDate?: string;
};

type TrackOut = {
  id: string;
  source: string;
  title: string;
  artist: string;
  album: string;
  albumArtUrl: string;
  previewUrl: string;
  durationMs: number;
  releaseYear: number | null;
};

// In-memory cache for iTunes preview lookups so the same song isn't
// searched twice across different NOW album requests.
const itunesCache = new Map<string, TrackOut | null>();

// Album tracklist lookup. Tries iTunes first (works for recent NOW
// albums), then falls back to Spotify for discovery + iTunes for preview
// URLs. This covers the full NOW series because Spotify indexes every
// compilation album, while iTunes Search only surfaces the latest ~4.

export async function GET(req: NextRequest) {
  const term = req.nextUrl.searchParams.get("q")?.trim();
  if (!term) return NextResponse.json({ tracks: [], albumName: null });

  try {
    // --- Attempt 1: iTunes album search (US + GB stores) ---------------
    const itunesResult = await tryItunes(term);
    if (itunesResult && itunesResult.tracks.length > 0) {
      return NextResponse.json(itunesResult);
    }

    // --- Attempt 2: Spotify discovery → iTunes preview resolution ------
    const spotifyResult = await trySpotifyWithItunes(term);
    if (spotifyResult && spotifyResult.tracks.length > 0) {
      return NextResponse.json(spotifyResult);
    }

    return NextResponse.json({
      tracks: [],
      albumName: itunesResult?.albumName ?? spotifyResult?.albumName ?? null,
    });
  } catch (e) {
    return NextResponse.json(
      { tracks: [], albumName: null, error: String(e) },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// iTunes path: search both US + GB stores, strict volume matching
// ---------------------------------------------------------------------------
async function tryItunes(
  term: string,
): Promise<{ albumName: string | null; tracks: TrackOut[] } | null> {
  const stores = ["US", "GB"];
  const allAlbums: (ItunesResult & { _country: string })[] = [];
  for (const country of stores) {
    const u = new URL("https://itunes.apple.com/search");
    u.searchParams.set("term", term);
    u.searchParams.set("media", "music");
    u.searchParams.set("entity", "album");
    u.searchParams.set("limit", "25");
    u.searchParams.set("country", country);
    const res = await fetch(u.toString());
    if (!res.ok) continue;
    const json = (await res.json()) as { results: ItunesResult[] };
    for (const r of json.results ?? []) {
      if (
        r.wrapperType === "collection" &&
        r.collectionType === "Album" &&
        r.collectionId
      )
        allAlbums.push({ ...r, _country: country });
    }
  }

  const volMatch = term.match(/(\d+)\s*$/);
  const targetVol = volMatch ? volMatch[1] : null;
  function isMatch(r: ItunesResult): boolean {
    const name = (r.collectionName ?? "").toLowerCase();
    if (!name.includes("now") || !name.includes("music")) return false;
    if (!targetVol) return true;
    return new RegExp(`\\b${targetVol}\\b`).test(r.collectionName ?? "");
  }

  const seen = new Set<number>();
  const matches = allAlbums.filter((r) => {
    if (!isMatch(r)) return false;
    if (seen.has(r.collectionId!)) return false;
    seen.add(r.collectionId!);
    return true;
  });

  const album = matches[0];
  if (!album?.collectionId) return null;

  const lookupUrl = new URL("https://itunes.apple.com/lookup");
  lookupUrl.searchParams.set("id", String(album.collectionId));
  lookupUrl.searchParams.set("entity", "song");
  lookupUrl.searchParams.set("limit", "200");
  lookupUrl.searchParams.set("country", album._country);
  const lookupRes = await fetch(lookupUrl.toString());
  if (!lookupRes.ok)
    return { albumName: album.collectionName ?? null, tracks: [] };
  const lookupJson = (await lookupRes.json()) as {
    results: ItunesResult[];
  };
  const tracks: TrackOut[] = (lookupJson.results ?? [])
    .filter((r) => r.wrapperType === "track" && r.previewUrl && r.trackId)
    .map((r) => ({
      id: `itunes-${r.trackId}`,
      source: "itunes",
      title: r.trackName ?? "",
      artist: r.artistName ?? "",
      album: r.collectionName ?? album.collectionName ?? "",
      albumArtUrl: (r.artworkUrl100 ?? "").replace("100x100", "512x512"),
      previewUrl: r.previewUrl!,
      durationMs: r.trackTimeMillis ?? 0,
      releaseYear: r.releaseDate
        ? new Date(r.releaseDate).getUTCFullYear()
        : null,
    }));
  return { albumName: album.collectionName ?? null, tracks };
}

// ---------------------------------------------------------------------------
// Spotify path: get tracklist from Spotify, resolve each via iTunes search
// ---------------------------------------------------------------------------
async function trySpotifyWithItunes(
  term: string,
): Promise<{ albumName: string | null; tracks: TrackOut[] } | null> {
  const spotify = await spotifyAlbumTracks(term).catch(() => null);
  if (!spotify || spotify.tracks.length === 0) return null;

  // Resolve each Spotify track to an iTunes preview URL. iTunes rate-
  // limits at ~20 req/min so we batch 3 at a time with 3s gaps. Resolved
  // tracks are cached in-memory so repeat loads are instant.
  const tracks: TrackOut[] = [];
  const BATCH = 3;
  const uncached: { idx: number; st: (typeof spotify.tracks)[0] }[] = [];
  // First pass: serve from cache, collect misses.
  for (let i = 0; i < spotify.tracks.length; i++) {
    const st = spotify.tracks[i];
    const key = `${st.title}::${st.artist}`.toLowerCase();
    const cached = itunesCache.get(key);
    if (cached !== undefined) {
      if (cached) tracks.push({ ...cached, album: spotify.albumName });
    } else {
      uncached.push({ idx: i, st });
    }
  }
  // Second pass: resolve misses in rate-limited batches.
  for (let i = 0; i < uncached.length; i += BATCH) {
    const chunk = uncached.slice(i, i + BATCH);
    const results = await Promise.all(
      chunk.map(({ st }) => resolveItunesPreview(st.title, st.artist)),
    );
    for (let j = 0; j < chunk.length; j++) {
      const key =
        `${chunk[j].st.title}::${chunk[j].st.artist}`.toLowerCase();
      itunesCache.set(key, results[j]);
      if (results[j]) {
        tracks.push({ ...results[j]!, album: spotify.albumName });
      }
    }
    if (i + BATCH < uncached.length) {
      await new Promise((r) => setTimeout(r, 3000));
    }
  }

  return { albumName: spotify.albumName, tracks };
}

async function resolveItunesPreview(
  title: string,
  artist: string,
): Promise<TrackOut | null> {
  const u = new URL("https://itunes.apple.com/search");
  u.searchParams.set("term", `${title} ${artist}`);
  u.searchParams.set("media", "music");
  u.searchParams.set("entity", "song");
  u.searchParams.set("limit", "5");
  u.searchParams.set("country", "US");
  const res = await fetch(u.toString());
  if (!res.ok) return null;
  let json: { results?: ItunesResult[] };
  try {
    json = (await res.json()) as { results?: ItunesResult[] };
  } catch {
    return null;
  }

  const lc = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  const lt = lc(title);
  const la = lc(artist).split(" ")[0];
  for (const r of json.results ?? []) {
    if (!r.previewUrl || !r.trackId) continue;
    const rt = lc(r.trackName ?? "");
    const ra = lc(r.artistName ?? "");
    if ((rt.includes(lt) || lt.includes(rt)) && ra.includes(la)) {
      return {
        id: `itunes-${r.trackId}`,
        source: "itunes",
        title: r.trackName ?? title,
        artist: r.artistName ?? artist,
        album: "",
        albumArtUrl: (r.artworkUrl100 ?? "").replace("100x100", "512x512"),
        previewUrl: r.previewUrl,
        durationMs: r.trackTimeMillis ?? 0,
        releaseYear: r.releaseDate
          ? new Date(r.releaseDate).getUTCFullYear()
          : null,
      };
    }
  }
  return null;
}
