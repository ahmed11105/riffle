"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { AudioClip } from "@/components/game/AudioClip";
import { ClipLadder } from "@/components/game/ClipLadder";
import { GuessInput } from "@/components/game/GuessInput";
import { RevealCard } from "@/components/game/RevealCard";
import { HintPanel } from "@/components/game/HintPanel";
import { RiffsBadge } from "@/components/RiffsBadge";
import type { RiffleTrack } from "@/lib/itunes";
import { DAILY_POOL, toRiffleTrack } from "@/lib/daily/pick";
import { fuzzyMatchTitle } from "@/lib/utils";
import { sfxSkip } from "@/lib/sfx";
import type { HintKind } from "@/lib/riffs/hints";

const LEVELS = [1, 2, 4, 8, 16] as const;
const SOLO_PLAYED_KEY = "riffle:played:solo";

// Track IDs the player has already heard in solo mode. Persisted in
// localStorage so songs never repeat across sessions.
function loadPlayedIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(SOLO_PLAYED_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function savePlayedId(id: string) {
  if (typeof window === "undefined") return;
  try {
    const existing = loadPlayedIds();
    existing.add(id);
    localStorage.setItem(SOLO_PLAYED_KEY, JSON.stringify([...existing]));
  } catch {}
}

// Also collect IDs from completed daily games so we don't replay those.
function loadDailyPlayedIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  const ids = new Set<string>();
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (key.startsWith("riffle:daily:done:")) {
        // Key format: riffle:daily:done:<trackId>
        const trackId = key.replace("riffle:daily:done:", "");
        if (trackId) ids.add(trackId);
      }
    }
  } catch {}
  return ids;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function SoloGame() {
  const [playedIds, setPlayedIds] = useState<Set<string>>(new Set());
  const [queueIdx, setQueueIdx] = useState(0);
  const [levelIdx, setLevelIdx] = useState(0);
  const [guesses, setGuesses] = useState<
    ("pending" | "wrong" | "skipped" | "correct")[]
  >([]);
  const [playing, setPlaying] = useState(false);
  const [done, setDone] = useState<null | {
    correct: boolean;
    levelSolved?: number;
  }>(null);
  const [stats, setStats] = useState({ solved: 0, played: 0 });
  const [hints, setHints] = useState<{ kind: HintKind; value: string }[]>([]);

  const [queue, setQueue] = useState<RiffleTrack[]>([]);

  // Build the queue after mount AND reset all per-session state in the
  // same render. Cache Components can preserve client-component useState
  // values across navigation, but the queue rebuild produces a new shuffle,
  // so the preserved queueIdx/done/stats no longer point at the song
  // queue[0] is. Resetting them here keeps the rendered state consistent
  // with the freshly-built queue.
  useEffect(() => {
    const solo = loadPlayedIds();
    const daily = loadDailyPlayedIds();
    const excluded = new Set([...solo, ...daily]);
    setPlayedIds(excluded);
    const available = DAILY_POOL.filter((t) => !excluded.has(t.id));
    setQueue(shuffle(available).map(toRiffleTrack));
    setQueueIdx(0);
    setLevelIdx(0);
    setGuesses([]);
    setDone(null);
    setStats({ solved: 0, played: 0 });
    setHints([]);
    setPlaying(false);
  }, []);

  const current = queue[queueIdx] ?? null;
  const remaining = queue.length - queueIdx;

  const proxiedSrc = useMemo(
    () =>
      current
        ? `/api/audio/${current.id}?src=${encodeURIComponent(current.previewUrl)}`
        : "",
    [current],
  );

  const next = useCallback(() => {
    setQueueIdx((i) => i + 1);
    setLevelIdx(0);
    setGuesses([]);
    setDone(null);
    setPlaying(false);
    setHints([]);
  }, []);

  function markPlayed(trackId: string) {
    savePlayedId(trackId);
    setPlayedIds((prev) => new Set(prev).add(trackId));
  }

  function handleGuess(value: string) {
    if (!current || done) return;
    const correct = fuzzyMatchTitle(value, current.title);
    const nextG = [
      ...guesses,
      correct ? ("correct" as const) : ("wrong" as const),
    ];
    setGuesses(nextG);
    setPlaying(false);
    if (correct) {
      setDone({ correct: true, levelSolved: LEVELS[levelIdx] });
      setStats((s) => ({ solved: s.solved + 1, played: s.played + 1 }));
      markPlayed(current.id);
    } else if (levelIdx >= LEVELS.length - 1) {
      setDone({ correct: false });
      setStats((s) => ({ ...s, played: s.played + 1 }));
      markPlayed(current.id);
    } else {
      setLevelIdx(levelIdx + 1);
    }
  }

  function handleSkip() {
    if (!current || done) return;
    sfxSkip();
    const nextG = [...guesses, "skipped" as const];
    setGuesses(nextG);
    setPlaying(false);
    if (levelIdx >= LEVELS.length - 1) {
      setDone({ correct: false });
      setStats((s) => ({ ...s, played: s.played + 1 }));
      markPlayed(current.id);
    } else {
      setLevelIdx(levelIdx + 1);
    }
  }

  function resetHistory() {
    if (typeof window !== "undefined") {
      localStorage.removeItem(SOLO_PLAYED_KEY);
    }
    setPlayedIds(loadDailyPlayedIds());
    setQueueIdx(0);
    setLevelIdx(0);
    setGuesses([]);
    setDone(null);
    setPlaying(false);
  }

  if (!current && remaining <= 0) {
    return (
      <div className="flex w-full max-w-md flex-col items-center gap-4 text-center">
        <div className="text-2xl font-black text-amber-100">
          You&rsquo;ve heard them all!
        </div>
        <p className="text-sm text-amber-100/60">
          {stats.solved}/{stats.played} solved across {playedIds.size} songs.
        </p>
        <button
          type="button"
          onClick={resetHistory}
          className="rounded-full border-4 border-stone-900 bg-amber-400 px-6 py-3 text-lg font-black text-stone-900 shadow-[0_4px_0_0_rgba(0,0,0,0.9)]"
        >
          Start fresh
        </button>
      </div>
    );
  }

  if (!current) return <p className="text-amber-100/70">Loading…</p>;

  const ladder: ("pending" | "skipped" | "wrong" | "correct")[] = LEVELS.map(
    (_, i) => guesses[i] ?? "pending",
  );

  return (
    <div className="flex w-full max-w-md flex-col items-center gap-6">
      <div className="flex w-full items-center justify-between text-xs font-bold uppercase tracking-wider text-amber-100/60">
        <span>
          {stats.solved}/{stats.played} solved
        </span>
        <RiffsBadge />
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
            Playing the first {LEVELS[levelIdx]} second
            {LEVELS[levelIdx] === 1 ? "" : "s"}
          </p>
          <GuessInput onGuess={handleGuess} onSkip={handleSkip} />
          <HintPanel
            track={current}
            revealed={hints}
            onReveal={(h) => setHints((prev) => [...prev, h])}
          />
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
