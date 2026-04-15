import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateRoomCode } from "@/lib/rooms";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    rounds?: number;
    starting_bank?: number;
    genres?: string[];
    artist_query?: string | null;
  };
  const supabase = await createClient();

  for (let i = 0; i < 5; i++) {
    const code = generateRoomCode();
    const { error } = await supabase.from("rooms").insert({
      code,
      status: "lobby",
      mode: "wager",
      rounds_total: Math.max(3, Math.min(20, body.rounds ?? 10)),
      current_round: 0,
      starting_bank: Math.max(50, Math.min(500, body.starting_bank ?? 100)),
      genres: Array.isArray(body.genres) ? body.genres.slice(0, 12) : [],
      artist_query: typeof body.artist_query === "string" ? body.artist_query.slice(0, 80) : null,
      paused: false,
    });
    if (!error) return NextResponse.json({ code });
    if (error.code !== "23505") {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }
  return NextResponse.json({ error: "failed to allocate code" }, { status: 500 });
}
