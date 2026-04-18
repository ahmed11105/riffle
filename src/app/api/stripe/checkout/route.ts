import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";
import { findBundle } from "@/lib/riffs/bundles";

export async function POST(req: Request) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json(
      { error: "Stripe not configured" },
      { status: 503 },
    );
  }

  const { bundleId } = (await req.json()) as { bundleId?: string };
  const bundle = bundleId ? findBundle(bundleId) : undefined;
  if (!bundle) {
    return NextResponse.json({ error: "Unknown bundle" }, { status: 400 });
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
      { error: "Sign up before buying Riffs so you don't lose them." },
      { status: 400 },
    );
  }

  const stripe = getStripe();
  const origin =
    req.headers.get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "https://riffle.cc";

  const totalRiffs = bundle.riffs + bundle.bonus;
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "gbp",
          unit_amount: bundle.priceGbp,
          product_data: {
            name: `${totalRiffs} Riffs`,
            description: `${bundle.riffs} Riffs${bundle.bonus ? ` + ${bundle.bonus} bonus` : ""}. Virtual goods. Non-refundable. No cash value.`,
          },
        },
      },
    ],
    metadata: {
      user_id: user.id,
      bundle_id: bundle.id,
      riffs_total: String(totalRiffs),
    },
    success_url: `${origin}/shop?ok=1`,
    cancel_url: `${origin}/shop?cancelled=1`,
  });

  if (!session.url) {
    return NextResponse.json({ error: "Stripe session missing URL" }, { status: 502 });
  }
  return NextResponse.json({ url: session.url });
}
