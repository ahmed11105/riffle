import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Returns the caller's invite code (lazy-creates one if missing) and
// their list of successful redemptions, all in a single API round
// trip. Replaces the previous get_or_create_invite_code RPC + a
// separate browser-side SELECT, which made /invite cold-start twice.

const MAX_TRIES = 5;

function generateCode(): string {
  // 8-char base36-ish from a uuid; uppercase for shareability.
  return crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
}

export async function GET() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }
  const userId = session.user.id;

  const admin = createAdminClient();

  // Existing code?
  let { data: codeRow } = await admin
    .from("invite_codes")
    .select("code")
    .eq("user_id", userId)
    .maybeSingle();

  // Not yet — create one with a tiny retry loop on the unique
  // constraint (extremely rare collision on 8 random base36 chars).
  if (!codeRow) {
    for (let i = 0; i < MAX_TRIES; i++) {
      const code = generateCode();
      const { error } = await admin
        .from("invite_codes")
        .insert({ user_id: userId, code });
      if (!error) {
        codeRow = { code };
        break;
      }
      if (error.code !== "23505") {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }
    if (!codeRow) {
      return NextResponse.json({ error: "code_alloc_failed" }, { status: 500 });
    }
  }

  const { data: redemptions } = await admin
    .from("invite_redemptions")
    .select("redeemed_email, redeemed_at, reward_amount")
    .eq("inviter_id", userId)
    .order("redeemed_at", { ascending: false });

  return NextResponse.json({
    code: codeRow.code,
    redemptions: redemptions ?? [],
  });
}
