// Spotify Web API helper, client credentials flow (server-side only).
// Used to discover album tracklists that iTunes Search can't surface
// (e.g. older NOW compilations). We still resolve preview URLs via
// iTunes since that's what the audio player uses.

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 30_000) {
    return cachedToken.token;
  }
  const id = process.env.SPOTIFY_CLIENT_ID;
  const secret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!id || !secret) throw new Error("Spotify credentials not configured");

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error(`Spotify token request failed: ${res.status}`);
  const json = (await res.json()) as {
    access_token: string;
    expires_in: number;
  };
  cachedToken = {
    token: json.access_token,
    expiresAt: Date.now() + json.expires_in * 1000,
  };
  return cachedToken.token;
}

export type SpotifyTrack = {
  title: string;
  artist: string;
  album: string;
  durationMs: number;
  isrc: string | null;
};

export type SpotifyAlbumResult = {
  albumName: string;
  tracks: SpotifyTrack[];
};

// Search for an album by name and return its full tracklist.
export async function spotifyAlbumTracks(
  query: string,
): Promise<SpotifyAlbumResult | null> {
  const token = await getToken();

  // Step 1: search for the album.
  const searchUrl = new URL("https://api.spotify.com/v1/search");
  searchUrl.searchParams.set("q", query);
  searchUrl.searchParams.set("type", "album");
  searchUrl.searchParams.set("market", "GB");
  searchUrl.searchParams.set("limit", "10");
  const searchRes = await fetch(searchUrl.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!searchRes.ok) return null;
  const searchJson = (await searchRes.json()) as {
    albums?: {
      items?: {
        id: string;
        name: string;
      }[];
    };
  };

  // Find the best match. The name must follow the pattern
  //   "Now That's What I Call Music! <number>"
  // to avoid parodies like "Now That's What I Call Skate Music Vol. 3".
  const volMatch = query.match(/(\d+)\s*$/);
  const targetVol = volMatch ? volMatch[1] : null;
  const albums = searchJson.albums?.items ?? [];
  const album = albums.find((a) => {
    if (!/now\s+that'?s\s+what\s+i\s+call\s+music!?\s+\d+$/i.test(a.name))
      return false;
    if (!targetVol) return true;
    const nums = [...a.name.matchAll(/\d+/g)].map((m) => m[0]);
    return nums.includes(targetVol);
  });
  if (!album) return null;

  // Step 2: get the album's tracks (paginated, up to 50 per page).
  const allTracks: SpotifyTrack[] = [];
  let nextUrl: string | null =
    `https://api.spotify.com/v1/albums/${album.id}/tracks?limit=50&market=GB`;
  while (nextUrl) {
    const tracksRes = await fetch(nextUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!tracksRes.ok) break;
    const tracksJson = (await tracksRes.json()) as {
      items?: {
        name: string;
        artists: { name: string }[];
        duration_ms: number;
        external_ids?: { isrc?: string };
      }[];
      next?: string | null;
    };
    for (const t of tracksJson.items ?? []) {
      allTracks.push({
        title: t.name,
        artist: t.artists.map((a) => a.name).join(", "),
        album: album.name,
        durationMs: t.duration_ms,
        isrc: t.external_ids?.isrc ?? null,
      });
    }
    nextUrl = tracksJson.next ?? null;
  }

  return { albumName: album.name, tracks: allTracks };
}
