"use client";

import { Volume2, VolumeX, Volume1 } from "lucide-react";
import { useAudioStore } from "@/lib/store/audio";

// Speaker icon with a horizontal volume slider that appears to the
// right on hover/focus. Lives above the guess input now (used to sit
// to its left as a vertical pop-up). Compact: 40px icon + 128px slider.
export function VolumeControl() {
  const volume = useAudioStore((s) => s.volume);
  const muted = useAudioStore((s) => s.muted);
  const setVolume = useAudioStore((s) => s.setVolume);
  const setMuted = useAudioStore((s) => s.setMuted);

  const effective = muted ? 0 : volume;
  const Icon = effective === 0 ? VolumeX : effective < 0.5 ? Volume1 : Volume2;

  return (
    <div className="group relative flex h-10 items-center">
      <button
        type="button"
        onClick={() => setMuted(!muted)}
        aria-label={muted ? "Unmute" : "Mute"}
        className="flex h-10 w-10 items-center justify-center rounded-full text-amber-100 transition hover:text-amber-300"
      >
        <Icon className="h-5 w-5" />
      </button>
      {/* Horizontal slider pops out to the right of the icon on hover.
          Hover bridge spans the gap between the icon and the slider so
          the cursor doesn't drop the hover state moving across. */}
      <div className="pointer-events-none absolute left-full top-1/2 z-20 -translate-y-1/2 pl-2 opacity-0 transition-opacity duration-150 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
        <input
          type="range"
          min={0}
          max={1}
          step={0.02}
          value={effective}
          onChange={(e) => setVolume(Number(e.target.value))}
          aria-label="Volume"
          className="riffle-vol-slider"
          style={{ width: "128px", height: "32px" }}
        />
      </div>
    </div>
  );
}
