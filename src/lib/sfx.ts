// File-based SFX. Each cue plays a short MP3 from /public/sfx/, with
// the global audio store driving volume + mute. Files are preloaded
// once on first play so the click-to-cue latency stays tight.
//
// Drop files at public/sfx/{skip,correct,wrong}.mp3. If a file is
// missing the call no-ops silently — keeps SFX optional during dev.

import { useAudioStore } from "./store/audio";

type CueName = "skip" | "correct" | "wrong" | "wrong-attempt" | "claim" | "spend";

const SOURCES: Record<CueName, string> = {
  skip: "/sfx/skip.mp3",
  correct: "/sfx/correct.mp3",
  // Final fail — round is over, didn't get it. Plays on the
  // RevealCard. Should feel like a soft "aw, that's the end".
  wrong: "/sfx/wrong.mp3",
  // Per-guess miss — still has more attempts. Plays after a wrong
  // submit when the ladder advances. Should feel like "nope, try
  // again", not punitive.
  "wrong-attempt": "/sfx/wrong-attempt.mp3",
  // Earning Riffs — daily login claim, event milestone, ad reward,
  // banked hint, restored streak. A short rewarding pickup chime.
  claim: "/sfx/claim.mp3",
  // Spending Riffs — buy hint, buy freeze, unlock pack. A snappy
  // organic UI hit, intentionally brief so frequent spends don't
  // become noisy.
  spend: "/sfx/spend.mp3",
};

// Per-cue base gain. SFX often arrive too hot or too quiet relative
// to the song clip; tune here so each cue sits well against the
// preview audio without shouting over it.
const BASE_VOLUME: Record<CueName, number> = {
  skip: 0.5,
  correct: 0.7,
  wrong: 0.6,
  "wrong-attempt": 0.45,
  claim: 0.6,
  spend: 0.5,
};

const cache: Partial<Record<CueName, HTMLAudioElement>> = {};

function getElement(name: CueName): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  const cached = cache[name];
  if (cached) return cached;
  try {
    const el = new Audio(SOURCES[name]);
    el.preload = "auto";
    cache[name] = el;
    return el;
  } catch {
    return null;
  }
}

function play(name: CueName) {
  const el = getElement(name);
  if (!el) return;
  const userVolume = useAudioStore.getState().effectiveVolume();
  if (userVolume <= 0) return;
  // Clone the node so overlapping plays don't cancel each other (e.g.
  // multiple correct cues stacking up at end of round).
  try {
    const node = el.cloneNode(true) as HTMLAudioElement;
    node.volume = Math.min(1, BASE_VOLUME[name] * userVolume);
    void node.play().catch(() => {
      // Autoplay block / missing file — fail silently, the game UX
      // doesn't depend on the cue landing.
    });
  } catch {}
}

export function sfxSkip() {
  play("skip");
}

export function sfxWrong() {
  play("wrong");
}

export function sfxWrongAttempt() {
  play("wrong-attempt");
}

export function sfxCorrect() {
  play("correct");
}

export function sfxClaim() {
  play("claim");
}

export function sfxSpend() {
  play("spend");
}
