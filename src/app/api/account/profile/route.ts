import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Read the caller's profile + streak via the admin client. Used by
// AuthProvider.fetchProfile / refreshProfile so profile reads can't
// hang on the browser supabase-js Web Lock.
export async function GET() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }
  const userId = session.user.id;
  const admin = createAdminClient();

  const [profileRes, streakRes] = await Promise.all([
    admin
      .from("profiles")
      .select(
        "id, display_name, tag, avatar_url, coin_balance, xp, level, is_pro, pro_current_period_end, pro_status, hint_inventory, login_day_index, login_last_claimed_on, starter_pack_claimed",
      )
      .eq("id", userId)
      .maybeSingle(),
    admin
      .from("streaks")
      .select(
        "current_streak, longest_streak, last_play_date, freezes_available, pre_break_streak, broken_at",
      )
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  if (profileRes.error) {
    return NextResponse.json({ error: profileRes.error.message }, { status: 500 });
  }

  return NextResponse.json({
    profile: profileRes.data,
    streak: streakRes.data ?? null,
  });
}
