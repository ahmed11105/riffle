"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { STARTER_PACK } from "@/lib/riffs/starter-pack";

const DISMISS_KEY = "riffle:starter_pack_dismissed_at";
const DISMISS_WINDOW_HOURS = 24;

// One-time first-day starter pack offer. Eligible when:
//   - signed-up (not anonymous) so the purchase carries over
//   - has played at least once (longest_streak >= 1)
//   - hasn't already claimed
//   - hasn't dismissed in the last 24h
// Renders a single dismissible card. The conversion engine of the
// monetization stack.
export function StarterPackOffer() {
  const { profile, streak, isAnonymous, loading } = useAuth();
  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track dismissal locally so it doesn't pop up on every page load.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const ts = localStorage.getItem(DISMISS_KEY);
      if (!ts) return;
      const ms = Number(ts);
      if (!Number.isFinite(ms)) return;
      if (Date.now() - ms < DISMISS_WINDOW_HOURS * 3_600_000) {
        setDismissed(true);
      }
    } catch {}
  }, []);

  if (loading) return null;
  if (!profile || isAnonymous) return null;
  if (profile.starter_pack_claimed) return null;
  if (!streak || streak.longest_streak < 1) return null;
  if (dismissed) return null;

  function handleDismiss() {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {}
  }

  async function handleBuy() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/starter-pack", { method: "POST" });
      const json = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !json.url) {
        setError(json.error ?? "Could not start checkout");
        setBusy(false);
        return;
      }
      window.location.href = json.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
      setBusy(false);
    }
  }

  const pricePounds = (STARTER_PACK.priceGbp / 100).toFixed(2);

  return (
    <div className="relative w-full max-w-md overflow-hidden rounded-3xl border-4 border-stone-900 bg-gradient-to-br from-amber-300 via-amber-400 to-amber-500 p-5 shadow-[0_6px_0_0_rgba(0,0,0,0.9)]">
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss"
        className="absolute right-3 top-3 h-7 w-7 rounded-full border-2 border-stone-900 bg-stone-900 text-xs font-black text-amber-200 hover:bg-stone-800"
      >
        ×
      </button>
      <div className="mb-1 inline-block rounded-full bg-stone-900 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-300">
        One-time offer
      </div>
      <h2 className="mt-1 text-xl font-black uppercase leading-tight tracking-wider text-stone-900">
        Riffle Starter Pack
      </h2>
      <ul className="mt-3 space-y-1.5 text-sm font-bold text-stone-900">
        <li className="flex items-center gap-2">
          <span className="text-base">💰</span>
          <span>
            <span className="font-black">{STARTER_PACK.riffs} Riffs</span> straight to your balance
          </span>
        </li>
        <li className="flex items-center gap-2">
          <span className="text-base">⭐</span>
          <span>
            <span className="font-black">{STARTER_PACK.proTrialDays} days of Pro</span> — no ads, unlimited rooms
          </span>
        </li>
        <li className="flex items-center gap-2">
          <span className="text-base">🎵</span>
          <span>Founder badge on your profile</span>
        </li>
      </ul>
      <button
        type="button"
        onClick={handleBuy}
        disabled={busy}
        className="mt-4 w-full rounded-full border-4 border-stone-900 bg-stone-900 px-4 py-3 text-sm font-black uppercase tracking-wider text-amber-300 shadow-[0_3px_0_0_rgba(0,0,0,0.7)] transition active:translate-y-1 active:shadow-[0_1px_0_0_rgba(0,0,0,0.7)] disabled:opacity-50"
      >
        {busy ? "Redirecting…" : `Get the pack — £${pricePounds}`}
      </button>
      {error && (
        <div className="mt-2 text-xs font-bold uppercase tracking-wider text-red-700">
          {error}
        </div>
      )}
    </div>
  );
}
