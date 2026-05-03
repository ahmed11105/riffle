// Big-reward overlay event. The DailyGame fires this when the server
// confirms a fresh 10-Riff grant for solving today's puzzle. The
// global RiffsBigRewardOverlay listens, dims the page, zooms in a
// center medallion ("+10 Riffs"), then flies the medallion toward
// the balance pill — confetti from RevealCard stays on top because
// canvas-confetti renders on z-100 and our dim sits at z-90.

export const RIFFS_BIG_REWARD_EVENT = "riffle:riffs-big-reward";

export type RiffsBigRewardDetail = {
  amount: number;
};

export function fireRiffsBigReward(amount: number) {
  if (typeof window === "undefined") return;
  if (amount <= 0) return;
  window.dispatchEvent(
    new CustomEvent<RiffsBigRewardDetail>(RIFFS_BIG_REWARD_EVENT, {
      detail: { amount },
    }),
  );
}
