import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";
import { PRO_MONTHLY_GBP, PRO_TRIAL_DAYS } from "@/lib/riffs/pro";
import { createAdminClient } from "@/lib/supabase/admin";

// Pro monthly subscription. Uses inline price_data with recurring interval
// so we don't need a Dashboard-configured Price object during MVP scaffolding.
// Switch to a real Price ID before going live so prices can be edited
// without redeploying.

export async function POST(req: Request) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json(
      { error: "Stripe not configured" },
      { status: 503 },
    );
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  if (user.is_anonymous) {
    return NextResponse.json(
      { error: "Sign up before subscribing so your Pro perks survive a device change." },
      { status: 400 },
    );
  }

  // Re-use stripe_customer_id if we have one so all the user's invoices,
  // payment methods, and subscription history live under one customer.
  // Also check whether they've ever had Pro before — Stripe's
  // trial_period_days fires on every checkout, so we'd need to
  // gate it ourselves to prevent free-trial farming.
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("stripe_customer_id, stripe_subscription_id, pro_status")
    .eq("id", user.id)
    .maybeSingle();
  const hadPaidProBefore =
    !!profile?.stripe_subscription_id ||
    (profile?.pro_status != null && profile.pro_status !== "starter_trial");

  const stripe = getStripe();
  const origin =
    req.headers.get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "https://riffle.cc";

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    customer: profile?.stripe_customer_id ?? undefined,
    customer_email: profile?.stripe_customer_id ? undefined : user.email ?? undefined,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "gbp",
          unit_amount: PRO_MONTHLY_GBP,
          recurring: { interval: "month" },
          product_data: {
            name: "Riffle Pro",
            description:
              "Monthly subscription. No ads, unlimited rounds in Friends rooms, unlimited daily Friends rooms, free unlimited artist filters. Cancel anytime.",
          },
        },
      },
    ],
    metadata: {
      user_id: user.id,
      product: "pro_monthly",
    },
    subscription_data: {
      metadata: {
        user_id: user.id,
        product: "pro_monthly",
      },
      // First-time subscribers get a 7-day free trial. Anyone who's
      // had a real (non-starter-trial) Pro subscription before doesn't
      // get the trial again — Stripe charges immediately at the end of
      // the period instead.
      ...(hadPaidProBefore ? {} : { trial_period_days: PRO_TRIAL_DAYS }),
    },
    success_url: `${origin}/shop?pro_ok=1`,
    cancel_url: `${origin}/shop?pro_cancelled=1`,
  });

  if (!session.url) {
    return NextResponse.json({ error: "Stripe session missing URL" }, { status: 502 });
  }
  return NextResponse.json({ url: session.url });
}
