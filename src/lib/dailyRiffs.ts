// Inter-component event for opening the Daily Riffs modal from the
// ribbon button (which lives outside DailyRiffsManager). The manager
// listens for this event and shows the dialog.
//
// Optional `originRect` carries the bounding rect of the element that
// triggered the open (e.g. the ribbon's Daily icon). The modal uses
// it to scale out from that point so the dialog looks like it
// emerged from the icon.

export const OPEN_DAILY_EVENT = "riffle:open-daily-riffs";

export type OpenDailyDetail = {
  originRect?: { left: number; top: number; width: number; height: number };
};

export function openDailyRiffs(originRect?: DOMRect) {
  if (typeof window === "undefined") return;
  const detail: OpenDailyDetail = originRect
    ? {
        originRect: {
          left: originRect.left,
          top: originRect.top,
          width: originRect.width,
          height: originRect.height,
        },
      }
    : {};
  window.dispatchEvent(new CustomEvent<OpenDailyDetail>(OPEN_DAILY_EVENT, { detail }));
}
