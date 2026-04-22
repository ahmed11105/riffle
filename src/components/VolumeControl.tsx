"use client";

import { Volume2, VolumeX, Volume1 } from "lucide-react";
import { useAudioStore } from "@/lib/store/audio";

// Cream pill — small mute icon + slim slider — designed to sit
// directly under the big amber play button. Chunky 2px black border
// + drop shadow matches the play button's brutalist aesthetic so
// the two read as one stack.
export function VolumeControl() {
  const volume = useAudioStore((s) => s.volume);
  const muted = useAudioStore((s) => s.muted);
  const setVolume = useAudioStore((s) => s.setVolume);
  const setMuted = useAudioStore((s) => s.setMuted);

  const effective = muted ? 0 : volume;
  const Icon = effective === 0 ? VolumeX : effective < 0.5 ? Volume1 : Volume2;

  return (
    <div className="inline-flex items-center gap-2 rounded-full border-2 border-stone-900 bg-amber-100 px-3 py-1 shadow-[0_3px_0_0_rgba(0,0,0,0.9)]">
      <button
        type="button"
        onClick={() => setMuted(!muted)}
        aria-label={muted ? "Unmute" : "Mute"}
        className="flex h-6 w-6 items-center justify-center text-stone-900 transition hover:text-amber-700"
      >
        <Icon className="h-4 w-4" />
      </button>
      <input
        type="range"
        min={0}
        max={1}
        step={0.02}
        value={effective}
        onChange={(e) => setVolume(Number(e.target.value))}
        aria-label="Volume"
        className="riffle-vol-slider riffle-vol-slider--on-cream"
        style={{ width: "100px", height: "20px" }}
      />
    </div>
  );
}
