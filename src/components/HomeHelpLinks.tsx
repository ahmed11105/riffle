"use client";

// Small unobtrusive help links below the home-page stats row:
//   - "How it works" expands a <details> with the product pitch.
//     Kept in the DOM (SEO) but collapsed by default (clean look).
//   - "How to play" replays the onboarding modal via a custom event
//     the Onboarding component listens for.

export function HomeHelpLinks() {
  function replayOnboarding() {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent("riffle:show-onboarding"));
  }

  return (
    <details className="group mt-6 w-full max-w-md text-center text-xs text-amber-100/50">
      <summary className="inline-flex cursor-pointer list-none items-center gap-3 font-bold uppercase tracking-wider hover:text-amber-100/80">
        <span className="underline-offset-2 group-open:underline">
          How it works
        </span>
        <span aria-hidden>·</span>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            replayOnboarding();
          }}
          className="font-bold uppercase tracking-wider hover:text-amber-100/80"
        >
          How to play
        </button>
      </summary>
      <p className="mt-3 text-sm leading-relaxed text-amber-100/70">
        Riffle is a daily song-guessing game you can play solo, share with
        friends, or play live in rooms with a points-based wager mechanic.
        One second of a song is all you need. Probably.
      </p>
    </details>
  );
}
