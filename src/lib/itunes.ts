// iTunes Search API adapter.
// Docs: https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI/
// No auth, no rate-limit published (~20/min soft). Returns 30s previewUrl on clean AAC/M4A.

export type RiffleTrack = {
  id: string;
  source: "itunes";
  title: string;
  artist: string;
  album: string;
  albumArtUrl: string;
  previewUrl: string;
  durationMs: number;
  releaseYear?: number;
  genre?: string;
};

const BAD_ARTIST_PATTERNS = [
  /\bkaraoke\b/i,
  /\binstrumental\b/i,
  /\bcover version\b/i,
  /\btribute\b/i,
  /\bhits?\b/i,
  /\bbest (of|guitar|rock|pop)\b/i,
  /\brockhits\b/i,
  /\bclassic rock heroes\b/i,
  /\bparty dj\b/i,
  /\bdrunken\b/i,
  /\bthe rock band\b/i,
  /\bstudy music\b/i,
];

export function isCleanTrack(artist: string, trackName: string): boolean {
  if (BAD_ARTIST_PATTERNS.some((re) => re.test(artist))) return false;
  if (/\(karaoke|instrumental|cover|tribute|made popular/i.test(trackName)) return false;
  return true;
}

export function hiresArtwork(url100: string): string {
  // iTunes returns 100x100 by default; swap for 600x600.
  return url100.replace(/\/\d+x\d+bb\.(jpg|png)/, "/600x600bb.$1");
}

type ItunesResult = {
  trackId: number;
  trackName: string;
  artistName: string;
  collectionName?: string;
  previewUrl?: string;
  artworkUrl100?: string;
  trackTimeMillis?: number;
  releaseDate?: string;
  primaryGenreName?: string;
};

type ItunesSearchResponse = {
  resultCount: number;
  results: ItunesResult[];
};

function toRiffleTrack(r: ItunesResult): RiffleTrack | null {
  if (!r.previewUrl || !r.artworkUrl100) return null;
  if (!isCleanTrack(r.artistName, r.trackName)) return null;
  return {
    id: `itunes-${r.trackId}`,
    source: "itunes",
    title: r.trackName,
    artist: r.artistName,
    album: r.collectionName ?? "",
    albumArtUrl: hiresArtwork(r.artworkUrl100),
    previewUrl: r.previewUrl,
    durationMs: r.trackTimeMillis ?? 0,
    releaseYear: r.releaseDate ? new Date(r.releaseDate).getFullYear() : undefined,
    genre: r.primaryGenreName,
  };
}

export async function itunesSearch(term: string, limit = 25): Promise<RiffleTrack[]> {
  const u = new URL("https://itunes.apple.com/search");
  u.searchParams.set("term", term);
  u.searchParams.set("media", "music");
  u.searchParams.set("entity", "song");
  u.searchParams.set("limit", String(limit));
  u.searchParams.set("explicit", "Yes");
  const res = await fetch(u.toString(), { next: { revalidate: 3600 } });
  if (!res.ok) throw new Error(`iTunes search failed: ${res.status}`);
  const json = (await res.json()) as ItunesSearchResponse;
  return json.results.map(toRiffleTrack).filter((t): t is RiffleTrack => t !== null);
}

export async function itunesLookup(trackId: number): Promise<RiffleTrack | null> {
  const u = new URL("https://itunes.apple.com/lookup");
  u.searchParams.set("id", String(trackId));
  const res = await fetch(u.toString(), { next: { revalidate: 86400 } });
  if (!res.ok) return null;
  const json = (await res.json()) as ItunesSearchResponse;
  const r = json.results?.[0];
  return r ? toRiffleTrack(r) : null;
}
