// Challenge templates. Phase 1 = daily-only. Templates live in TS
// because they're tuned every iteration; the DB just stores per-user
// metric counters and claim records.
//
// Each template binds a metric key (the counter we increment from
// game events) to a target threshold and a Riffs reward. Optional
// extras (free hints, freezes) ride alongside the Riffs payout.
//
// Icon + iconColor replace what used to be a single emoji string —
// some Android/Linux/older browsers render emoji as tofu boxes, so
// every player-visible icon goes through Lucide for guaranteed
// cross-device parity. iconColor is a Tailwind text-* class chosen
// to keep contrast on the gold-circle backplate the icons render on.

import {
  Award,
  CalendarDays,
  Clapperboard,
  Coins,
  Crown,
  Flame,
  Gem,
  Headphones,
  Lightbulb,
  Medal,
  Snowflake,
  Sparkles,
  Sunrise,
  Target,
  Trophy,
  Zap,
  type LucideIcon,
} from "lucide-react";

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
  Icon: LucideIcon;
  iconColor: string;
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
    Icon: Headphones,
    iconColor: "text-violet-800",
    reward: { riffs: 25 },
  },
  {
    key: "solve_solo_3",
    metric: "solo_solve",
    target: 3,
    description: "Solve 3 Solo songs",
    Icon: Target,
    iconColor: "text-rose-700",
    reward: { riffs: 35 },
  },
  {
    key: "solve_daily",
    metric: "daily_solve",
    target: 1,
    description: "Solve today's Riffle",
    Icon: CalendarDays,
    iconColor: "text-stone-900",
    reward: { riffs: 50, extra: { hints: 1, label: "+1 hint" } },
  },
  {
    key: "first_listen_solo",
    metric: "solo_first_listen",
    target: 1,
    description: "Solve a Solo song at 0.5s",
    Icon: Zap,
    iconColor: "text-yellow-700",
    reward: { riffs: 40 },
  },
  {
    key: "use_hint",
    metric: "hint_used",
    target: 1,
    description: "Use any hint",
    Icon: Lightbulb,
    iconColor: "text-amber-900",
    reward: { riffs: 15 },
  },
  {
    key: "spend_riffs_50",
    metric: "riffs_spent",
    target: 50,
    description: "Spend 50 Riffs",
    Icon: Coins,
    iconColor: "text-emerald-800",
    reward: { riffs: 30 },
  },
  {
    key: "watch_bonus_ad",
    metric: "bonus_ad",
    target: 1,
    description: "Claim the bonus round",
    Icon: Clapperboard,
    iconColor: "text-stone-900",
    reward: { riffs: 15 },
  },
  {
    key: "open_app",
    metric: "app_open",
    target: 1,
    description: "Open Riffle today",
    Icon: Sunrise,
    iconColor: "text-orange-700",
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

// Weekly challenges. Bigger goals than daily, scoped to ISO week
// (Mon..Sun, UTC). The "Weekly" tab shows the same five every week —
// no per-week shuffle — because the targets only feel achievable if
// the player can see them coming all week.
export type WeeklyChallengeTemplate = {
  key: string;
  metric: string;
  target: number;
  description: string;
  Icon: LucideIcon;
  iconColor: string;
  reward: ChallengeReward;
};

export const WEEKLY_TEMPLATES: WeeklyChallengeTemplate[] = [
  {
    key: "weekly_solo_solves_20",
    metric: "solo_solve",
    target: 20,
    description: "Solve 20 Solo songs this week",
    Icon: Headphones,
    iconColor: "text-violet-800",
    reward: { riffs: 150 },
  },
  {
    key: "weekly_first_listens_5",
    metric: "solo_first_listen",
    target: 5,
    description: "Solve 5 Solos at 0.5s",
    Icon: Zap,
    iconColor: "text-yellow-700",
    reward: { riffs: 200 },
  },
  {
    key: "weekly_daily_solves_5",
    metric: "daily_solve",
    target: 5,
    description: "Solve the Riffle 5 days this week",
    Icon: CalendarDays,
    iconColor: "text-stone-900",
    reward: { riffs: 250, extra: { freezes: 1, label: "+1 freeze" } },
  },
  {
    key: "weekly_spend_riffs_200",
    metric: "riffs_spent",
    target: 200,
    description: "Spend 200 Riffs",
    Icon: Coins,
    iconColor: "text-emerald-800",
    reward: { riffs: 100 },
  },
  {
    key: "weekly_app_opens_7",
    metric: "app_open",
    target: 7,
    description: "Visit Riffle every day this week",
    Icon: Flame,
    iconColor: "text-orange-700",
    reward: { riffs: 175 },
  },
];

export function thisWeekKey(dateStr?: string): string {
  // Mirror Postgres `to_char(.., 'IYYY-"W"IW')` using JS Date math.
  const base = dateStr ? new Date(dateStr + "T00:00:00Z") : new Date();
  const d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

// Achievements / Goals tab. Lifetime, one-shot rewards. Tiered by
// magnitude so the player has both quick wins and far-off targets
// to chase.
export type AchievementTemplate = {
  key: string;
  metric: string;
  target: number;
  description: string;
  Icon: LucideIcon;
  iconColor: string;
  reward: ChallengeReward;
};

export const ACHIEVEMENT_TEMPLATES: AchievementTemplate[] = [
  // First-time
  {
    key: "first_solve",
    metric: "solo_solve",
    target: 1,
    description: "Solve your first song",
    Icon: Sparkles,
    iconColor: "text-amber-600",
    reward: { riffs: 25 },
  },
  {
    key: "first_daily",
    metric: "daily_solve",
    target: 1,
    description: "Solve your first daily Riffle",
    Icon: CalendarDays,
    iconColor: "text-stone-900",
    reward: { riffs: 50 },
  },
  {
    key: "first_hint",
    metric: "hint_used",
    target: 1,
    description: "Use your first hint",
    Icon: Lightbulb,
    iconColor: "text-amber-900",
    reward: { riffs: 25 },
  },
  // Solo grinder ladder
  {
    key: "solo_solver_50",
    metric: "solo_solve",
    target: 50,
    description: "Solve 50 Solo songs",
    Icon: Headphones,
    iconColor: "text-violet-800",
    reward: { riffs: 150 },
  },
  {
    key: "solo_solver_250",
    metric: "solo_solve",
    target: 250,
    description: "Solve 250 Solo songs",
    Icon: Medal,
    iconColor: "text-amber-700",
    reward: { riffs: 500 },
  },
  {
    key: "solo_solver_1000",
    metric: "solo_solve",
    target: 1000,
    description: "Solve 1,000 Solo songs",
    Icon: Crown,
    iconColor: "text-amber-700",
    reward: { riffs: 2000 },
  },
  // Speed
  {
    key: "first_listen_25",
    metric: "solo_first_listen",
    target: 25,
    description: "Solve 25 songs at 0.5s",
    Icon: Zap,
    iconColor: "text-yellow-700",
    reward: { riffs: 250 },
  },
  // Daily devotion
  {
    key: "daily_solver_30",
    metric: "daily_solve",
    target: 30,
    description: "Solve 30 daily Riffles",
    Icon: Trophy,
    iconColor: "text-amber-700",
    reward: { riffs: 500, extra: { freezes: 1, label: "+1 freeze" } },
  },
  // Spending
  {
    key: "spent_500",
    metric: "riffs_spent",
    target: 500,
    description: "Spend 500 Riffs total",
    Icon: Coins,
    iconColor: "text-emerald-800",
    reward: { riffs: 100 },
  },
  // Cosmetic / fun
  {
    key: "freeze_collector",
    metric: "freeze_used",
    target: 1,
    description: "Save a streak with a freeze",
    Icon: Snowflake,
    iconColor: "text-cyan-700",
    reward: { riffs: 100 },
  },
  {
    key: "diamond_spinner",
    metric: "wheel_jackpot",
    target: 1,
    description: "Land the 100-Riff wheel jackpot",
    Icon: Gem,
    iconColor: "text-cyan-700",
    reward: { riffs: 100 },
  },
  {
    key: "hall_of_fame",
    metric: "tournament_milestone",
    target: 5,
    description: "Claim 5 tournament milestones",
    Icon: Award,
    iconColor: "text-violet-800",
    reward: { riffs: 300 },
  },
];
