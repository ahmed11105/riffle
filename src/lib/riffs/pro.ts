// Pro subscription pricing. Single SKU for now (monthly only).
// Adjust pricing experiments here, not in Stripe.

export const PRO_MONTHLY_GBP = 299; // pence
export const PRO_TRIAL_DAYS = 7;

// Per-day framing for the paywall — research consensus is that
// "less than £0.10/day" converts dramatically better than "£2.99/mo"
// because the comparison shifts to "a coffee" not "a subscription".
export const PRO_PER_DAY_PENCE = Math.round(PRO_MONTHLY_GBP / 30);

export const PRO_PERKS = [
  "No ad breaks in Solo Unlimited",
  "Unlimited rounds in Friends rooms (up to 20)",
  "Unlimited Friends rooms per day",
  "Unlimited artist filters, no Riffs needed",
  "Auto streak freeze every 7 days",
] as const;
