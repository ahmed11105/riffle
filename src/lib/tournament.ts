// Inter-component event for opening the Tournament modal from the
// ribbon button (which lives outside TournamentManager). The manager
// listens for this event and shows the dialog.
//
// Optional `originRect` carries the bounding rect of the element that
// triggered the open (e.g. the ribbon's Trophy icon). The modal uses
// it to scale out from that point so the dialog looks like it
// emerged from the icon.

export const OPEN_TOURNAMENT_EVENT = "riffle:open-tournament";

export type OpenTournamentDetail = {
  originRect?: { left: number; top: number; width: number; height: number };
};

export function openTournament(originRect?: DOMRect) {
  if (typeof window === "undefined") return;
  const detail: OpenTournamentDetail = originRect
    ? {
        originRect: {
          left: originRect.left,
          top: originRect.top,
          width: originRect.width,
          height: originRect.height,
        },
      }
    : {};
  window.dispatchEvent(
    new CustomEvent<OpenTournamentDetail>(OPEN_TOURNAMENT_EVENT, { detail }),
  );
}
