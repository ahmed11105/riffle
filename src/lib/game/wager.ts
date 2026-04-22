// Wager math. Length multiplier keyed to the clip level the player promises.
// Player pre-commits: stake + promised clip level. On a correct guess at or
// before the promised level, stake pays out at its multiplier. If they need
// longer, they fall back to the next lower multiplier (1x minimum). Wrong
// guess or timeout → lose the stake.

import { LEVELS } from "@/lib/game/levels";

export const CLIP_LEVELS = LEVELS;
export type ClipLevel = (typeof CLIP_LEVELS)[number];

// Higher payout for committing to a harder (shorter) level.
// 0.5s = 6x (elite tier), 10s = 1x (safe tier).
export const LENGTH_MULTIPLIER: Record<ClipLevel, number> = {
  0.5: 6,
  1: 4,
  2: 2.5,
  4: 1.75,
  7: 1.25,
  10: 1,
};

export function multiplierForLevel(level: ClipLevel): number {
  return LENGTH_MULTIPLIER[level];
}

export function payoutFor(
  promised: ClipLevel,
  actual: ClipLevel,
  stake: number,
  correct: boolean,
): number {
  if (!correct) return -stake;
  // Fall back to the multiplier of whichever level the player actually needed.
  const level = Math.max(promised, actual) as ClipLevel;
  return Math.floor(stake * LENGTH_MULTIPLIER[level]) - stake;
}

export function hotStreakBonus(streak: number): number {
  if (streak < 3) return 1;
  if (streak < 5) return 1.25;
  if (streak < 8) return 1.5;
  return 2;
}
