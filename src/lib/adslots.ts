// Central registry of AdSense ad-unit slot IDs used across the app.
//
// Until AdSense approves riffle.cc and the user creates ad units in
// the AdSense dashboard, these stay null and the AdSlot component
// renders its neutral fallback. Once an ad unit exists, paste the
// numeric data-ad-slot value here — no component changes needed.
//
// One slot per surface so AdSense can target them independently
// (different formats, frequencies, click-through reporting).

export const AD_SLOTS = {
  // Solo Unlimited interstitial that fires every 2 rounds for free
  // players. Recommended unit type: Display ad, responsive.
  soloAdBreak: null as string | null,

  // Earn-hint countdown shown when a free player elects to watch a
  // break in exchange for a banked hint. Recommended unit type:
  // Display ad, responsive.
  earnHint: null as string | null,
};
