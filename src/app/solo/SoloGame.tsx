"use client";

import { useEffect, useState, useMemo } from "react";
import { AudioClip } from "@/components/game/AudioClip";
import { ClipLadder } from "@/components/game/ClipLadder";
import { GuessInput } from "@/components/game/GuessInput";
import { RevealCard } from "@/components/game/RevealCard";
import type { RiffleTrack } from "@/lib/itunes";
import { fuzzyMatchTitle } from "@/lib/utils";
import { sfxSkip } from "@/lib/sfx";

const LEVELS = [1, 2, 4, 8, 16] as const;

export function SoloGame() {
  const [queue, setQueue] = useState<RiffleTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState<RiffleTrack | null>(null);
  const [levelIdx, setLevelIdx] = useState(0);
  const [guesses, setGuesses] = useState<("pending" | "wrong" | "skipped" | "correct")[]>([]);
  const [playing, setPlaying] = useState(false);
  const [done, setDone] = useState<null | { correct: boolean; levelSolved?: number }>(null);
  const [stats, setStats] = useState({ solved: 0, played: 0 });

  useEffect(() => {
    loadBatch();
  }, []);

  async function loadBatch() {
    setLoading(true);
    try {
      const res = await fetch("/api/songs/random");
      const json = (await res.json()) as { tracks: RiffleTrack[] };
      setQueue(json.tracks);
      setCurrent(json.tracks[0] ?? null);
      setError(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  function next() {
    const remaining = queue.slice(1);
    setQueue(remaining);
    setCurrent(remaining[0] ?? null);
    setLevelIdx(0);
    setGuesses([]);
    setDone(null);
    setPlaying(false);
    if (remaining.length < 3) {
      loadBatch();
    }
  }

  const proxiedSrc = useMemo(
    () => (current ? `/api/audio/${current.id}?src=${encodeURIComponent(current.previewUrl)}` : ""),
    [current],
  );

  function handleGuess(value: string) {
    if (!current || done) return;
    const correct = fuzzyMatchTitle(value, current.title);
    const next = [...guesses, correct ? ("correct" as const) : ("wrong" as const)];
    setGuesses(next);
    setPlaying(false);
    if (correct) {
      setDone({ correct: true, levelSolved: LEVELS[levelIdx] });
      setStats((s) => ({ solved: s.solved + 1, played: s.played + 1 }));
    } else if (levelIdx >= LEVELS.length - 1) {
      setDone({ correct: false });
      setStats((s) => ({ ...s, played: s.played + 1 }));
    } else {
      setLevelIdx(levelIdx + 1);
    }
  }

  function handleSkip() {
    if (!current || done) return;
    sfxSkip();
    const next = [...guesses, "skipped" as const];
    setGuesses(next);
    setPlaying(false);
    if (levelIdx >= LEVELS.length - 1) {
      setDone({ correct: false });
      setStats((s) => ({ ...s, played: s.played + 1 }));
    } else {
      setLevelIdx(levelIdx + 1);
    }
  }

  if (loading && !current) return <p className="text-amber-100/70">Tuning up…</p>;
  if (error) return <p className="text-rose-300">Error: {error}</p>;
  if (!current) return <p className="text-amber-100/70">No tracks loaded.</p>;

  const ladder: ("pending" | "skipped" | "wrong" | "correct")[] = LEVELS.map(
    (_, i) => guesses[i] ?? "pending",
  );

  return (
    <div className="flex w-full max-w-md flex-col items-center gap-6">
      <div className="flex w-full items-center justify-between text-xs font-bold uppercase tracking-wider text-amber-100/60">
        <span>{stats.solved}/{stats.played} solved</span>
        <span>#{stats.played + 1}</span>
      </div>
      <ClipLadder currentLevel={LEVELS[levelIdx]} guesses={ladder} />
      {!done && (
        <>
          <AudioClip
            src={proxiedSrc}
            maxSeconds={LEVELS[levelIdx]}
            playing={playing}
            onToggle={() => setPlaying((p) => !p)}
            onEnded={() => setPlaying(false)}
          />
          <p className="text-xs text-amber-100/60">
            Playing the first {LEVELS[levelIdx]} second{LEVELS[levelIdx] === 1 ? "" : "s"}
          </p>
          <GuessInput onGuess={handleGuess} onSkip={handleSkip} />
        </>
      )}
      {done && (
        <RevealCard
          track={current}
          correct={done.correct}
          levelSolved={done.levelSolved}
          onNext={next}
          nextLabel="Next song"
        />
      )}
    </div>
  );
}
