// Challenge templates. Phase 1 = daily-only. Templates live in TS
// because they're tuned every iteration; the DB just stores per-user
// metric counters and claim records.
//
// Each template binds a metric key (the counter we increment from
// game events) to a target threshold and a Riffs reward. Optional
// extras (free hints, freezes) ride alongside the Riffs payout.

export type ChallengeReward = {
  riffs: number;
  // Reserved for Phase 2: stack additional rewards visually like
  // Coin Master does (chest, bonus spins, etc).
  extra?: {
    freezes?: number;
    hints?: number;
    label?: string;
  };
};

export type DailyChallengeTemplate = {
  key: string;
  metric: string;
  target: number;
  description: string;
  emoji: string;
  reward: ChallengeReward;
};

// Phase 1 daily pool. 8 templates; 5 picked per day (deterministic
// by date so all players see the same set on a given day). Each
// metric is incremented by a hookpoint somewhere in the app.
export const DAILY_TEMPLATES: DailyChallengeTemplate[] = [
  {
    key: "play_solo_3",
    metric: "solo_round",
    target: 3,
    description: "Play 3 Solo songs",
    emoji: "🎧",
    reward: { riffs: 25 },
  },
  {
    key: "solve_solo_3",
    metric: "solo_solve",
    target: 3,
    description: "Solve 3 Solo songs",
    emoji: "🎯",
    reward: { riffs: 35 },
  },
  {
    key: "solve_daily",
    metric: "daily_solve",
    target: 1,
    description: "Solve today's Riffle",
    emoji: "📅",
    reward: { riffs: 50, extra: { hints: 1, label: "+1 hint" } },
  },
  {
    key: "first_listen_solo",
    metric: "solo_first_listen",
    target: 1,
    description: "Solve a Solo song at 0.5s",
    emoji: "⚡",
    reward: { riffs: 40 },
  },
  {
    key: "use_hint",
    metric: "hint_used",
    target: 1,
    description: "Use any hint",
    emoji: "💡",
    reward: { riffs: 15 },
  },
  {
    key: "spend_riffs_50",
    metric: "riffs_spent",
    target: 50,
    description: "Spend 50 Riffs",
    emoji: "💸",
    reward: { riffs: 30 },
  },
  {
    key: "watch_bonus_ad",
    metric: "bonus_ad",
    target: 1,
    description: "Claim the bonus round",
    emoji: "🎬",
    reward: { riffs: 15 },
  },
  {
    key: "open_app",
    metric: "app_open",
    target: 1,
    description: "Open Riffle today",
    emoji: "🌅",
    reward: { riffs: 10 },
  },
];

// Templates that should ALWAYS appear in the daily selection so the
// player's most natural actions (showing up, solving the daily) map
// to a visible challenge. Without pinning, the random rotation
// would sometimes hide these and a player solving the daily would
// see no related challenge tick — feels broken.
const PINNED_KEYS = new Set(["open_app", "solve_daily"]);

// Deterministic per-date selection so every player sees the same
// challenges on a given UTC day. Pinned templates land first; the
// remaining slots are filled by a date-seeded shuffle of the rest.
function dateSeed(dateStr: string): number {
  let h = 0;
  for (const ch of dateStr) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return Math.abs(h);
}

export function selectDailyChallenges(
  dateStr: string,
  count = 5,
): DailyChallengeTemplate[] {
  const pinned = DAILY_TEMPLATES.filter((t) => PINNED_KEYS.has(t.key));
  const rest = DAILY_TEMPLATES.filter((t) => !PINNED_KEYS.has(t.key));

  const seed = dateSeed(dateStr);
  const indexedRest = rest.map((t, i) => ({
    t,
    rank: (seed * 9301 + i * 49297) % 233280,
  }));
  indexedRest.sort((a, b) => a.rank - b.rank);

  const remaining = Math.max(0, count - pinned.length);
  const filler = indexedRest.slice(0, remaining).map((x) => x.t);
  return [...pinned, ...filler];
}

export function todayDateStr(): string {
  return new Date().toISOString().slice(0, 10);
}
