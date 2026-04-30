"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Play, Pause } from "lucide-react";
import { useAudioStore } from "@/lib/store/audio";
import { LEVELS } from "@/lib/game/levels";

const TOTAL_SECONDS = LEVELS[LEVELS.length - 1]; // 10s — full bar represents this

type Props = {
  src: string;
  maxSeconds: number;
  playing: boolean;
  onToggle: () => void;
  onEnded: () => void;
  trackId?: string;
  trackTitle?: string;
  trackArtist?: string;
};

export function AudioClip({
  src,
  maxSeconds,
  playing,
  onToggle,
  onEnded,
  trackId,
  trackTitle,
  trackArtist,
}: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const stopTimerRef = useRef<number | null>(null);
  const onEndedRef = useRef(onEnded);
  onEndedRef.current = onEnded;
  // Drives the playhead bar above the play button. Updated from the
  // audio element's timeupdate event while playing.
  const [currentTime, setCurrentTime] = useState(0);
  const volume = useAudioStore((s) => s.volume);
  const muted = useAudioStore((s) => s.muted);
  const registerAudio = useAudioStore((s) => s.registerAudio);
  const updateMaxSeconds = useAudioStore((s) => s.updateMaxSeconds);
  const pathname = usePathname();

  // Create the Audio element once (via JS, not DOM) so it can survive
  // if the component unmounts during client-side navigation. The
  // element is intentionally NOT nuked in cleanup: it stays registered
  // in the global audio store so the floating playback bar can keep
  // playing the current clip after the user leaves this page. Just
  // pause so it doesn't keep playing during the route transition.
  useEffect(() => {
    const a = new Audio();
    a.preload = "auto";
    audioRef.current = a;
    return () => {
      a.pause();
    };
  }, []);

  // Drive the playhead bar with a requestAnimationFrame loop while
  // playing. The audio element's `timeupdate` event fires at only
  // 4-66Hz which makes the fill visibly chunky; rAF reads
  // currentTime at the display refresh rate (typically 60Hz) for a
  // smooth fill.
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    if (!playing) return;
    let raf = 0;
    const tick = () => {
      setCurrentTime(a.currentTime);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

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
      setCurrentTime(0);
      a.play().catch(() => onEndedRef.current());
      registerAudio(a, pathname, maxSeconds, trackTitle, trackArtist, trackId);
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
  }, [playing, maxSeconds, src, registerAudio, pathname, trackId, trackTitle, trackArtist]);

  // Bar fill: 0..1 of total clip length. Caps at 1 so we never
  // overshoot if the audio briefly reports past maxSeconds.
  const fillPct = Math.max(
    0,
    Math.min(100, (currentTime / TOTAL_SECONDS) * 100),
  );
  const labelPct = (maxSeconds / TOTAL_SECONDS) * 100;
  const labelFull = maxSeconds === 1 ? "1 second" : `${maxSeconds} seconds`;
  const labelCompact = `${maxSeconds}s`;

  return (
    <div className="flex w-full max-w-md flex-col items-center gap-3">
      <ClipProgressBar
        fillPct={fillPct}
        labelPct={labelPct}
        labelFull={labelFull}
        labelCompact={labelCompact}
      />
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

// Songless-style horizontal progress bar with section dividers at
// each clip-level boundary, an amber fill that grows during play,
// and a dark caption below the bar with an up-pointing triangle
// anchoring it to the level's stop point. Riffle palette:
// stone-900 track, amber-400 fill.
function ClipProgressBar({
  fillPct,
  labelPct,
  labelFull,
  labelCompact,
}: {
  fillPct: number;
  labelPct: number;
  labelFull: string;
  labelCompact: string;
}) {
  // Section dividers at every level boundary except 0 and the end.
  const dividers = LEVELS.slice(0, -1).map((s) => (s / TOTAL_SECONDS) * 100);

  return (
    <div className="relative w-full pb-7">
      {/* Track. */}
      <div className="relative h-4 w-full overflow-hidden rounded-full border-2 border-stone-900 bg-stone-900 shadow-[0_3px_0_0_rgba(0,0,0,0.9)]">
        {/* Filled portion. */}
        <div
          className="absolute inset-y-0 left-0 bg-amber-400"
          style={{ width: `${fillPct}%` }}
        />
        {/* Section dividers — thin amber-ish lines on the dark track. */}
        {dividers.map((pct, i) => (
          <div
            key={i}
            aria-hidden="true"
            className="absolute inset-y-0 w-px bg-amber-100/30"
            style={{ left: `${pct}%` }}
          />
        ))}
      </div>

      {/* Caption pinned BELOW the bar at the level's stop point. An
          up-pointing triangle anchors it visually to the stop. */}
      <div
        className="pointer-events-none absolute bottom-0 -translate-x-1/2"
        style={{ left: `min(max(${labelPct}%, 14%), 86%)` }}
      >
        {/* Up-pointing triangle. */}
        <div
          className="absolute left-1/2 bottom-full -translate-x-1/2"
          style={{
            width: 0,
            height: 0,
            borderLeft: "5px solid transparent",
            borderRight: "5px solid transparent",
            borderBottom: "5px solid #1c1917",
          }}
        />
        <div className="whitespace-nowrap rounded-md bg-stone-900 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-100">
          <span className="sm:hidden">{labelCompact}</span>
          <span className="hidden sm:inline">{labelFull}</span>
        </div>
      </div>
    </div>
  );
}
