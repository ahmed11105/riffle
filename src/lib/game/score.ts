// Daily / Solo scoring. Higher score for faster and lower clip levels.

import { CLIP_LEVELS, type ClipLevel } from "./wager";

const LEVEL_POINTS: Record<ClipLevel, number> = {
  1: 1000,
  2: 750,
  4: 500,
  8: 300,
  16: 150,
};

export function scoreFor(level: ClipLevel, timeMs: number): number {
  const base = LEVEL_POINTS[level];
  const timeBonus = Math.max(0, 1 - timeMs / 60000);
  return Math.round(base * (0.6 + 0.4 * timeBonus));
}

export { CLIP_LEVELS };
