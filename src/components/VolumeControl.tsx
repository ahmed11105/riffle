"use client";

import { Volume2, VolumeX, Volume1 } from "lucide-react";
import { useAudioStore } from "@/lib/store/audio";

// Speaker icon wrapped in a small dark pill (matches the guess
// input styling) so it has visual weight and reads as a control,
// not a stray glyph. Slider pops out horizontally to the right
// on hover/focus.
export function VolumeControl() {
  const volume = useAudioStore((s) => s.volume);
  const muted = useAudioStore((s) => s.muted);
  const setVolume = useAudioStore((s) => s.setVolume);
  const setMuted = useAudioStore((s) => s.setMuted);

  const effective = muted ? 0 : volume;
  const Icon = effective === 0 ? VolumeX : effective < 0.5 ? Volume1 : Volume2;

  return (
    <div className="group relative flex items-center">
      <button
        type="button"
        onClick={() => setMuted(!muted)}
        aria-label={muted ? "Unmute" : "Mute"}
        className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-amber-100/20 bg-stone-900 text-amber-100 transition hover:border-amber-300 hover:text-amber-300"
      >
        <Icon className="h-5 w-5" />
      </button>
      {/* Hover-revealed horizontal slider, shown to the right of the
          icon. Hover bridge spans the gap so the cursor doesn't drop
          the hover state moving across. */}
      <div className="pointer-events-none absolute left-full top-1/2 z-20 -translate-y-1/2 pl-2 opacity-0 transition-opacity duration-150 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
        <div className="flex h-10 items-center rounded-full border-2 border-amber-100/20 bg-stone-900 px-3">
          <input
            type="range"
            min={0}
            max={1}
            step={0.02}
            value={effective}
            onChange={(e) => setVolume(Number(e.target.value))}
            aria-label="Volume"
            className="riffle-vol-slider"
            style={{ width: "120px", height: "32px" }}
          />
        </div>
      </div>
    </div>
  );
}
