"use client";

import { Volume2, VolumeX, Volume1 } from "lucide-react";
import { useAudioStore } from "@/lib/store/audio";

// Compact horizontal volume row — speaker mute toggle + slim 100px
// slider. Designed to sit directly under the big play button so they
// read as one stack. No pill, no popup, no extra chrome.
export function VolumeControl() {
  const volume = useAudioStore((s) => s.volume);
  const muted = useAudioStore((s) => s.muted);
  const setVolume = useAudioStore((s) => s.setVolume);
  const setMuted = useAudioStore((s) => s.setMuted);

  const effective = muted ? 0 : volume;
  const Icon = effective === 0 ? VolumeX : effective < 0.5 ? Volume1 : Volume2;

  return (
    <div className="flex items-center gap-1.5 text-amber-100/80">
      <button
        type="button"
        onClick={() => setMuted(!muted)}
        aria-label={muted ? "Unmute" : "Mute"}
        className="flex h-8 w-8 items-center justify-center rounded-full transition hover:text-amber-300"
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
        className="riffle-vol-slider"
        style={{ width: "100px", height: "28px" }}
      />
    </div>
  );
}
