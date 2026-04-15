"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import confetti from "canvas-confetti";
import { Play, Pause } from "lucide-react";
import type { RiffleTrack } from "@/lib/itunes";
import { sfxCorrect, sfxWrong } from "@/lib/sfx";
import { useAudioStore } from "@/lib/store/audio";

type Props = {
  track: RiffleTrack;
  correct: boolean;
  levelSolved?: number;
  onNext?: () => void;
  nextLabel?: string;
};

export function RevealCard({ track, correct, levelSolved, onNext, nextLabel = "Next" }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const proxiedSrc = `/api/audio/${track.id}?src=${encodeURIComponent(track.previewUrl)}`;
  const volume = useAudioStore((s) => s.volume);
  const muted = useAudioStore((s) => s.muted);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    a.volume = volume;
    a.muted = muted;
  }, [volume, muted]);

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
      a.pause();
      setPlaying(false);
    } else {
      a.currentTime = 0;
      a.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    }
  }

  return (
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

      <div className="mt-5 flex items-center justify-between gap-3">
        <div
          className={
            correct
              ? "rounded-full bg-emerald-400 px-4 py-1.5 text-sm font-black text-stone-900"
              : "rounded-full bg-rose-400 px-4 py-1.5 text-sm font-black text-stone-900"
          }
        >
          {correct ? `Solved at ${levelSolved}s` : "Missed"}
        </div>
        {onNext ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={togglePreview}
              aria-label={playing ? "Pause preview" : "Listen to the full clip"}
              className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-stone-900 bg-stone-900 text-stone-50 transition hover:bg-stone-800"
            >
              {playing ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={onNext}
              className="rounded-full border-2 border-stone-900 bg-amber-400 px-5 py-2 text-sm font-black shadow-[0_4px_0_0_rgba(0,0,0,0.9)] active:translate-y-0.5 active:shadow-[0_2px_0_0_rgba(0,0,0,0.9)]"
            >
              {nextLabel}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={togglePreview}
            className="flex items-center gap-2 rounded-full border-2 border-stone-900 bg-amber-400 px-5 py-2 text-sm font-black text-stone-900 shadow-[0_4px_0_0_rgba(0,0,0,0.9)] transition active:translate-y-0.5 active:shadow-[0_2px_0_0_rgba(0,0,0,0.9)]"
          >
            {playing ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
            {playing ? "Pause" : "Listen"}
          </button>
        )}
      </div>

      <audio
        ref={audioRef}
        src={proxiedSrc}
        preload="none"
        onEnded={() => setPlaying(false)}
      />
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
