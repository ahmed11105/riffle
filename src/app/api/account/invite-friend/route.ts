import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Email a friend an invite link via Supabase's "Invite User" flow.
//
//   1. Look up (or lazy-create) the caller's invite code
//   2. auth.admin.inviteUserByEmail(email, { redirectTo: "/?ref=CODE" })
//      — this sends the Invite User template (see
//      docs/email-templates/invite-user.html), and on accept the
//      invitee lands at /?ref=CODE with a fresh session.
//   3. ReferralRedeemer in the layout picks up the ref param + the
//      now-non-anonymous session, and calls redeem_invite which
//      grants 100 Riffs to both inviter and invitee.
//
// Anti-abuse: rejects if the email already has an invite_redemptions
// row (one redemption per email forever, enforced server-side by the
// existing unique index — but checking here gives a friendlier UX
// than the redeem_invite "already_redeemed" surface).

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }
  if (user.is_anonymous) {
    return NextResponse.json({ error: "anonymous_user" }, { status: 400 });
  }

  let payload: { email?: unknown };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const email =
    typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }
  if (email === user.email?.toLowerCase()) {
    return NextResponse.json({ error: "self_invite" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Inviter's display name for the email metadata. Falls back to a
  // generic phrase so the invite still reads naturally.
  const { data: profile } = await admin
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();

  // Already-redeemed check — friendlier than waiting for the redeem
  // RPC to bounce after the user clicks.
  const { data: existingRedemption } = await admin
    .from("invite_redemptions")
    .select("id")
    .eq("redeemed_email", email)
    .maybeSingle();
  if (existingRedemption) {
    return NextResponse.json({ error: "already_redeemed" }, { status: 400 });
  }

  // Get or create the inviter's code.
  let { data: codeRow } = await admin
    .from("invite_codes")
    .select("code")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!codeRow) {
    for (let i = 0; i < 5; i++) {
      const code = crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
      const { error } = await admin
        .from("invite_codes")
        .insert({ user_id: user.id, code });
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

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "https://riffle.cc";
  const redirectTo = `${siteUrl}/?ref=${codeRow.code}`;

  // The invite. Supabase fires the "Invite User" email template, the
  // user clicks Accept, and they land at redirectTo signed in. The
  // redirect's ?ref carries the inviter's code into ReferralRedeemer
  // which redeems on their behalf.
  const { error } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo,
    data: {
      inviter_name: profile?.display_name ?? "A friend",
      reward_amount: 100,
    },
  });

  if (error) {
    // Map common Supabase error strings to stable, UI-friendly codes
    // so the front-end can show a translated message without parsing
    // the upstream's English wording.
    const lower = error.message.toLowerCase();
    if (lower.includes("already") && lower.includes("register")) {
      return NextResponse.json(
        { error: "already_registered" },
        { status: 400 },
      );
    }
    if (lower.includes("rate limit")) {
      return NextResponse.json({ error: "rate_limited" }, { status: 429 });
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
