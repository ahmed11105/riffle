import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminRequest, unauthorizedResponse } from "@/lib/adminAuth";

// GET: fetch all overrides (or a subset by ?keys=k1,k2,...)
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const keysParam = req.nextUrl.searchParams.get("keys");

  let query = supabase.from("daily_overrides").select("*");
  if (keysParam) {
    const keys = keysParam.split(",").filter(Boolean);
    query = query.in("day_key", keys);
  }
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ overrides: data ?? [] });
}

// POST: upsert one or more overrides. Requires admin auth. Uses the
// service role client to bypass RLS (anon can only read).
export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) return unauthorizedResponse();
  const supabase = createAdminClient();
  const body = (await req.json().catch(() => ({}))) as {
    overrides?: Record<
      string,
      {
        id: string;
        title: string;
        artist: string;
        album?: string;
        albumArtUrl?: string;
        previewUrl: string;
        durationMs?: number;
        releaseYear?: number | null;
      } | null
    >;
  };
  if (!body.overrides) {
    return NextResponse.json({ error: "missing overrides" }, { status: 400 });
  }

  const toUpsert: {
    day_key: string;
    track_id: string;
    title: string;
    artist: string;
    album: string;
    album_art_url: string;
    preview_url: string;
    duration_ms: number;
    release_year: number | null;
  }[] = [];
  const toDelete: string[] = [];

  for (const [dayKey, track] of Object.entries(body.overrides)) {
    if (!track) {
      toDelete.push(dayKey);
    } else {
      toUpsert.push({
        day_key: dayKey,
        track_id: track.id,
        title: track.title,
        artist: track.artist,
        album: track.album ?? "",
        album_art_url: track.albumArtUrl ?? "",
        preview_url: track.previewUrl,
        duration_ms: track.durationMs ?? 0,
        release_year: track.releaseYear ?? null,
      });
    }
  }

  if (toDelete.length > 0) {
    const { error } = await supabase
      .from("daily_overrides")
      .delete()
      .in("day_key", toDelete);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (toUpsert.length > 0) {
    const { error } = await supabase
      .from("daily_overrides")
      .upsert(toUpsert, { onConflict: "day_key" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, upserted: toUpsert.length, deleted: toDelete.length });
}
