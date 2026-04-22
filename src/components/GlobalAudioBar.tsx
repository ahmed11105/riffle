"use client";

import { useRouter, usePathname } from "next/navigation";
import { Play, Pause, X, Flag, Volume2, VolumeX, Volume1 } from "lucide-react";
import { useAudioStore } from "@/lib/store/audio";
import {
  LEVELS,
  loadSession,
  saveSession,
  saveFinished,
  type Guess,
} from "@/lib/daily/session";
import { sfxSkip } from "@/lib/sfx";

// Floating playback bar styled to match the marketing banner: dark
// stone-900 pill with chunky border + drop shadow. When the user
// originally started playback on /daily, the bar acts as a real
// remote — the +Xs button advances clip levels in localStorage so
// the in-game state is in sync when they return.
export function GlobalAudioBar() {
  const pathname = usePathname();
  const router = useRouter();
  const {
    globalAudio,
    globalOriginPath,
    globalTrackId,
    globalPlaying,
    globalMaxSeconds,
    globalPlay,
    globalPause,
    globalStop,
    updateMaxSeconds,
  } = useAudioStore();

  if (!globalAudio) return null;
  if (globalOriginPath && pathname === globalOriginPath) return null;

  const currentSeconds = globalMaxSeconds ?? 0;
  const currentIdx = LEVELS.indexOf(currentSeconds as 1 | 2 | 4 | 8 | 16);
  const isFinalLevel = currentIdx === LEVELS.length - 1;
  const nextDiff = currentIdx >= 0 && !isFinalLevel ? LEVELS[currentIdx + 1] - LEVELS[currentIdx] : null;
  const dailyContext = globalOriginPath === "/daily" && !!globalTrackId;

  function skipForward() {
    if (!dailyContext || !globalTrackId) return;
    sfxSkip();
    const session = loadSession(globalTrackId);
    const idx = session?.levelIdx ?? Math.max(0, currentIdx);
    const guesses: Guess[] = session?.guesses ?? [];
    if (idx >= LEVELS.length - 1) return;
    const nextIdx = idx + 1;
    const nextGuesses: Guess[] = [...guesses, { kind: "skipped", value: "" }];
    saveSession(globalTrackId, { levelIdx: nextIdx, guesses: nextGuesses });
    updateMaxSeconds(LEVELS[nextIdx]);
    // Pause so the next press of Play uses the new max length.
    globalPause();
  }

  function giveUp() {
    if (!dailyContext || !globalTrackId) return;
    sfxSkip();
    const session = loadSession(globalTrackId);
    const guesses: Guess[] = session?.guesses ?? [];
    const finalGuesses: Guess[] = [...guesses, { kind: "skipped", value: "" }];
    // Mark game as finished + failed. DailyGame will pick this up on
    // its next mount (e.g. when the player taps GUESS to view the
    // reveal screen).
    saveFinished(globalTrackId, { correct: false, guesses: finalGuesses });
    globalPause();
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 px-3 pb-[max(env(safe-area-inset-bottom),1.25rem)] pt-2">
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

        {/* Hover volume to the right of play */}
        <BarVolume />

        {/* Decorative waveform — pulses subtly while playing */}
        <Waveform playing={globalPlaying} />

        {/* Daily-only: skip / give-up button mirroring the in-game UX */}
        {dailyContext && (
          isFinalLevel ? (
            <button
              type="button"
              onClick={giveUp}
              aria-label="Give up and reveal"
              title="Give up"
              className="flex h-9 shrink-0 items-center justify-center rounded-full bg-rose-400 px-3 text-stone-900 shadow-[0_2px_0_0_rgba(0,0,0,0.6)] active:translate-y-0.5"
            >
              <Flag className="h-4 w-4" />
            </button>
          ) : nextDiff != null ? (
            <button
              type="button"
              onClick={skipForward}
              aria-label={`Skip · adds ${nextDiff}s to the clip`}
              title={`+${nextDiff}s clip`}
              className="flex h-9 shrink-0 items-center justify-center rounded-full bg-stone-700 px-3 text-xs font-black tabular-nums text-amber-100/90 shadow-[0_2px_0_0_rgba(0,0,0,0.6)] hover:bg-stone-600 active:translate-y-0.5"
            >
              +{nextDiff}s
            </button>
          ) : null
        )}

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

// Compact mute toggle that expands a horizontal volume slider to the
// right on hover/focus. Lives inside the dark bar.
function BarVolume() {
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
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-amber-100/80 transition hover:text-amber-300"
      >
        <Icon className="h-4 w-4" />
      </button>
      {/* Slider pops out to the right of the icon on hover. The
          bridge spans the gap so the cursor doesn't drop hover. */}
      <div className="pointer-events-none absolute left-full top-1/2 z-20 -translate-y-1/2 pl-1 opacity-0 transition-opacity duration-150 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
        <div className="flex h-9 items-center rounded-full border-2 border-stone-700 bg-stone-900 px-3 shadow-lg">
          <input
            type="range"
            min={0}
            max={1}
            step={0.02}
            value={effective}
            onChange={(e) => setVolume(Number(e.target.value))}
            aria-label="Volume"
            className="riffle-vol-slider"
            style={{ width: "110px", height: "28px" }}
          />
        </div>
      </div>
    </div>
  );
}

// Stylized 24-bar waveform with a staggered pulse animation while
// playing.
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
            animationDelay: playing ? `${i * 60}ms` : undefined,
          }}
        />
      ))}
    </div>
  );
}
