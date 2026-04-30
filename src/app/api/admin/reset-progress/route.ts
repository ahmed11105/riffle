import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminRequest, unauthorizedResponse } from "@/lib/adminAuth";

// Wipe the caller's user-state so they look like a brand-new player.
// Two modes:
//   - daily: clear today's daily_results entry (lets them re-play
//     today's puzzle to test the streak/reveal flow); leaves all
//     other state intact.
//   - overall: full reset. coin_balance back to 100, hint_inventory
//     emptied, login calendar reset, starter pack flag cleared,
//     streak nuked, freeze counts back to default, all daily_results
//     and event_entries deleted. Pro is NOT touched (don't want to
//     accidentally revoke a real subscription during testing).
//
// Auth: admin Bearer token AND a real (non-anonymous) authenticated
// user. Admin-only endpoint, never reachable by regular players.

export async function POST(req: Request) {
  if (!isAdminRequest(req)) return unauthorizedResponse();

  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }
  const userId = session.user.id;

  const body = (await req.json().catch(() => ({}))) as { kind?: string };
  const kind = body.kind;
  if (kind !== "daily" && kind !== "overall") {
    return NextResponse.json({ error: "invalid_kind" }, { status: 400 });
  }

  const admin = createAdminClient();

  if (kind === "daily") {
    const today = new Date().toISOString().slice(0, 10);
    const { error } = await admin
      .from("daily_results")
      .delete()
      .eq("user_id", userId)
      .eq("puzzle_date", today);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, kind });
  }

  // Overall reset.
  // Reset profile fields. Skip is_pro / pro_* — Pro purchases are real
  // money, leave them alone. starter_pack_claimed is reset so the offer
  // re-appears.
  const { error: profileErr } = await admin
    .from("profiles")
    .update({
      coin_balance: 100,
      xp: 0,
      level: 1,
      hint_inventory: {},
      login_day_index: 0,
      login_last_claimed_on: null,
      login_cycle_completed_count: 0,
      starter_pack_claimed: false,
      starter_pack_claimed_at: null,
    })
    .eq("id", userId);
  if (profileErr) return NextResponse.json({ error: profileErr.message }, { status: 500 });

  // Reset streak.
  await admin
    .from("streaks")
    .update({
      current_streak: 0,
      longest_streak: 0,
      last_play_date: null,
      freezes_available: 1,
      last_freeze_grant_at: null,
      pre_break_streak: 0,
      broken_at: null,
    })
    .eq("user_id", userId);

  // Wipe per-user history that gates re-testing.
  await admin.from("daily_results").delete().eq("user_id", userId);
  await admin.from("event_entries").delete().eq("user_id", userId);
  await admin.from("user_pack_unlocks").delete().eq("user_id", userId);
  await admin.from("ad_grants").delete().eq("user_id", userId);

  return NextResponse.json({ ok: true, kind });
}
