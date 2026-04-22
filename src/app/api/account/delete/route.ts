import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";

// Permanent account deletion. Auth required.
//
// Order of operations:
//   1. Verify the caller's session.
//   2. Cancel any active Stripe subscription (so the deleted user
//      isn't billed again next cycle).
//   3. admin.auth.admin.deleteUser() — cascades to public.profiles
//      and via that to streaks, daily_results, achievements, etc.
//      rooms.host_id becomes NULL (see migration).
//
// Once deleted, the same email can sign up again as a fresh account.
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  }

  const admin = createAdminClient();

  // Pull the subscription id (if any) before we nuke the row.
  const { data: profile } = await admin
    .from("profiles")
    .select("stripe_subscription_id")
    .eq("id", user.id)
    .maybeSingle();

  // Best-effort Stripe cancellation. If Stripe is down or the sub is
  // already canceled, log and proceed — we'd rather delete the local
  // account than leave the user stuck. The user can email support if
  // they ever spot a stray invoice.
  if (profile?.stripe_subscription_id && process.env.STRIPE_SECRET_KEY) {
    try {
      const stripe = getStripe();
      await stripe.subscriptions.cancel(profile.stripe_subscription_id);
    } catch (e) {
      console.warn("[account/delete] Stripe cancel failed:", e);
    }
  }

  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    console.error("[account/delete] deleteUser failed:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Clear the deleted user's session cookies so the browser doesn't
  // keep presenting a JWT for an account that no longer exists.
  await supabase.auth.signOut();

  return NextResponse.json({ ok: true });
}
