// Riffs purchase bundles. Prices are in the smallest currency unit
// (pence for GBP). Adjust pricing experiments here, not in Stripe.
//
// IMPORTANT: bundle IDs are referenced by both the client (to render the
// shop) and the Stripe webhook (to translate session metadata into a
// grant amount). Don't rename without updating both.
//
// Tier ladder uses anchored decoy pricing: the Starter (£0.99) sets the
// "low" anchor at 101 Riffs/£; each step up gives genuinely better
// value, so the badged "Regular" tier reads as the smart-money pick.
// Per-pack bonusPct surfaced in the UI so the comparison is honest —
// no fake "value $X" inflation, just real Riffs-per-pound delta.

export type RiffsBundle = {
  id: string;
  riffs: number;
  bonus: number;
  priceGbp: number;
  label: string;
  highlight?: boolean;
  // Badge rendered as a small chip on the card. "MOST POPULAR" goes on
  // the decoy target; "BEST VALUE" on the largest tier.
  badge?: string;
};

export const RIFFS_BUNDLES: RiffsBundle[] = [
  {
    id: "starter",
    riffs: 100,
    bonus: 0,
    priceGbp: 99,
    label: "Starter",
  },
  {
    id: "regular",
    riffs: 500,
    bonus: 50,
    priceGbp: 399,
    label: "Regular",
    highlight: true,
    badge: "Most popular",
  },
  {
    id: "big",
    riffs: 1200,
    bonus: 200,
    priceGbp: 799,
    label: "Big",
  },
  {
    id: "huge",
    riffs: 3000,
    bonus: 750,
    priceGbp: 1799,
    label: "Huge",
    badge: "Best value",
  },
];

// Riffs-per-pound for a given bundle vs Starter. Used to render an
// honest "+X%" badge — based on genuine per-Riff math, no fake
// reference prices.
export function bonusPctVsStarter(bundle: RiffsBundle): number {
  const starter = RIFFS_BUNDLES[0];
  const baseRate = starter.riffs / starter.priceGbp;
  const rate = (bundle.riffs + bundle.bonus) / bundle.priceGbp;
  return Math.round(((rate - baseRate) / baseRate) * 100);
}

export function findBundle(id: string): RiffsBundle | undefined {
  return RIFFS_BUNDLES.find((b) => b.id === id);
}
