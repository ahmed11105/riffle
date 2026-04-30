// Coin-flight helper. Fires a custom event with source coordinates +
// number of coins; the global <CoinFlyLayer/> spawns animated icons
// that fly from source toward the Riffs balance badge in the corner.
//
// Usage:
//   import { flyCoinsFrom } from "@/lib/coinFly";
//   flyCoinsFrom(buttonEl, 10);
//
// A "riffle:coins-arrived" event fires when the last icon lands —
// listeners (the badge) use it to bump the visible count up.

export type FlyCoinsDetail = {
  // Source rect in viewport coordinates.
  sourceX: number;
  sourceY: number;
  // How many coins to spawn. Capped client-side to keep the screen
  // tame at large numbers.
  count: number;
  // Total Riffs amount being delivered (for the on-arrival increment).
  amount: number;
};

export const FLY_COINS_EVENT = "riffle:fly-coins";
export const COINS_ARRIVED_EVENT = "riffle:coins-arrived";

const MIN_COINS = 6;
const MAX_COINS = 14;

export function flyCoinsFrom(source: Element | null, amount: number) {
  if (typeof window === "undefined" || !source) return;
  const rect = source.getBoundingClientRect();
  const sourceX = rect.left + rect.width / 2;
  const sourceY = rect.top + rect.height / 2;

  // Scale icon count with reward size — but never spam more than
  // MAX_COINS so a 75-Riff day-7 doesn't stutter the scene.
  const count = Math.max(MIN_COINS, Math.min(MAX_COINS, Math.round(amount / 5)));

  window.dispatchEvent(
    new CustomEvent<FlyCoinsDetail>(FLY_COINS_EVENT, {
      detail: { sourceX, sourceY, count, amount },
    }),
  );
}

export function emitCoinsArrived(amount: number) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<{ amount: number }>(COINS_ARRIVED_EVENT, {
      detail: { amount },
    }),
  );
}
