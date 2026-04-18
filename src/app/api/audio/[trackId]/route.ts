import { NextRequest, NextResponse } from "next/server";
import { itunesLookup } from "@/lib/itunes";

// Redirect to Apple's CDN for the preview m4a. We originally proxied to
// dodge Opaque Response Blocking, but ORB is a fetch()-only concern, the
// HTML <audio> element is safe to point at a cross-origin URL, and going
// direct lets Apple's CDN serve proper HTTP Range (206) responses, which
// iOS Safari requires before it will play back the clip at all.
// Accepts ?src=<previewUrl>, or falls back to iTunes lookup by trackId.

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

  return NextResponse.redirect(url, 302);
}
