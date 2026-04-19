"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { Play, Pause } from "lucide-react";
import { useAudioStore } from "@/lib/store/audio";

type Props = {
  src: string;
  maxSeconds: number;
  playing: boolean;
  onToggle: () => void;
  onEnded: () => void;
  trackTitle?: string;
  trackArtist?: string;
};

export function AudioClip({
  src,
  maxSeconds,
  playing,
  onToggle,
  onEnded,
  trackTitle,
  trackArtist,
}: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const stopTimerRef = useRef<number | null>(null);
  const onEndedRef = useRef(onEnded);
  onEndedRef.current = onEnded;
  const volume = useAudioStore((s) => s.volume);
  const muted = useAudioStore((s) => s.muted);
  const registerAudio = useAudioStore((s) => s.registerAudio);
  const updateMaxSeconds = useAudioStore((s) => s.updateMaxSeconds);
  const pathname = usePathname();

  // Create the Audio element once (via JS, not DOM) so it can survive
  // if the component unmounts during client-side navigation.
  useEffect(() => {
    const a = new Audio();
    a.preload = "auto";
    audioRef.current = a;
    return () => {
      a.pause();
      a.src = "";
    };
  }, []);

  // Update src when it changes.
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    a.src = src;
  }, [src]);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    a.volume = volume;
    a.muted = muted;
  }, [volume, muted]);

  // Keep the store's clip-length cap in sync with the current level so
  // the global bar plays the same snippet the game is on, even if the
  // user hasn't hit Play since advancing levels.
  useEffect(() => {
    updateMaxSeconds(maxSeconds);
  }, [maxSeconds, updateMaxSeconds]);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) {
      try {
        a.currentTime = 0;
      } catch {}
      a.play().catch(() => onEndedRef.current());
      registerAudio(a, pathname, maxSeconds, trackTitle, trackArtist);
      if (stopTimerRef.current) window.clearTimeout(stopTimerRef.current);
      stopTimerRef.current = window.setTimeout(() => {
        a.pause();
        onEndedRef.current();
      }, maxSeconds * 1000);
    } else {
      a.pause();
      if (stopTimerRef.current) window.clearTimeout(stopTimerRef.current);
    }
    return () => {
      if (stopTimerRef.current) window.clearTimeout(stopTimerRef.current);
    };
  }, [playing, maxSeconds, src, registerAudio, pathname, trackTitle, trackArtist]);

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
    </div>
  );
}
