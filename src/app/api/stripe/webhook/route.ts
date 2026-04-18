import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

// Stripe webhook. Handles two product lines:
//
//   1. One-off Riffs purchases (mode=payment) -> grant_coins
//   2. Pro monthly subscription (mode=subscription) -> grant_pro on
//      checkout, refresh on customer.subscription.updated, revoke on
//      customer.subscription.deleted.
//
// Signature is verified against STRIPE_WEBHOOK_SECRET. Return 200 fast so
// Stripe stops retrying.
//
// Idempotency: Stripe delivers at-least-once. We dedupe via the
// stripe_processed_events table (event.id PK). Duplicate delivery
// returns 200 without re-running the handler.

type EventHandler = (
  event: Stripe.Event,
  admin: ReturnType<typeof createAdminClient>,
  stripe: ReturnType<typeof getStripe>,
) => Promise<{ ok: true } | { ok: false; status: number; error: string }>;

const handleCheckoutSessionCompleted: EventHandler = async (event, admin, stripe) => {
  const session = event.data.object as Stripe.Checkout.Session;

  // Pro subscription checkout. Pull the subscription to get the
  // current_period_end (the session itself doesn't include it).
  if (session.mode === "subscription") {
    const userId = session.metadata?.user_id;
    if (!userId) return { ok: false, status: 400, error: "missing user_id" };

    const subId = typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id;
    const customerId = typeof session.customer === "string"
      ? session.customer
      : session.customer?.id;
    if (!subId) return { ok: false, status: 400, error: "missing subscription" };

    const sub = await stripe.subscriptions.retrieve(subId);
    // Stripe v22+ moved current_period_end off Subscription onto each
    // SubscriptionItem. We have one item per subscription (Pro is a
    // single SKU), so the first item's period_end is the source of truth.
    const itemEnd = sub.items.data[0]?.current_period_end;
    const periodEnd = itemEnd ? new Date(itemEnd * 1000).toISOString() : null;

    const { error } = await admin.rpc("grant_pro", {
      p_user: userId,
      p_stripe_customer_id: customerId ?? null,
      p_stripe_subscription_id: subId,
      p_period_end: periodEnd,
      p_status: sub.status,
    });
    if (error) {
      console.error("[stripe webhook] grant_pro failed", error.message);
      return { ok: false, status: 500, error: error.message };
    }
    return { ok: true };
  }

  // One-off Riffs payment.
  const userId = session.metadata?.user_id;
  const riffsTotal = Number(session.metadata?.riffs_total ?? 0);
  const bundleId = session.metadata?.bundle_id ?? "unknown";

  if (!userId || !riffsTotal) {
    console.error("[stripe webhook] missing metadata", session.id);
    return { ok: false, status: 400, error: "Missing metadata" };
  }

  const { error } = await admin.rpc("grant_coins", {
    p_user: userId,
    p_amount: riffsTotal,
    p_reason: "stripe_purchase",
    p_ref: `${bundleId}:${session.id}`,
  });
  if (error) {
    console.error("[stripe webhook] grant_coins failed", error.message);
    return { ok: false, status: 500, error: error.message };
  }
  return { ok: true };
};

const handleSubscriptionUpdated: EventHandler = async (event, admin) => {
  const sub = event.data.object as Stripe.Subscription;
  const userId = sub.metadata?.user_id;
  if (!userId) {
    // Older subscriptions might not have metadata. We could look up via
    // stripe_customer_id, but for v1 we silently skip.
    return { ok: true };
  }

  // Stripe semantics:
  //   status=active        -> currently paid up
  //   status=trialing      -> in free trial
  //   status=past_due      -> payment failed but grace period active
  //   status=canceled      -> cancelled, no longer active
  //   status=unpaid        -> repeated failure
  // We treat active/trialing as "Pro is on", everything else as off.
  const proActive = sub.status === "active" || sub.status === "trialing";
  const itemEnd = sub.items.data[0]?.current_period_end;
  const periodEnd = itemEnd ? new Date(itemEnd * 1000).toISOString() : null;

  if (proActive) {
    const { error } = await admin.rpc("grant_pro", {
      p_user: userId,
      p_stripe_customer_id: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
      p_stripe_subscription_id: sub.id,
      p_period_end: periodEnd,
      p_status: sub.status,
    });
    if (error) {
      console.error("[stripe webhook] grant_pro (update) failed", error.message);
      return { ok: false, status: 500, error: error.message };
    }
  } else {
    const { error } = await admin.rpc("revoke_pro", {
      p_user: userId,
      p_status: sub.status,
    });
    if (error) {
      console.error("[stripe webhook] revoke_pro failed", error.message);
      return { ok: false, status: 500, error: error.message };
    }
  }
  return { ok: true };
};

const handleSubscriptionDeleted: EventHandler = async (event, admin) => {
  const sub = event.data.object as Stripe.Subscription;
  const userId = sub.metadata?.user_id;
  if (!userId) return { ok: true };

  const { error } = await admin.rpc("revoke_pro", {
    p_user: userId,
    p_status: "cancelled",
  });
  if (error) {
    console.error("[stripe webhook] revoke_pro (deleted) failed", error.message);
    return { ok: false, status: 500, error: error.message };
  }
  return { ok: true };
};

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json(
      { error: "Stripe webhook not configured" },
      { status: 503 },
    );
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  const stripe = getStripe();
  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, secret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "bad signature";
    return NextResponse.json({ error: `Webhook signature failed: ${msg}` }, { status: 400 });
  }

  const admin = createAdminClient();

  // Idempotency: Stripe delivers at-least-once. If we've already processed
  // this event, return 200 without doing the work twice.
  const { data: alreadyProcessed } = await admin
    .from("stripe_processed_events")
    .select("event_id")
    .eq("event_id", event.id)
    .maybeSingle();
  if (alreadyProcessed) {
    return NextResponse.json({ received: true, deduplicated: true });
  }

  let result: Awaited<ReturnType<EventHandler>>;
  switch (event.type) {
    case "checkout.session.completed":
      result = await handleCheckoutSessionCompleted(event, admin, stripe);
      break;
    case "customer.subscription.updated":
      result = await handleSubscriptionUpdated(event, admin, stripe);
      break;
    case "customer.subscription.deleted":
      result = await handleSubscriptionDeleted(event, admin, stripe);
      break;
    default:
      return NextResponse.json({ received: true });
  }

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  // Mark processed AFTER success so a failed handler still allows Stripe's
  // retry to do the work next time.
  await admin
    .from("stripe_processed_events")
    .insert({ event_id: event.id, event_type: event.type });

  return NextResponse.json({ received: true });
}
