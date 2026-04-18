// Canonical event names. Keeping them in one file avoids the
// "did I call this event_name or eventName?" drift that ruins funnels.

export const EVENTS = {
  // Daily flow
  DAILY_STARTED: "daily_started",
  DAILY_GUESS: "daily_guess",
  DAILY_COMPLETED: "daily_completed",
  DAILY_FAILED: "daily_failed",
  DAILY_SHARED: "daily_shared",

  // Solo flow
  SOLO_STARTED: "solo_started",
  SOLO_ROUND_COMPLETED: "solo_round_completed",
  SOLO_HISTORY_RESET: "solo_history_reset",

  // Rooms flow
  ROOM_CREATED: "room_created",
  ROOM_JOINED: "room_joined",
  ROOM_LEFT: "room_left",
  ROOM_STARTED: "room_started",
  ROOM_ENDED: "room_ended",

  // Wager mechanic
  WAGER_PLACED: "wager_placed",
  WAGER_RESOLVED: "wager_resolved",

  // Auth
  ANON_SESSION_STARTED: "anon_session_started",
  SIGNUP_STARTED: "signup_started",
  SIGNUP_COMPLETED: "signup_completed",
  SIGNED_OUT: "signed_out",

  // Currency / monetization
  HINT_PURCHASED: "hint_purchased",
  RIFFS_PURCHASED: "riffs_purchased",
  RIFFS_EARNED_AD: "riffs_earned_ad",
  PACK_VIEWED: "pack_viewed",
  PACK_UNLOCKED: "pack_unlocked",
  SHOP_OPENED: "shop_opened",

  // Onboarding
  ONBOARDING_STARTED: "onboarding_started",
  ONBOARDING_STEP: "onboarding_step",
  ONBOARDING_COMPLETED: "onboarding_completed",
  ONBOARDING_DISMISSED: "onboarding_dismissed",
} as const;

export type EventName = (typeof EVENTS)[keyof typeof EVENTS];
