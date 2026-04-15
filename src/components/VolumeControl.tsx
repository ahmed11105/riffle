"use client";

import { Volume2, VolumeX, Volume1 } from "lucide-react";
import { useAudioStore } from "@/lib/store/audio";

export function VolumeControl() {
  const volume = useAudioStore((s) => s.volume);
  const muted = useAudioStore((s) => s.muted);
  const setVolume = useAudioStore((s) => s.setVolume);
  const setMuted = useAudioStore((s) => s.setMuted);

  const effective = muted ? 0 : volume;
  const Icon = effective === 0 ? VolumeX : effective < 0.5 ? Volume1 : Volume2;

  return (
    <div className="group relative flex h-12 w-12 items-center justify-center">
      {/* Hover bridge wraps both the invisible padding and the visible slider
          so the hover state stays contiguous from the speaker icon up. */}
      <div className="pointer-events-none absolute bottom-full left-1/2 z-20 -translate-x-1/2 pb-3 opacity-0 transition-opacity duration-150 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
        {/* Rotation wrapper: the inner <input> is a horizontal range rotated
            -90deg. That gives us a 32px-wide hit target with a slim 4px
            visible track. */}
        <div className="relative flex h-32 w-8 items-center justify-center">
          <input
            type="range"
            min={0}
            max={1}
            step={0.02}
            value={effective}
            onChange={(e) => setVolume(Number(e.target.value))}
            aria-label="Volume"
            className="riffle-vol-slider absolute"
            style={{
              width: "128px",
              height: "32px",
              transform: "rotate(-90deg)",
            }}
          />
        </div>
      </div>

      <button
        type="button"
        onClick={() => setMuted(!muted)}
        aria-label={muted ? "Unmute" : "Mute"}
        className="flex h-10 w-10 items-center justify-center rounded-full text-amber-100 transition hover:text-amber-300"
      >
        <Icon className="h-5 w-5" />
      </button>
    </div>
  );
}
