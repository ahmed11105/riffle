// Riffs purchase bundles. Prices are in the smallest currency unit
// (pence for GBP). Adjust pricing experiments here, not in Stripe.
//
// IMPORTANT: bundle IDs are referenced by both the client (to render the
// shop) and the Stripe webhook (to translate session metadata into a
// grant amount). Don't rename without updating both.

export type RiffsBundle = {
  id: string;
  riffs: number;
  bonus: number;
  priceGbp: number;
  label: string;
  highlight?: boolean;
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
  },
];

export function findBundle(id: string): RiffsBundle | undefined {
  return RIFFS_BUNDLES.find((b) => b.id === id);
}
