import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Returns the current room snapshot (room row, players, current
// round) in a single response. Used by useRoomRealtime for the
// initial load + every poll, so the browser supabase-js Web Lock
// can't hang the lobby on cold start. Realtime channel is still
// used for low-latency updates on top of this baseline.
//
// Auth is intentionally NOT required: rooms are joinable by anyone
// holding the code, just like the existing RLS policy
// `rooms: public read` allows.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  if (!code) {
    return NextResponse.json({ error: "missing_code" }, { status: 400 });
  }
  const upper = code.toUpperCase();
  const admin = createAdminClient();

  const [{ data: room }, { data: players }] = await Promise.all([
    admin.from("rooms").select("*").eq("code", upper).maybeSingle(),
    admin.from("room_players").select("*").eq("room_code", upper),
  ]);

  let round = null;
  if (room && (room.current_round ?? 0) > 0) {
    const { data } = await admin
      .from("room_rounds")
      .select("*")
      .eq("room_code", upper)
      .eq("round_num", room.current_round)
      .maybeSingle();
    round = data ?? null;
  }

  return NextResponse.json({
    room: room ?? null,
    players: players ?? [],
    round,
  });
}
