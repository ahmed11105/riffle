"use client";

import { useRouter, usePathname } from "next/navigation";
import { Play, Pause, X } from "lucide-react";
import { useAudioStore } from "@/lib/store/audio";

// Floating playback bar styled to match the marketing banner: dark
// stone-900 pill, amber play button, decorative waveform, current
// clip "+Xs" pill, amber GUESS button that returns the player to
// the page they were guessing on.
//
// Hidden when no audio is registered or when the user is already on
// the origin page (so it doesn't double up with the in-game player).
export function GlobalAudioBar() {
  const pathname = usePathname();
  const router = useRouter();
  const {
    globalAudio,
    globalOriginPath,
    globalPlaying,
    globalMaxSeconds,
    globalPlay,
    globalPause,
    globalStop,
  } = useAudioStore();

  if (!globalAudio) return null;
  if (globalOriginPath && pathname === globalOriginPath) return null;

  const clipLabel =
    globalMaxSeconds && globalMaxSeconds > 0 ? `${globalMaxSeconds}s` : "—";

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 px-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-2">
      <div className="pointer-events-auto mx-auto flex max-w-2xl items-center gap-2 rounded-full border-4 border-stone-900 bg-stone-900 p-1.5 shadow-[0_6px_0_0_rgba(0,0,0,0.9)]">
        {/* Play / Pause */}
        <button
          type="button"
          onClick={globalPlaying ? globalPause : globalPlay}
          aria-label={globalPlaying ? "Pause" : "Play"}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-stone-900 bg-amber-400 text-stone-900 shadow-[0_3px_0_0_rgba(0,0,0,0.6)] transition active:translate-y-0.5 active:shadow-[0_1px_0_0_rgba(0,0,0,0.6)]"
        >
          {globalPlaying ? (
            <Pause className="h-5 w-5" />
          ) : (
            <Play className="ml-0.5 h-5 w-5" />
          )}
        </button>

        {/* Decorative waveform — pulses subtly while playing */}
        <Waveform playing={globalPlaying} />

        {/* Current clip duration pill (matches the in-game +Xs ladder) */}
        <div className="hidden h-9 shrink-0 items-center justify-center rounded-full bg-stone-700 px-3 text-xs font-black text-amber-100/90 sm:flex">
          {clipLabel}
        </div>

        {/* GUESS button: navigate back to the origin (guessing) page */}
        <button
          type="button"
          onClick={() => {
            if (globalOriginPath) router.push(globalOriginPath);
          }}
          className="flex h-9 shrink-0 items-center rounded-full bg-amber-400 px-4 text-sm font-black tracking-wider text-stone-900 shadow-[0_2px_0_0_rgba(0,0,0,0.7)] transition active:translate-y-0.5 active:shadow-[0_1px_0_0_rgba(0,0,0,0.7)]"
        >
          GUESS
        </button>

        {/* Tiny stop / dismiss */}
        <button
          type="button"
          onClick={globalStop}
          aria-label="Stop"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-amber-100/40 transition hover:text-amber-100"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// Stylized 24-bar waveform. Heights are hardcoded to evoke a real
// audio peak shape (matches the marketing banner). When the audio
// is playing, the bars get a subtle scale animation.
const BAR_HEIGHTS = [
  6, 10, 14, 22, 18, 28, 16, 12, 24, 30, 20, 14, 10, 16, 26, 22, 14, 10, 18, 24,
  12, 8, 14, 20,
];

function Waveform({ playing }: { playing: boolean }) {
  return (
    <div className="flex h-9 min-w-0 flex-1 items-center justify-center gap-[2px] overflow-hidden">
      {BAR_HEIGHTS.map((h, i) => (
        <span
          key={i}
          aria-hidden="true"
          className={`block w-[3px] rounded-full bg-amber-100 ${playing ? "riffle-wave-bar" : ""}`}
          style={{
            height: `${h}px`,
            // Stagger the animation start so the bars don't all
            // pulse in sync.
            animationDelay: playing ? `${i * 60}ms` : undefined,
          }}
        />
      ))}
    </div>
  );
}
