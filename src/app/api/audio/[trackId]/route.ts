import { NextRequest, NextResponse } from "next/server";
import { itunesLookup } from "@/lib/itunes";

// Proxy audio through our origin so it's not blocked by ORB and we can cache.
// Accepts ?src=<previewUrl> with the iTunes preview URL (signed per-session),
// or falls back to lookup by trackId.

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ trackId: string }> },
) {
  const { trackId } = await params;
  const src = req.nextUrl.searchParams.get("src");

  let url = src;
  if (!url) {
    const numeric = trackId.replace(/^itunes-/, "");
    const track = await itunesLookup(Number(numeric));
    if (!track) return new NextResponse("not found", { status: 404 });
    url = track.previewUrl;
  }

  const upstream = await fetch(url);
  if (!upstream.ok || !upstream.body) {
    return new NextResponse("upstream failed", { status: 502 });
  }
  return new NextResponse(upstream.body, {
    headers: {
      "Content-Type": "audio/mp4",
      "Cache-Control": "public, max-age=86400, immutable",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
