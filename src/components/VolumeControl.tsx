"use client";

import { Volume2, VolumeX, Volume1 } from "lucide-react";
import { useAudioStore } from "@/lib/store/audio";

// Inline horizontal volume control: speaker icon + always-visible slider.
// Lives above the guess input. Icon click toggles mute, slider sets the
// level. No hover popup — discoverability over compactness.
export function VolumeControl() {
  const volume = useAudioStore((s) => s.volume);
  const muted = useAudioStore((s) => s.muted);
  const setVolume = useAudioStore((s) => s.setVolume);
  const setMuted = useAudioStore((s) => s.setMuted);

  const effective = muted ? 0 : volume;
  const Icon = effective === 0 ? VolumeX : effective < 0.5 ? Volume1 : Volume2;

  return (
    <div className="flex h-10 items-center gap-2 text-amber-100">
      <button
        type="button"
        onClick={() => setMuted(!muted)}
        aria-label={muted ? "Unmute" : "Mute"}
        className="flex h-9 w-9 items-center justify-center rounded-full transition hover:text-amber-300"
      >
        <Icon className="h-5 w-5" />
      </button>
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
  );
}
