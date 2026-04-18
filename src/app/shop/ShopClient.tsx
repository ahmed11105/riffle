"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useRiffs } from "@/lib/riffs/useRiffs";
import { RIFFS_BUNDLES } from "@/lib/riffs/bundles";
import { PRO_MONTHLY_GBP, PRO_PERKS } from "@/lib/riffs/pro";
import { createClient } from "@/lib/supabase/client";
import { useAnalytics } from "@/lib/analytics/AnalyticsProvider";
import { EVENTS } from "@/lib/analytics/events";

type Pack = {
  slug: string;
  name: string;
  description: string | null;
  cover_url: string | null;
  accent_color: string | null;
  is_premium: boolean;
};

const PACK_COST = 250;
const AD_REWARD = 25;
const AD_WATCH_SECONDS = 30;

function formatGbp(pence: number): string {
  return `£${(pence / 100).toFixed(2)}`;
}

export function ShopClient({
  packs,
  unlockedSlugs,
}: {
  packs: Pack[];
  unlockedSlugs: string[];
}) {
  const { user, isAnonymous, isPro, signInWithEmail } = useAuth();
  const { balance, claimAdReward, ready } = useRiffs();
  const { track } = useAnalytics();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [emailMsg, setEmailMsg] = useState<string | null>(null);
  const [unlockingSlug, setUnlockingSlug] = useState<string | null>(null);
  const [unlockedNow, setUnlockedNow] = useState<Set<string>>(new Set());
  const [adState, setAdState] = useState<
    "idle" | "watching" | "claiming" | "rewarded" | "limit"
  >("idle");
  const [adMsg, setAdMsg] = useState<string | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [checkoutMsg, setCheckoutMsg] = useState<string | null>(null);
  const [proLoading, setProLoading] = useState(false);
  const [proMsg, setProMsg] = useState<string | null>(null);

  const allUnlocked = new Set([...unlockedSlugs, ...unlockedNow]);
  const showSuccess = searchParams.get("ok") === "1";
  const showCancelled = searchParams.get("cancelled") === "1";
  const showProSuccess = searchParams.get("pro_ok") === "1";
  const showProCancelled = searchParams.get("pro_cancelled") === "1";
  const upsell = searchParams.get("upsell");

  async function unlockPack(slug: string) {
    if (!user) return;
    setUnlockingSlug(slug);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("unlock_pack_with_riffs", {
        p_pack_slug: slug,
        p_cost: PACK_COST,
      });
      if (error) {
        setCheckoutMsg(error.message.includes("Insufficient")
          ? `You need ${PACK_COST} Riffs. Top up below.`
          : error.message);
        return;
      }
      setUnlockedNow((prev) => new Set(prev).add(slug));
      track(EVENTS.PACK_UNLOCKED, { slug, via: "riffs", riffs: PACK_COST });
      router.refresh();
      if (data === "already_unlocked") {
        setCheckoutMsg("You already own this pack.");
      }
    } finally {
      setUnlockingSlug(null);
    }
  }

  async function watchAd() {
    if (!user) return;
    setAdState("watching");
    setAdMsg(`Pretend ad playing… ${AD_WATCH_SECONDS}s`);
    await new Promise((r) => setTimeout(r, AD_WATCH_SECONDS * 1000));
    setAdState("claiming");
    setAdMsg("Claiming reward…");
    const result = await claimAdReward(AD_REWARD);
    if (result.ok) {
      setAdState("rewarded");
      setAdMsg(`+${AD_REWARD} Riffs added.`);
    } else if (result.message?.includes("Daily ad limit")) {
      setAdState("limit");
      setAdMsg("Daily ad limit reached. Come back tomorrow.");
    } else {
      setAdState("idle");
      setAdMsg(result.message ?? "Couldn't grant reward.");
    }
  }

  async function buyBundle(bundleId: string) {
    if (!user) return;
    if (isAnonymous) {
      setCheckoutMsg("Sign in below before buying Riffs so you don't lose them.");
      return;
    }
    setCheckoutLoading(bundleId);
    setCheckoutMsg(null);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bundleId }),
      });
      const json = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !json.url) {
        setCheckoutMsg(json.error ?? "Checkout failed");
        return;
      }
      track(EVENTS.RIFFS_PURCHASED, { bundleId, status: "redirected" });
      window.location.href = json.url;
    } finally {
      setCheckoutLoading(null);
    }
  }

  async function sendMagicLink() {
    setEmailMsg(null);
    if (!email.includes("@")) {
      setEmailMsg("Enter a valid email.");
      return;
    }
    track(EVENTS.SIGNUP_STARTED, { method: "magic_link" });
    const { error } = await signInWithEmail(email);
    if (error) {
      setEmailMsg(error);
    } else {
      setEmailMsg("Check your email for a magic link.");
    }
  }

  async function subscribePro() {
    if (!user) return;
    if (isAnonymous) {
      setProMsg("Sign in below before subscribing so your Pro perks stay with you.");
      return;
    }
    setProLoading(true);
    setProMsg(null);
    try {
      const res = await fetch("/api/stripe/subscribe", { method: "POST" });
      const json = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !json.url) {
        setProMsg(json.error ?? "Couldn't start subscription.");
        return;
      }
      window.location.href = json.url;
    } finally {
      setProLoading(false);
    }
  }

  async function openProPortal() {
    setProLoading(true);
    setProMsg(null);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const json = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !json.url) {
        setProMsg(json.error ?? "Couldn't open subscription portal.");
        return;
      }
      window.location.href = json.url;
    } finally {
      setProLoading(false);
    }
  }

  return (
    <div className="mt-8 grid gap-8">
      {showSuccess && (
        <div className="rounded-2xl border-4 border-emerald-700 bg-emerald-100 p-4 text-emerald-900">
          <p className="font-black">Riffs added.</p>
          <p className="text-sm">
            Your balance updates as soon as Stripe confirms the payment (usually instant).
          </p>
        </div>
      )}
      {showCancelled && (
        <div className="rounded-2xl border-4 border-stone-900 bg-stone-100 p-4 text-stone-700">
          <p className="font-bold">Checkout cancelled. No charge made.</p>
        </div>
      )}
      {showProSuccess && (
        <div className="rounded-2xl border-4 border-emerald-700 bg-emerald-100 p-4 text-emerald-900">
          <p className="font-black">Welcome to Riffle Pro.</p>
          <p className="text-sm">
            All perks are live now. Manage your subscription anytime from the Pro card below.
          </p>
        </div>
      )}
      {showProCancelled && (
        <div className="rounded-2xl border-4 border-stone-900 bg-stone-100 p-4 text-stone-700">
          <p className="font-bold">Subscription cancelled. No charge made.</p>
        </div>
      )}
      {upsell === "rooms_capped" && !isPro && (
        <div className="rounded-2xl border-4 border-amber-600 bg-amber-100 p-4 text-stone-900">
          <p className="font-black">Daily Friends-room limit reached.</p>
          <p className="text-sm">
            Free accounts can host one Friends room per day. Subscribe to Pro
            below for unlimited rooms.
          </p>
        </div>
      )}

      <div className="rounded-3xl border-4 border-stone-900 bg-amber-400 p-6 text-stone-900 shadow-[0_8px_0_0_rgba(0,0,0,0.9)]">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider">
              Your balance
            </div>
            <div className="text-4xl font-black">
              {ready ? balance : "-"} Riffs
            </div>
          </div>
          {isPro && (
            <span className="rounded-full border-2 border-stone-900 bg-stone-900 px-3 py-1 text-xs font-black text-amber-300">
              ★ Pro
            </span>
          )}
          {isAnonymous && (
            <p className="max-w-xs text-xs font-bold">
              You&rsquo;re playing anonymously. Sign in below before buying so
              your Riffs survive a device change.
            </p>
          )}
        </div>
      </div>

      <section id="pro" className="scroll-mt-24">
        <h2 className="text-2xl font-black text-amber-100">Riffle Pro</h2>
        <div className="mt-4 rounded-3xl border-4 border-stone-900 bg-gradient-to-br from-amber-300 to-amber-500 p-6 text-stone-900 shadow-[0_8px_0_0_rgba(0,0,0,0.9)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-xs font-black uppercase tracking-wider text-stone-700">
                Subscription
              </div>
              <div className="mt-1 text-4xl font-black">
                {formatGbp(PRO_MONTHLY_GBP)}
                <span className="text-base font-bold text-stone-700">/month</span>
              </div>
              <p className="mt-1 text-xs font-bold text-stone-700">
                Cancel anytime. No refunds for partial months.
              </p>
            </div>
            {isPro ? (
              <button
                type="button"
                onClick={openProPortal}
                disabled={proLoading}
                className="rounded-full border-4 border-stone-900 bg-stone-900 px-5 py-3 text-sm font-black text-amber-300 shadow-[0_4px_0_0_rgba(0,0,0,0.9)] active:translate-y-0.5 active:shadow-[0_2px_0_0_rgba(0,0,0,0.9)] disabled:opacity-60"
              >
                {proLoading ? "Opening…" : "Manage subscription"}
              </button>
            ) : (
              <button
                type="button"
                onClick={subscribePro}
                disabled={proLoading || !user}
                className="rounded-full border-4 border-stone-900 bg-stone-900 px-6 py-3 text-base font-black text-amber-300 shadow-[0_4px_0_0_rgba(0,0,0,0.9)] active:translate-y-0.5 active:shadow-[0_2px_0_0_rgba(0,0,0,0.9)] disabled:opacity-60"
              >
                {proLoading ? "Opening…" : "Go Pro"}
              </button>
            )}
          </div>
          <ul className="mt-5 grid gap-2 sm:grid-cols-2">
            {PRO_PERKS.map((perk) => (
              <li key={perk} className="flex items-start gap-2 text-sm font-bold text-stone-900">
                <span aria-hidden className="mt-0.5">✓</span>
                <span>{perk}</span>
              </li>
            ))}
          </ul>
        </div>
        {proMsg && (
          <p className="mt-2 text-sm font-bold text-rose-300">{proMsg}</p>
        )}
      </section>

      <section>
        <h2 className="text-2xl font-black text-amber-100">Top up Riffs</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {RIFFS_BUNDLES.map((b) => {
            const total = b.riffs + b.bonus;
            const loading = checkoutLoading === b.id;
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => buyBundle(b.id)}
                disabled={loading || !user}
                className={
                  b.highlight
                    ? "rounded-2xl border-4 border-stone-900 bg-amber-400 p-5 text-left text-stone-900 shadow-[0_6px_0_0_rgba(0,0,0,0.9)] active:translate-y-0.5 active:shadow-[0_2px_0_0_rgba(0,0,0,0.9)] disabled:opacity-60"
                    : "rounded-2xl border-4 border-stone-900 bg-stone-50 p-5 text-left text-stone-900 shadow-[0_6px_0_0_rgba(0,0,0,0.9)] active:translate-y-0.5 active:shadow-[0_2px_0_0_rgba(0,0,0,0.9)] disabled:opacity-60"
                }
              >
                <div className="text-xs font-bold uppercase tracking-wider text-stone-700">
                  {b.label}
                </div>
                <div className="mt-1 text-3xl font-black">{total} Riffs</div>
                {b.bonus > 0 && (
                  <div className="text-xs font-bold text-emerald-700">
                    +{b.bonus} bonus
                  </div>
                )}
                <div className="mt-3 text-xl font-black">
                  {loading ? "Opening…" : formatGbp(b.priceGbp)}
                </div>
              </button>
            );
          })}
        </div>
        {checkoutMsg && (
          <p className="mt-3 text-sm font-bold text-rose-300">{checkoutMsg}</p>
        )}
      </section>

      {!isPro && (
      <section>
        <h2 className="text-2xl font-black text-amber-100">Free: watch an ad</h2>
        <div className="mt-4 flex flex-col items-start gap-3 rounded-3xl border-4 border-stone-900 bg-stone-50 p-6 text-stone-900 shadow-[0_8px_0_0_rgba(0,0,0,0.9)] sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-stone-500">
              Earn
            </div>
            <div className="text-2xl font-black">+{AD_REWARD} Riffs per ad</div>
            <p className="mt-1 text-sm text-stone-600">
              Up to 5 ads per day. Real ad SDK lands later, for now it&rsquo;s
              a {AD_WATCH_SECONDS}s timer.
            </p>
          </div>
          <button
            type="button"
            onClick={watchAd}
            disabled={!user || adState === "watching" || adState === "claiming" || adState === "limit"}
            className="rounded-full border-4 border-stone-900 bg-amber-400 px-6 py-3 text-lg font-black text-stone-900 shadow-[0_4px_0_0_rgba(0,0,0,0.9)] active:translate-y-0.5 active:shadow-[0_2px_0_0_rgba(0,0,0,0.9)] disabled:opacity-60"
          >
            {adState === "watching"
              ? "Watching…"
              : adState === "claiming"
                ? "Claiming…"
                : adState === "limit"
                  ? "Limit reached"
                  : "Watch ad"}
          </button>
        </div>
        {adMsg && (
          <p className="mt-2 text-sm font-bold text-amber-200">{adMsg}</p>
        )}
      </section>
      )}

      <section>
        <h2 className="text-2xl font-black text-amber-100">Themed packs</h2>
        <p className="mt-1 text-sm text-amber-100/60">
          {PACK_COST} Riffs to unlock. Used in Solo and Rooms.
        </p>
        {packs.length === 0 ? (
          <p className="mt-4 text-amber-100/60">
            No packs available yet. Check back soon.
          </p>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {packs.map((p) => {
              const unlocked = allUnlocked.has(p.slug);
              const loading = unlockingSlug === p.slug;
              return (
                <div
                  key={p.slug}
                  className="flex flex-col gap-3 rounded-2xl border-4 border-stone-900 bg-stone-50 p-5 text-stone-900 shadow-[0_6px_0_0_rgba(0,0,0,0.9)]"
                >
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-stone-500">
                      {p.is_premium ? "Premium pack" : "Pack"}
                    </div>
                    <div className="text-xl font-black">{p.name}</div>
                    {p.description && (
                      <p className="mt-1 text-sm text-stone-600">{p.description}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => unlockPack(p.slug)}
                    disabled={unlocked || loading || !user || balance < PACK_COST}
                    className={
                      unlocked
                        ? "rounded-full border-2 border-emerald-700 bg-emerald-100 px-4 py-2 text-sm font-black text-emerald-900"
                        : "rounded-full border-4 border-stone-900 bg-amber-400 px-4 py-2 text-sm font-black text-stone-900 shadow-[0_3px_0_0_rgba(0,0,0,0.9)] active:translate-y-0.5 active:shadow-[0_1px_0_0_rgba(0,0,0,0.9)] disabled:opacity-60"
                    }
                  >
                    {unlocked
                      ? "Unlocked"
                      : loading
                        ? "Unlocking…"
                        : `Unlock, ${PACK_COST} Riffs`}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {isAnonymous && (
        <section className="rounded-3xl border-4 border-stone-900 bg-stone-50 p-6 text-stone-900 shadow-[0_8px_0_0_rgba(0,0,0,0.9)]">
          <h2 className="text-xl font-black">Save your progress</h2>
          <p className="mt-1 text-sm text-stone-600">
            Add an email to keep your Riffs, streak, and unlocked packs across
            devices. We&rsquo;ll send a one-tap magic link, no password.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1 rounded-full border-4 border-stone-900 bg-white px-4 py-2 text-stone-900 placeholder:text-stone-400"
            />
            <button
              type="button"
              onClick={sendMagicLink}
              className="rounded-full border-4 border-stone-900 bg-amber-400 px-6 py-2 text-sm font-black text-stone-900 shadow-[0_3px_0_0_rgba(0,0,0,0.9)] active:translate-y-0.5 active:shadow-[0_1px_0_0_rgba(0,0,0,0.9)]"
            >
              Send link
            </button>
          </div>
          {emailMsg && (
            <p className="mt-2 text-sm font-bold text-stone-700">{emailMsg}</p>
          )}
        </section>
      )}
    </div>
  );
}
