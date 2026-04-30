// Inter-component event for opening the Tournament modal from the
// ribbon button (which lives outside TournamentManager). The manager
// listens for this event and shows the dialog.

export const OPEN_TOURNAMENT_EVENT = "riffle:open-tournament";

export function openTournament() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(OPEN_TOURNAMENT_EVENT));
}
