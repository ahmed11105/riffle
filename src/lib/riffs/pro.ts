// Pro subscription pricing. Single SKU for now (monthly only).
// Adjust pricing experiments here, not in Stripe.

export const PRO_MONTHLY_GBP = 299; // pence

export const PRO_PERKS = [
  "No ads, ever",
  "Unlimited rounds in Friends rooms (up to 20)",
  "Unlimited Friends rooms per day",
  "Unlimited artist filters, no Riffs needed",
] as const;
