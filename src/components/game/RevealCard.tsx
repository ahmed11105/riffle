"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import confetti from "canvas-confetti";
import { Play, Pause, Share2, Check } from "lucide-react";
import type { RiffleTrack } from "@/lib/itunes";
import { sfxCorrect, sfxWrong } from "@/lib/sfx";
import { useAudioStore } from "@/lib/store/audio";
import { RevealVolumeControl } from "@/components/game/RevealVolumeControl";

type GuessKind = "correct" | "wrong" | "skipped";

type Props = {
  track: RiffleTrack;
  correct: boolean;
  levelSolved?: number;
  onNext?: () => void;
  nextLabel?: string;
  // Optional inline share affordance. Renders 5 colour-coded result
  // circles + a Share button inside the card. Square emoji grid is only
  // used in the clipboard payload, never in the UI.
  share?: {
    date: string;
    guesses: GuessKind[];
  };
};

import { TOTAL_LEVELS } from "@/lib/game/levels";

function dotClass(kind: GuessKind | null): string {
  if (kind === "correct") return "bg-emerald-500";
  if (kind === "wrong") return "bg-orange-500";
  if (kind === "skipped") return "bg-stone-300";
  return "border-2 border-stone-300 bg-transparent";
}

function emojiForKind(kind: GuessKind | null): string {
  if (kind === "correct") return "🟩";
  if (kind === "wrong") return "🟧";
  if (kind === "skipped") return "⬜";
  return "⬛";
}

function buildShareText(date: string, guesses: GuessKind[], correct: boolean): string {
  const padded: (GuessKind | null)[] = Array.from({ length: TOTAL_LEVELS }, (_, i) =>
    guesses[i] ?? null,
  );
  const grid = padded.map(emojiForKind).join("");
  const result = correct ? `solved in ${guesses.length}` : "missed";
  return `Riffle · ${date}\n${grid}  (${result})\n\nhttps://riffle.cc`;
}

// iTunes preview clips are 30 seconds long. We cap reveal-page playback at
// 16 seconds, the longest in-game clip, both to keep the UX consistent
// with gameplay and to avoid streaming a longer-than-fair-use snippet.
const PREVIEW_MAX_S = 16;

export function RevealCard({
  track,
  correct,
  levelSolved,
  onNext,
  nextLabel = "Next",
  share,
}: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const pathname = usePathname();
  const proxiedSrc = `/api/audio/${track.id}?src=${encodeURIComponent(track.previewUrl)}`;

  // Drive playback through the global audio store so the floating bar
  // and the on-card Listen button stay in sync. Without this they'd
  // play two separate <audio> elements at the same time.
  const registerAudio = useAudioStore((s) => s.registerAudio);
  const globalPlay = useAudioStore((s) => s.globalPlay);
  const globalPause = useAudioStore((s) => s.globalPause);
  const isThisAudioActive = useAudioStore(
    (s) => s.globalAudio === audioRef.current,
  );
  const globalPlaying = useAudioStore((s) => s.globalPlaying);
  const playing = isThisAudioActive && globalPlaying;

  // Fire SFX + confetti once when the card appears.
  useEffect(() => {
    if (correct) {
      sfxCorrect();
      fireConfetti();
    } else {
      sfxWrong();
    }
  }, [correct]);

  function togglePreview() {
    const a = audioRef.current;
    if (!a) return;
    if (playing) {
      globalPause();
      return;
    }
    // First play after the in-game AudioClip unmounted, or first play
    // ever on this card. Register replaces the previously-tracked audio
    // (pausing it first) and wires play/pause listeners that keep
    // globalPlaying accurate.
    if (!isThisAudioActive) {
      registerAudio(a, pathname, PREVIEW_MAX_S, track.title, track.artist);
    }
    globalPlay();
  }

  return (
    <>
      <div className="mx-auto w-full max-w-md rounded-3xl border-4 border-stone-900 bg-stone-50 p-6 text-stone-900 shadow-[0_8px_0_0_rgba(0,0,0,0.9)]">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Image
              src={track.albumArtUrl}
              alt={track.album}
              width={96}
              height={96}
              className="h-24 w-24 rounded-xl border-2 border-stone-900"
              unoptimized
            />
            <button
              type="button"
              onClick={togglePreview}
              aria-label={playing ? "Pause preview" : "Play preview"}
              className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/40 opacity-0 transition hover:opacity-100 focus:opacity-100"
            >
              {playing ? (
                <Pause className="h-10 w-10 text-white drop-shadow" />
              ) : (
                <Play className="h-10 w-10 text-white drop-shadow" />
              )}
            </button>
          </div>
          <div className="flex-1 overflow-hidden">
            <div className="text-2xl font-black leading-tight">{track.title}</div>
            <div className="truncate text-stone-600">{track.artist}</div>
            {track.releaseYear && (
              <div className="text-xs text-stone-500">{track.releaseYear}</div>
            )}
          </div>
        </div>

        {share && <ShareRow {...share} correct={correct} />}

        <div className="mt-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div
              className={
                correct
                  ? "rounded-full bg-emerald-400 px-4 py-1.5 text-sm font-black text-stone-900"
                  : "rounded-full bg-rose-400 px-4 py-1.5 text-sm font-black text-stone-900"
              }
            >
              {correct ? `Solved at ${levelSolved}s` : "Missed"}
            </div>
            <RevealVolumeControl />
          </div>
          <button
            type="button"
            onClick={togglePreview}
            className="flex items-center gap-2 rounded-full border-2 border-stone-900 bg-amber-400 px-5 py-2 text-sm font-black text-stone-900 shadow-[0_4px_0_0_rgba(0,0,0,0.9)] transition active:translate-y-0.5 active:shadow-[0_2px_0_0_rgba(0,0,0,0.9)]"
          >
            {playing ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
            {playing ? "Pause" : "Listen"}
          </button>
        </div>

        {/* The audio store wires its own ended/pause/play listeners on
            registerAudio, so this element only needs to expose the ref. */}
        <audio ref={audioRef} src={proxiedSrc} preload="none" />
      </div>

      {onNext && (
        <button
          type="button"
          onClick={onNext}
          className="mx-auto mt-3 w-full max-w-md rounded-full border-4 border-stone-900 bg-amber-400 px-6 py-3 text-base font-black text-stone-900 shadow-[0_4px_0_0_rgba(0,0,0,0.9)] transition active:translate-y-0.5 active:shadow-[0_2px_0_0_rgba(0,0,0,0.9)]"
        >
          {nextLabel} →
        </button>
      )}
    </>
  );
}

function ShareRow({
  date,
  guesses,
  correct,
}: {
  date: string;
  guesses: GuessKind[];
  correct: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const padded: (GuessKind | null)[] = Array.from({ length: TOTAL_LEVELS }, (_, i) =>
    guesses[i] ?? null,
  );

  async function shareOrCopy() {
    const text = buildShareText(date, guesses, correct);
    const canNativeShare =
      typeof navigator !== "undefined" &&
      typeof navigator.share === "function" &&
      /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent);
    if (canNativeShare) {
      try {
        await navigator.share({ text });
        return;
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {}
  }

  return (
    <div className="mt-4 flex items-center justify-between gap-3 border-t-2 border-stone-200 pt-3">
      <div className="flex items-center gap-1.5" aria-label="Your result">
        {padded.map((kind, i) => (
          <span
            key={i}
            className={`block h-3 w-3 rounded-full ${dotClass(kind)}`}
            aria-label={kind ?? "not reached"}
          />
        ))}
      </div>
      <button
        type="button"
        onClick={shareOrCopy}
        className="inline-flex items-center gap-1.5 rounded-full border-2 border-stone-900 bg-stone-900 px-3 py-1.5 text-xs font-black uppercase tracking-wider text-amber-300 shadow-[0_2px_0_0_rgba(0,0,0,0.9)] active:translate-y-0.5 active:shadow-[0_1px_0_0_rgba(0,0,0,0.9)]"
      >
        {copied ? (
          <>
            <Check className="h-3 w-3" /> Copied
          </>
        ) : (
          <>
            <Share2 className="h-3 w-3" /> Share
          </>
        )}
      </button>
    </div>
  );
}

function fireConfetti() {
  // Two bursts, left and right, amber/cream/emerald palette.
  const colors = ["#fbbf24", "#fb923c", "#fef3c7", "#34d399", "#f59e0b"];
  confetti({
    particleCount: 80,
    spread: 70,
    startVelocity: 45,
    origin: { x: 0.2, y: 0.6 },
    angle: 60,
    colors,
    scalar: 0.9,
  });
  confetti({
    particleCount: 80,
    spread: 70,
    startVelocity: 45,
    origin: { x: 0.8, y: 0.6 },
    angle: 120,
    colors,
    scalar: 0.9,
  });
  setTimeout(() => {
    confetti({
      particleCount: 50,
      spread: 120,
      startVelocity: 30,
      origin: { x: 0.5, y: 0.3 },
      colors,
      scalar: 0.8,
    });
  }, 180);
}
