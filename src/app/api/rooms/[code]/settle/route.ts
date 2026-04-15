import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { payoutFor, type ClipLevel } from "@/lib/game/wager";
import { fuzzyMatchTitle } from "@/lib/utils";

// Settles a reveal: reads wagers + guesses, applies wager math to each
// player's bank, and bumps correct_count. Idempotent-ish: re-running it on an
// already-settled round is a no-op because we re-derive from jsonb records.
// Invoked by the host right before transitioning reveal → wager.

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const supabase = await createClient();

  const { data: room } = await supabase
    .from("rooms")
    .select("*")
    .eq("code", code)
    .single();
  if (!room) {
    return NextResponse.json({ error: "room not found" }, { status: 404 });
  }

  const { data: round } = await supabase
    .from("room_rounds")
    .select("*")
    .eq("room_code", code)
    .eq("round_num", room.current_round)
    .single();
  if (!round || !round.track_id) {
    return NextResponse.json({ error: "round not found" }, { status: 404 });
  }

  const { data: track } = await supabase
    .from("tracks")
    .select("title")
    .eq("id", round.track_id)
    .single();
  if (!track) {
    return NextResponse.json({ error: "track not found" }, { status: 404 });
  }

  const { data: players } = await supabase
    .from("room_players")
    .select("*")
    .eq("room_code", code);
  if (!players) {
    return NextResponse.json({ error: "players not found" }, { status: 500 });
  }

  const wagers = (round.wagers ?? {}) as Record<
    string,
    { amount: number; level: ClipLevel }
  >;
  const guesses = (round.guesses ?? {}) as Record<
    string,
    { value: string; correct: boolean; clip_level: ClipLevel; time_ms: number }
  >;

  const updates = players.map((p) => {
    const wager = wagers[p.display_name];
    const guess = guesses[p.display_name];
    let delta = 0;
    let solvedBonus = 0;
    if (wager) {
      const correct = Boolean(
        guess?.correct || (guess && fuzzyMatchTitle(guess.value, track.title)),
      );
      const promised = wager.level;
      const actual = guess?.clip_level ?? 16;
      delta = payoutFor(promised, actual as ClipLevel, wager.amount, correct);
      solvedBonus = correct ? 1 : 0;
    }
    return {
      room_code: code,
      display_name: p.display_name,
      bank: Math.max(0, p.bank + delta),
      correct_count: p.correct_count + solvedBonus,
    };
  });

  for (const u of updates) {
    await supabase
      .from("room_players")
      .update({ bank: u.bank, correct_count: u.correct_count })
      .eq("room_code", u.room_code)
      .eq("display_name", u.display_name);
  }

  return NextResponse.json({ settled: updates.length });
}
