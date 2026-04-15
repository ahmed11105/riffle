import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { itunesSearch, type RiffleTrack } from "@/lib/itunes";

// Progresses a room's state machine. Called by the host.
//   lobby    → wager    (creates next round + picks a track)
//   wager    → guess    (reveals audio)
//   guess    → reveal
//   reveal   → wager (next round) OR finished
// Server also caches the chosen track in the room_rounds row via track_id,
// and writes track metadata to the `tracks` table so clients can fetch it.

const MIX_SEEDS = [
  "billboard hot 100",
  "top hits 2024",
  "rock anthems",
  "classic rock",
  "90s hits",
  "2000s hits",
  "2010s hits",
  "hip hop hits",
  "indie pop",
];

function pickSeed() {
  return MIX_SEEDS[Math.floor(Math.random() * MIX_SEEDS.length)];
}

async function pickTrack(): Promise<RiffleTrack | null> {
  for (let i = 0; i < 3; i++) {
    const tracks = await itunesSearch(pickSeed(), 25).catch(() => []);
    if (tracks.length) return tracks[Math.floor(Math.random() * tracks.length)];
  }
  return null;
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const supabase = await createClient();

  const { data: room, error: roomErr } = await supabase
    .from("rooms")
    .select("*")
    .eq("code", code)
    .single();
  if (roomErr || !room) {
    return NextResponse.json({ error: "room not found" }, { status: 404 });
  }

  async function updateRoom(patch: Record<string, unknown>) {
    const { error } = await supabase.from("rooms").update(patch).eq("code", code);
    if (error) throw new Error(error.message);
  }

  try {
    if (room.status === "lobby" || room.status === "reveal") {
      const nextRound = room.current_round + 1;
      if (nextRound > room.rounds_total) {
        await updateRoom({ status: "finished" });
        return NextResponse.json({ status: "finished" });
      }
      const track = await pickTrack();
      if (!track) {
        return NextResponse.json({ error: "no track available" }, { status: 502 });
      }
      // Upsert into tracks catalog so clients can read the metadata.
      await supabase.from("tracks").upsert(
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
      // Create or reset the round row.
      await supabase.from("room_rounds").upsert(
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
      await updateRoom({ status: "wager", current_round: nextRound });
      return NextResponse.json({ status: "wager", round: nextRound });
    }

    if (room.status === "wager") {
      await updateRoom({ status: "guess" });
      return NextResponse.json({ status: "guess" });
    }

    if (room.status === "guess") {
      await supabase
        .from("room_rounds")
        .update({ revealed_at: new Date().toISOString() })
        .eq("room_code", code)
        .eq("round_num", room.current_round);
      await updateRoom({ status: "reveal" });
      return NextResponse.json({ status: "reveal" });
    }

    return NextResponse.json({ status: room.status });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
