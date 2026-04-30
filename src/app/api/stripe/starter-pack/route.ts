import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";
import { STARTER_PACK } from "@/lib/riffs/starter-pack";

// Create a Stripe checkout session for the £1.99 first-day starter pack.
// Eligibility checked server-side: signed-up, not anonymous, not already
// claimed. Webhook (handle starter_pack metadata) does the actual grant.
export async function POST(req: Request) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  if (user.is_anonymous) {
    return NextResponse.json(
      { error: "Sign up first so the pack carries over." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const { data: profile, error: profileErr } = await admin
    .from("profiles")
    .select("starter_pack_claimed")
    .eq("id", user.id)
    .maybeSingle();
  if (profileErr) {
    return NextResponse.json({ error: profileErr.message }, { status: 500 });
  }
  if (profile?.starter_pack_claimed) {
    return NextResponse.json({ error: "Starter pack already claimed" }, { status: 400 });
  }

  const stripe = getStripe();
  const origin =
    req.headers.get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "https://riffle.cc";

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "gbp",
          unit_amount: STARTER_PACK.priceGbp,
          product_data: {
            name: STARTER_PACK.name,
            description: STARTER_PACK.description,
          },
        },
      },
    ],
    metadata: {
      user_id: user.id,
      product: "starter_pack",
      riffs_total: String(STARTER_PACK.riffs),
    },
    success_url: `${origin}/?starter_ok=1`,
    cancel_url: `${origin}/?starter_cancelled=1`,
  });

  if (!session.url) {
    return NextResponse.json({ error: "Stripe session missing URL" }, { status: 502 });
  }
  return NextResponse.json({ url: session.url });
}
