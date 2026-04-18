"use client";

import { Volume2, VolumeX, Volume1 } from "lucide-react";
import { useAudioStore } from "@/lib/store/audio";

export function RevealVolumeControl() {
  const volume = useAudioStore((s) => s.volume);
  const muted = useAudioStore((s) => s.muted);
  const setVolume = useAudioStore((s) => s.setVolume);
  const setMuted = useAudioStore((s) => s.setMuted);

  const effective = muted ? 0 : volume;
  const Icon = effective === 0 ? VolumeX : effective < 0.5 ? Volume1 : Volume2;

  return (
    <div className="group/vol relative h-9 w-9">
      {/* Background pill, absolutely positioned so expanding it doesn't
          push siblings. Idle: just the circle. Hover: extends right. */}
      <div
        className="absolute left-0 top-0 h-9 w-9 rounded-full border-2 border-stone-700 bg-stone-800 shadow-md transition-all duration-200
          group-hover/vol:w-32 group-hover/vol:rounded-2xl
          group-focus-within/vol:w-32 group-focus-within/vol:rounded-2xl"
      />

      {/* Speaker icon */}
      <button
        type="button"
        onClick={() => setMuted(!muted)}
        aria-label={muted ? "Unmute" : "Mute"}
        className="absolute left-0 top-0 z-10 flex h-9 w-9 items-center justify-center rounded-full text-stone-100"
      >
        <Icon className="h-4 w-4" />
      </button>

      {/* Slider, overlays to the right of the icon, no layout impact */}
      <div
        className="pointer-events-none absolute left-8 top-0 z-10 flex h-9 w-0 items-center overflow-hidden opacity-0 transition-all duration-200
          group-hover/vol:pointer-events-auto group-hover/vol:w-[5.5rem] group-hover/vol:opacity-100
          group-focus-within/vol:pointer-events-auto group-focus-within/vol:w-[5.5rem] group-focus-within/vol:opacity-100"
      >
        <input
          type="range"
          min={0}
          max={1}
          step={0.02}
          value={effective}
          onChange={(e) => setVolume(Number(e.target.value))}
          aria-label="Volume"
          className="h-6 w-full accent-amber-400"
        />
      </div>
    </div>
  );
}
