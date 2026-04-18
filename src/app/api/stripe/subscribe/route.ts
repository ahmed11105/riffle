import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";
import { PRO_MONTHLY_GBP } from "@/lib/riffs/pro";

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
  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .maybeSingle();

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
    },
    success_url: `${origin}/shop?pro_ok=1`,
    cancel_url: `${origin}/shop?pro_cancelled=1`,
  });

  if (!session.url) {
    return NextResponse.json({ error: "Stripe session missing URL" }, { status: 502 });
  }
  return NextResponse.json({ url: session.url });
}
