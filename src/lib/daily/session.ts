// Per-track localStorage state for the daily game. Shared between
// DailyGame (the page itself) and GlobalAudioBar (the floating
// remote control), so a skip from the bar updates the same state
// that DailyGame restores on remount.

export type Guess = {
  kind: "correct" | "wrong" | "skipped";
  value: string;
};
export type FinishedState = {
  correct: boolean;
  levelSolved?: number;
  guesses?: Guess[];
};
export type SessionState = { levelIdx: number; guesses: Guess[] };

export const LEVELS = [1, 2, 4, 8, 16] as const;
export type Level = (typeof LEVELS)[number];

const DONE_PREFIX = "riffle:daily:done:";
const SESSION_PREFIX = "riffle:daily:session:";

export function loadFinished(trackId: string): FinishedState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(DONE_PREFIX + trackId);
    if (!raw) return null;
    return JSON.parse(raw) as FinishedState;
  } catch {
    return null;
  }
}

export function saveFinished(trackId: string, state: FinishedState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DONE_PREFIX + trackId, JSON.stringify(state));
    window.localStorage.removeItem(SESSION_PREFIX + trackId);
  } catch {
    /* noop */
  }
}

export function loadSession(trackId: string): SessionState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SESSION_PREFIX + trackId);
    if (!raw) return null;
    return JSON.parse(raw) as SessionState;
  } catch {
    return null;
  }
}

export function saveSession(trackId: string, state: SessionState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SESSION_PREFIX + trackId, JSON.stringify(state));
  } catch {
    /* noop */
  }
}

export function clearDailyProgress(trackId: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(DONE_PREFIX + trackId);
    window.localStorage.removeItem(SESSION_PREFIX + trackId);
  } catch {
    /* noop */
  }
}
