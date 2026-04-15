import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Reset a finished room back to the lobby, optionally applying new config
// (genres, artist_query, rounds). Resets every player's bank and clears
// round state so the lobby can be re-configured without creating a new room.

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    genres?: string[];
    artist_query?: string | null;
    rounds?: number;
  };
  const supabase = await createClient();

  const { data: room } = await supabase
    .from("rooms")
    .select("*")
    .eq("code", code)
    .maybeSingle();
  if (!room) {
    return NextResponse.json({ error: "room not found" }, { status: 404 });
  }

  const patch: Record<string, unknown> = {
    status: "lobby",
    current_round: 0,
    paused: false,
    phase_started_at: null,
  };
  if (Array.isArray(body.genres)) patch.genres = body.genres.slice(0, 12);
  if (typeof body.artist_query === "string") patch.artist_query = body.artist_query.slice(0, 80);
  if (typeof body.rounds === "number") patch.rounds_total = Math.max(3, Math.min(20, body.rounds));

  const { error: roomErr } = await supabase.from("rooms").update(patch).eq("code", code);
  if (roomErr) return NextResponse.json({ error: roomErr.message }, { status: 500 });

  // Reset all player banks + correct_count.
  await supabase
    .from("room_players")
    .update({ bank: room.starting_bank, correct_count: 0 })
    .eq("room_code", code);

  // Clear the previous rounds so the next run starts fresh.
  await supabase.from("room_rounds").delete().eq("room_code", code);

  return NextResponse.json({ ok: true });
}
