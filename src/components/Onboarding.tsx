"use client";

import { useEffect, useState } from "react";
import { useAnalytics } from "@/lib/analytics/AnalyticsProvider";
import { EVENTS } from "@/lib/analytics/events";

const STORAGE_KEY = "riffle:onboarded:v1";

const STEPS = [
  {
    title: "Name the tune.",
    body:
      "We play half a second of a song. You guess. Wrong or stumped? You get more time, but you score less.",
    badge: "1 / 3",
  },
  {
    title: "Wager your confidence.",
    body:
      "In Solo and Rooms, you bet game points before you guess. The shorter the clip you commit to (0.5s = 6×, 1s = 4×, 2s = 2.5×, 4s = 1.75×, 7s = 1.25×, 10s = 1×), the bigger the payout. Wager points are not real money.",
    badge: "2 / 3",
  },
  {
    title: "Stuck? Spend Riffs.",
    body:
      "Riffs are an in-game currency. Spend them on hints (year, song letters, full artist) or themed song packs. Earn them by playing, or buy a top-up. Riffs never touch wagers.",
    badge: "3 / 3",
  },
];

export function Onboarding() {
  const { track } = useAnalytics();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const seen = window.localStorage.getItem(STORAGE_KEY);
      if (!seen) {
        setOpen(true);
        track(EVENTS.ONBOARDING_STARTED);
      }
    } catch {}

    // Anywhere in the app can replay the onboarding by dispatching
    // window.dispatchEvent(new CustomEvent("riffle:show-onboarding")).
    // Used by the "How to play" link on the home page.
    function onShow() {
      setStep(0);
      setOpen(true);
      track(EVENTS.ONBOARDING_STARTED, { replay: true });
    }
    window.addEventListener("riffle:show-onboarding", onShow);
    return () => window.removeEventListener("riffle:show-onboarding", onShow);
  }, [track]);

  function close(reason: "completed" | "dismissed") {
    setOpen(false);
    try {
      window.localStorage.setItem(STORAGE_KEY, String(Date.now()));
    } catch {}
    track(
      reason === "completed"
        ? EVENTS.ONBOARDING_COMPLETED
        : EVENTS.ONBOARDING_DISMISSED,
      { last_step: step },
    );
  }

  function advance() {
    if (step >= STEPS.length - 1) {
      close("completed");
      return;
    }
    track(EVENTS.ONBOARDING_STEP, { step: step + 1 });
    setStep(step + 1);
  }

  if (!open) return null;
  const current = STEPS[step];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/80 p-6"
    >
      <div className="flex w-full max-w-md flex-col gap-5 rounded-3xl border-4 border-stone-900 bg-stone-50 p-6 text-stone-900 shadow-[0_12px_0_0_rgba(0,0,0,0.9)]">
        <div className="flex items-baseline justify-between">
          <span className="text-xs font-black uppercase tracking-wider text-stone-500">
            How Riffle works
          </span>
          <span className="text-xs font-bold text-stone-500">{current.badge}</span>
        </div>
        <h2 id="onboarding-title" className="text-3xl font-black leading-tight">
          {current.title}
        </h2>
        <p className="text-sm leading-relaxed text-stone-700">{current.body}</p>
        <div className="mt-1 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => close("dismissed")}
            className="text-xs font-bold uppercase tracking-wider text-stone-400 hover:text-stone-700"
          >
            Skip
          </button>
          <button
            type="button"
            onClick={advance}
            className="rounded-full border-4 border-stone-900 bg-amber-400 px-6 py-3 text-sm font-black text-stone-900 shadow-[0_4px_0_0_rgba(0,0,0,0.9)] active:translate-y-0.5 active:shadow-[0_2px_0_0_rgba(0,0,0,0.9)]"
          >
            {step < STEPS.length - 1 ? "Next" : "Let's play"}
          </button>
        </div>
      </div>
    </div>
  );
}
