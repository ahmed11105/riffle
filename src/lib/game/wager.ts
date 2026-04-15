// Wager math. Length multiplier keyed to the clip level the player promises.
// Player pre-commits: stake + promised clip level. On a correct guess at or
// before the promised level, stake pays out at its multiplier. If they need
// longer, they fall back to the next lower multiplier (1x minimum). Wrong
// guess or timeout → lose the stake.

export const CLIP_LEVELS = [1, 2, 4, 8, 16] as const;
export type ClipLevel = (typeof CLIP_LEVELS)[number];

export const LENGTH_MULTIPLIER: Record<ClipLevel, number> = {
  1: 5,
  2: 3,
  4: 2,
  8: 1.5,
  16: 1,
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
