"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AudioClip } from "@/components/game/AudioClip";
import { ClipLadder } from "@/components/game/ClipLadder";
import { GuessInput } from "@/components/game/GuessInput";
import { RevealCard } from "@/components/game/RevealCard";
import type { RiffleTrack } from "@/lib/itunes";
import { fuzzyMatchTitle } from "@/lib/utils";
import { sfxSkip } from "@/lib/sfx";

const LEVELS = [1, 2, 4, 8, 16] as const;
type Guess = { kind: "correct" | "wrong" | "skipped"; value: string };

export function DailyGame({ track }: { track: RiffleTrack }) {
  const [levelIdx, setLevelIdx] = useState(0);
  const [guesses, setGuesses] = useState<Guess[]>([]);
  const [playing, setPlaying] = useState(false);
  const [done, setDone] = useState<null | { correct: boolean; levelSolved?: number }>(null);

  const proxiedSrc = useMemo(
    () => `/api/audio/${track.id}?src=${encodeURIComponent(track.previewUrl)}`,
    [track],
  );
  const current = LEVELS[levelIdx];

  const ladderStates: ("pending" | "skipped" | "wrong" | "correct")[] = LEVELS.map((_, i) =>
    guesses[i] ? guesses[i].kind : "pending",
  );

  function handleGuess(value: string) {
    if (done) return;
    const correct = fuzzyMatchTitle(value, track.title);
    const next: Guess = { kind: correct ? "correct" : "wrong", value };
    const nextArr = [...guesses, next];
    setGuesses(nextArr);
    setPlaying(false);
    if (correct) {
      setDone({ correct: true, levelSolved: LEVELS[levelIdx] });
    } else if (levelIdx >= LEVELS.length - 1) {
      setDone({ correct: false });
    } else {
      setLevelIdx(levelIdx + 1);
    }
  }

  function handleSkip() {
    if (done) return;
    sfxSkip();
    const nextArr: Guess[] = [...guesses, { kind: "skipped", value: "" }];
    setGuesses(nextArr);
    setPlaying(false);
    if (levelIdx >= LEVELS.length - 1) {
      setDone({ correct: false });
    } else {
      setLevelIdx(levelIdx + 1);
    }
  }

  return (
    <div className="flex w-full max-w-md flex-col items-center gap-6">
      <ClipLadder currentLevel={current} guesses={ladderStates} />
      {!done && (
        <>
          <AudioClip
            src={proxiedSrc}
            maxSeconds={current}
            playing={playing}
            onToggle={() => setPlaying((p) => !p)}
            onEnded={() => setPlaying(false)}
          />
          <p className="text-xs text-amber-100/60">
            Playing the first {current} second{current === 1 ? "" : "s"}
          </p>
          <GuessInput onGuess={handleGuess} onSkip={handleSkip} />
        </>
      )}
      {done && (
        <>
          <RevealCard
            track={track}
            correct={done.correct}
            levelSolved={done.levelSolved}
          />
          <NextDailyCountdown />
          <KeepPlayingCTA />
        </>
      )}
    </div>
  );
}

function NextDailyCountdown() {
  const [text, setText] = useState("");
  useEffect(() => {
    function tick() {
      const now = new Date();
      const next = new Date(now);
      next.setUTCHours(24, 0, 0, 0);
      const ms = next.getTime() - now.getTime();
      const h = Math.floor(ms / 3_600_000);
      const m = Math.floor((ms % 3_600_000) / 60_000);
      const s = Math.floor((ms % 60_000) / 1000);
      setText(`${h}h ${m}m ${s}s`);
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="text-center text-sm text-amber-100/70">
      Come back tomorrow for a new song
      <div className="mt-1 font-mono text-lg font-black text-amber-300">{text}</div>
    </div>
  );
}

function KeepPlayingCTA() {
  return (
    <div className="mt-2 flex w-full flex-col items-center gap-2">
      <p className="text-xs uppercase tracking-wider text-amber-100/50">
        Can&rsquo;t wait?
      </p>
      <Link
        href="/solo"
        className="flex items-center gap-2 rounded-full border-4 border-stone-900 bg-amber-400 px-6 py-3 text-sm font-black text-stone-900 shadow-[0_4px_0_0_rgba(0,0,0,0.9)] transition active:translate-y-0.5 active:shadow-[0_2px_0_0_rgba(0,0,0,0.9)]"
      >
        Play Solo Unlimited →
      </Link>
    </div>
  );
}
