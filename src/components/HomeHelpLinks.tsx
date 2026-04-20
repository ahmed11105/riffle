"use client";

// Single unobtrusive "How to play" affordance below the home-page stats
// row. Expanded, it shows the product pitch (so the text stays in the
// DOM for SEO) and a button to replay the interactive onboarding modal.
// Collapsed by default so the page stays clean.

export function HomeHelpLinks() {
  function replayOnboarding() {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent("riffle:show-onboarding"));
  }

  return (
    <details className="group mt-6 w-full max-w-md text-center text-xs text-amber-100/50">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 font-bold uppercase tracking-wider hover:text-amber-100/80">
        <span className="underline-offset-2 group-open:underline">
          How to play
        </span>
        <span
          aria-hidden
          className="transition-transform group-open:rotate-180"
        >
          ▾
        </span>
      </summary>
      <p className="mt-3 text-sm leading-relaxed text-amber-100/70">
        Riffle is a daily song-guessing game you can play solo, share with
        friends, or play live in rooms with a points-based wager mechanic.
        One second of a song is all you need. Probably.
      </p>
      <button
        type="button"
        onClick={replayOnboarding}
        className="mt-4 rounded-full border-2 border-stone-900 bg-amber-400 px-4 py-2 text-xs font-black uppercase tracking-wider text-stone-900 shadow-[0_2px_0_0_rgba(0,0,0,0.9)] active:translate-y-0.5 active:shadow-[0_1px_0_0_rgba(0,0,0,0.9)]"
      >
        Show the intro again
      </button>
    </details>
  );
}
