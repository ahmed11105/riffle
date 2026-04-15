"use client";

import { useEffect, useRef } from "react";
import { Play, Pause } from "lucide-react";
import { useAudioStore } from "@/lib/store/audio";

type Props = {
  src: string;
  maxSeconds: number;
  playing: boolean;
  onToggle: () => void;
  onEnded: () => void;
};

export function AudioClip({ src, maxSeconds, playing, onToggle, onEnded }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const stopTimerRef = useRef<number | null>(null);
  const volume = useAudioStore((s) => s.volume);
  const muted = useAudioStore((s) => s.muted);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    a.volume = volume;
    a.muted = muted;
  }, [volume, muted]);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) {
      a.currentTime = 0;
      a.play().catch(() => onEnded());
      if (stopTimerRef.current) window.clearTimeout(stopTimerRef.current);
      stopTimerRef.current = window.setTimeout(() => {
        a.pause();
        onEnded();
      }, maxSeconds * 1000);
    } else {
      a.pause();
      if (stopTimerRef.current) window.clearTimeout(stopTimerRef.current);
    }
    return () => {
      if (stopTimerRef.current) window.clearTimeout(stopTimerRef.current);
    };
  }, [playing, maxSeconds, onEnded]);

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        type="button"
        onClick={onToggle}
        aria-label={playing ? "Pause" : "Play"}
        className="group h-24 w-24 rounded-full bg-amber-400 text-stone-900 shadow-[0_8px_0_0_rgba(0,0,0,0.9)] transition active:translate-y-1 active:shadow-[0_4px_0_0_rgba(0,0,0,0.9)]"
      >
        <div className="flex h-full w-full items-center justify-center">
          {playing ? <Pause className="h-10 w-10" /> : <Play className="ml-1 h-10 w-10" />}
        </div>
      </button>
      <audio ref={audioRef} src={src} preload="auto" />
    </div>
  );
}
