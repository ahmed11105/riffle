// Single source of truth for the clip-level ladder. Used by daily,
// solo, rooms, the GuessInput, the GlobalAudioBar, the share grid,
// and the wager math.
//
// Tightened from [1, 2, 4, 8, 16] to [0.5, 1, 2, 4, 7, 10] to:
//   - Add an elite 0.5s tier (some songs are recognisable from one
//     hit / one note — Wonderwall, Smoke on the Water, etc).
//   - Drop the cap from 16s to 10s. iTunes previews start at the
//     hookiest section, so 16s gave the chorus away on most popular
//     tracks. 10s still gives generous exposure without being
//     trivial.
//   - Add one more attempt overall (5 → 6 levels) which makes the
//     0.5s tier less brutal — players don't feel locked out.
export const LEVELS = [0.5, 1, 2, 4, 7, 10] as const;
export type Level = (typeof LEVELS)[number];

export const TOTAL_LEVELS = LEVELS.length;
