"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Play, Pause, SkipBack, Square, ArrowLeft } from "lucide-react";
import { useAudioStore } from "@/lib/store/audio";

export function GlobalAudioBar() {
  const pathname = usePathname();
  const {
    globalAudio,
    globalOriginPath,
    globalTrackTitle,
    globalTrackArtist,
    globalPlaying,
    globalPlay,
    globalPause,
    globalStop,
    globalRewind,
    volume,
    muted,
    setVolume,
  } = useAudioStore();

  // Only show when audio is active AND we're NOT on the page that started it.
  if (!globalAudio) return null;
  if (globalOriginPath && pathname === globalOriginPath) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t-2 border-stone-900 bg-stone-900/95 px-4 py-2 backdrop-blur-sm">
      <div className="mx-auto flex max-w-3xl items-center gap-3">
        {/* Track info */}
        <div className="min-w-0 flex-1">
          {globalTrackTitle && (
            <div className="truncate text-sm font-black text-amber-100">
              {globalTrackTitle}
            </div>
          )}
          {globalTrackArtist && (
            <div className="truncate text-xs text-amber-100/60">
              {globalTrackArtist}
            </div>
          )}
          {!globalTrackTitle && (
            <div className="text-xs font-bold text-amber-100/60">
              Audio playing…
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={globalRewind}
            aria-label="Rewind"
            className="flex h-8 w-8 items-center justify-center rounded-full text-amber-100 hover:bg-amber-400/20"
          >
            <SkipBack className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={globalPlaying ? globalPause : globalPlay}
            aria-label={globalPlaying ? "Pause" : "Play"}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-400 text-stone-900 shadow-[0_3px_0_0_rgba(0,0,0,0.9)]"
          >
            {globalPlaying ? (
              <Pause className="h-5 w-5" />
            ) : (
              <Play className="ml-0.5 h-5 w-5" />
            )}
          </button>
          <button
            type="button"
            onClick={globalStop}
            aria-label="Stop"
            className="flex h-8 w-8 items-center justify-center rounded-full text-amber-100 hover:bg-amber-400/20"
          >
            <Square className="h-4 w-4" />
          </button>
        </div>

        {/* Volume slider */}
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={muted ? 0 : volume}
          onChange={(e) => setVolume(Number(e.target.value))}
          className="w-20 accent-amber-400"
          aria-label="Volume"
        />

        {/* Go back link */}
        {globalOriginPath && (
          <Link
            href={globalOriginPath}
            className="flex items-center gap-1 rounded-full border-2 border-amber-400 px-3 py-1 text-xs font-black text-amber-400 hover:bg-amber-400/10"
          >
            <ArrowLeft className="h-3 w-3" />
            Back
          </Link>
        )}
      </div>
    </div>
  );
}
