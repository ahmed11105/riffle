// Inter-component event for opening the Daily Riffs modal from the
// ribbon button (which lives outside DailyRiffsManager). The manager
// listens for this event and shows the dialog.

export const OPEN_DAILY_EVENT = "riffle:open-daily-riffs";

export function openDailyRiffs() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(OPEN_DAILY_EVENT));
}
