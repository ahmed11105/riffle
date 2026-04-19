import { NextResponse } from "next/server";
import { itunesLookup } from "@/lib/itunes";

// Lookup extra metadata for a Solo/Room pool track that doesn't ship
// genre/releaseYear inline (now-pool.json was built before hints existed).
// Called by HintPanel when the user buys a hint whose field is missing on
// the local track object.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const trackId = url.searchParams.get("trackId");
  if (!trackId) {
    return NextResponse.json({ error: "trackId required" }, { status: 400 });
  }
  const numeric = Number(trackId.replace(/^itunes-/, ""));
  if (!Number.isFinite(numeric)) {
    return NextResponse.json({ error: "invalid trackId" }, { status: 400 });
  }
  const track = await itunesLookup(numeric);
  if (!track) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({
    genre: track.genre ?? null,
    releaseYear: track.releaseYear ?? null,
    artist: track.artist ?? null,
  });
}
