import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { pickTrack } from "@/lib/pickTrack";
import { payoutFor, type ClipLevel } from "@/lib/game/wager";
import { fuzzyMatchTitle } from "@/lib/utils";

// Advances a room's state machine. Host-only, but idempotent enough to
// tolerate double-clicks. Every transition stamps phase_started_at so
// clients can render a synchronized countdown.
//
//   lobby   → wager    (picks next track, rounds_num += 1)
//   wager   → guess
//   guess   → reveal   (settles banks)
//   reveal  → wager    (next round) OR finished
//
// Also handles settlement internally on guess→reveal so the client doesn't
// need two round trips.

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const body = (await req.json().catch(() => ({}))) as { from?: string };
  const supabase = await createClient();

  const { data: room, error: roomErr } = await supabase
    .from("rooms")
    .select("*")
    .eq("code", code)
    .single();
  if (roomErr || !room) {
    return NextResponse.json({ error: "room not found" }, { status: 404 });
  }

  // Idempotency: only advance if the caller's expected current status matches.
  // This makes it safe for multiple clients (or a fast double-click) to all
  // fire /advance simultaneously when a timer expires, only the first one
  // actually transitions; the rest no-op.
  if (body.from && body.from !== room.status) {
    return NextResponse.json({ status: room.status, skipped: true });
  }

  if (room.paused) {
    return NextResponse.json({ status: room.status, paused: true });
  }

  const now = new Date().toISOString();

  async function updateRoom(patch: Record<string, unknown>) {
    const { error } = await supabase.from("rooms").update(patch).eq("code", code);
    if (error) throw new Error(error.message);
  }

  try {
    // --- lobby or reveal → next round (wager) ---
    if (room.status === "lobby" || room.status === "reveal") {
      // Settlement for the round we're leaving.
      if (room.status === "reveal") {
        await settleRound(supabase, code, room.current_round);
      }

      const nextRound = room.current_round + 1;
      if (nextRound > room.rounds_total) {
        await updateRoom({ status: "finished", phase_started_at: now });
        return NextResponse.json({ status: "finished" });
      }

      // Collect tracks already used in this room so we don't repeat.
      const { data: used } = await supabase
        .from("room_rounds")
        .select("track_id")
        .eq("room_code", code);
      const exclude = (used ?? []).map((u) => u.track_id).filter((id): id is string => Boolean(id));

      const track = await pickTrack({
        genres: room.genres ?? [],
        artistQuery: room.artist_query ?? null,
        allowFeaturedTracks: room.allow_featured_tracks ?? false,
        exclude,
      });
      if (!track) {
        return NextResponse.json({ error: "no track available" }, { status: 502 });
      }

      const trackUpsert = await supabase.from("tracks").upsert(
        {
          id: track.id,
          source: track.source,
          title: track.title,
          artist: track.artist,
          album: track.album,
          album_art_url: track.albumArtUrl,
          preview_url: track.previewUrl,
          duration_ms: track.durationMs,
          release_year: track.releaseYear ?? null,
        },
        { onConflict: "id" },
      );
      if (trackUpsert.error) {
        console.error("[riffle/advance] track upsert failed", trackUpsert.error);
        return NextResponse.json({ error: trackUpsert.error.message }, { status: 500 });
      }

      const roundUpsert = await supabase.from("room_rounds").upsert(
        {
          room_code: code,
          round_num: nextRound,
          track_id: track.id,
          wagers: {},
          guesses: {},
          revealed_at: null,
        },
        { onConflict: "room_code,round_num" },
      );
      if (roundUpsert.error) {
        console.error("[riffle/advance] round upsert failed", roundUpsert.error);
        return NextResponse.json({ error: roundUpsert.error.message }, { status: 500 });
      }

      await updateRoom({
        status: "wager",
        current_round: nextRound,
        phase_started_at: now,
      });
      return NextResponse.json({ status: "wager", round: nextRound });
    }

    // --- wager → guess ---
    if (room.status === "wager") {
      await updateRoom({ status: "guess", phase_started_at: now });
      return NextResponse.json({ status: "guess" });
    }

    // --- guess → reveal ---
    if (room.status === "guess") {
      await supabase
        .from("room_rounds")
        .update({ revealed_at: now })
        .eq("room_code", code)
        .eq("round_num", room.current_round);
      await updateRoom({ status: "reveal", phase_started_at: now });
      return NextResponse.json({ status: "reveal" });
    }

    return NextResponse.json({ status: room.status });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// Settle a completed round: apply wager math to every player's bank.
// Idempotent-ish: if the reveal row has `settled_at` we skip. (We don't have
// that column yet, so we track by whether phase_started_at changed, close
// enough for v1 with host-only triggering.)
type SBClient = Awaited<ReturnType<typeof createClient>>;

async function settleRound(supabase: SBClient, code: string, roundNum: number) {
  const { data: round } = await supabase
    .from("room_rounds")
    .select("*")
    .eq("room_code", code)
    .eq("round_num", roundNum)
    .maybeSingle();
  if (!round || !round.track_id) return;

  const { data: track } = await supabase
    .from("tracks")
    .select("title")
    .eq("id", round.track_id)
    .maybeSingle();
  if (!track) return;

  const { data: players } = await supabase
    .from("room_players")
    .select("*")
    .eq("room_code", code);
  if (!players) return;

  const wagers = (round.wagers ?? {}) as Record<
    string,
    { amount: number; level: ClipLevel }
  >;
  const guesses = (round.guesses ?? {}) as Record<
    string,
    { value: string; correct: boolean; clip_level: ClipLevel; time_ms: number }
  >;

  for (const p of players) {
    const wager = wagers[p.display_name];
    const guess = guesses[p.display_name];
    if (!wager) continue;
    const correct = Boolean(
      guess?.correct || (guess && fuzzyMatchTitle(guess.value, track.title)),
    );
    const promised = wager.level;
    const actual = (guess?.clip_level ?? 16) as ClipLevel;
    const delta = payoutFor(promised, actual, wager.amount, correct);
    await supabase
      .from("room_players")
      .update({
        bank: Math.max(0, p.bank + delta),
        correct_count: p.correct_count + (correct ? 1 : 0),
      })
      .eq("room_code", code)
      .eq("display_name", p.display_name);
  }
}
