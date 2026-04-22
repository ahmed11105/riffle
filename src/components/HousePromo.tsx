"use client";

import Link from "next/link";
import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";

// Lightweight in-house promo card. Pro users (and admin-mode) never
// see one — that's what makes "no promos" a real perk on the Pro tier.
// Picks a single promo per render based on the current path so we
// don't pitch /solo while the user is already on /solo.
//
// Visual is intentionally calmer than the gameplay surfaces: dark
// background, single line, one CTA. Reads as "house notice" rather
// than third-party banner ad.

type Promo = {
  id: string;
  // Hide this promo if the current pathname starts with any of these.
  hideOn?: string[];
  // Hide for anonymous users (used for the Pro upsell — guests can't
  // subscribe directly, the magic-link flow has to come first).
  signedInOnly?: boolean;
  body: string;
  cta: string;
  href: string;
};

const PROMOS: Promo[] = [
  {
    id: "pro",
    body: "Riffle Pro · no promos, unlimited rooms, longer games",
    cta: "Try Pro",
    href: "/shop",
    signedInOnly: true,
  },
  {
    id: "solo",
    hideOn: ["/solo"],
    body: "Can't wait for tomorrow? Solo Unlimited keeps the songs coming",
    cta: "Play Solo",
    href: "/solo",
  },
  {
    id: "rooms",
    hideOn: ["/rooms"],
    body: "Play with a friend — wager Riffs each round",
    cta: "Open Rooms",
    href: "/rooms",
  },
  {
    id: "save",
    body: "Save your streak across devices with a one-tap magic link",
    cta: "Sign in",
    href: "/account",
  },
];

export function HousePromo() {
  const { isPro, isAnonymous, loading } = useAuth();
  const pathname = usePathname();

  const promo = useMemo(() => {
    const eligible = PROMOS.filter((p) => {
      if (p.signedInOnly && isAnonymous) return false;
      if (p.hideOn?.some((prefix) => pathname.startsWith(prefix))) return false;
      // Hide the "save your streak" pitch once they've signed in.
      if (p.id === "save" && !isAnonymous) return false;
      return true;
    });
    if (eligible.length === 0) return null;
    // Stable per-page-load pick, not random per-render — avoids visual
    // churn when other state changes.
    const idx = Math.floor(Math.random() * eligible.length);
    return eligible[idx];
  }, [isAnonymous, pathname]);

  if (loading || isPro || !promo) return null;

  return (
    <div className="w-full rounded-2xl border-2 border-amber-100/15 bg-stone-900/50 px-4 py-3 text-amber-100/80 backdrop-blur-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm">{promo.body}</p>
        <Link
          href={promo.href}
          className="inline-flex shrink-0 items-center rounded-full border-2 border-amber-300 px-3 py-1 text-xs font-black uppercase tracking-wider text-amber-300 hover:bg-amber-300/10"
        >
          {promo.cta} →
        </Link>
      </div>
      <p className="mt-1 text-[10px] uppercase tracking-wider text-amber-100/30">
        Riffle promo · hidden with Pro
      </p>
    </div>
  );
}
