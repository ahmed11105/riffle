"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AudioClip } from "@/components/game/AudioClip";
import { ClipLadder } from "@/components/game/ClipLadder";
import { GuessInput } from "@/components/game/GuessInput";
import { VolumeControl } from "@/components/VolumeControl";
import { RevealCard } from "@/components/game/RevealCard";
import { SaveProgressNudge } from "@/components/game/SaveProgressNudge";
import { HousePromo } from "@/components/HousePromo";
import type { RiffleTrack } from "@/lib/itunes";
import { fuzzyMatchTitle } from "@/lib/utils";
import { sfxSkip } from "@/lib/sfx";
import { deobfuscateTitle } from "@/lib/obfuscate";
import { useAdminMode, resetDailyProgress } from "@/lib/admin";
import { useAuth } from "@/lib/auth/AuthProvider";
import { createClient } from "@/lib/supabase/client";
import { useAudioStore } from "@/lib/store/audio";

const LEVELS = [1, 2, 4, 8, 16] as const;
type Guess = { kind: "correct" | "wrong" | "skipped"; value: string };

// Persist daily progress in localStorage so a refresh can't rewind the
// game: finished reveal state stays revealed, and an in-progress session
// resumes at the clip level the player had reached. The key is scoped by
// track id so a new track (= new day) naturally gets a fresh session.
type FinishedState = {
  correct: boolean;
  levelSolved?: number;
  // Guesses kept for the share grid. Older saves without this field
  // still work — the grid just renders solid-yellow placeholders.
  guesses?: Guess[];
};
type SessionState = { levelIdx: number; guesses: Guess[] };
const DONE_PREFIX = "riffle:daily:done:";
const SESSION_PREFIX = "riffle:daily:session:";
function loadFinished(trackId: string): FinishedState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(DONE_PREFIX + trackId);
    if (!raw) return null;
    return JSON.parse(raw) as FinishedState;
  } catch {
    return null;
  }
}
function saveFinished(trackId: string, state: FinishedState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DONE_PREFIX + trackId, JSON.stringify(state));
    // In-progress state is no longer needed once the game is done.
    window.localStorage.removeItem(SESSION_PREFIX + trackId);
  } catch {}
}
function loadSession(trackId: string): SessionState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SESSION_PREFIX + trackId);
    if (!raw) return null;
    return JSON.parse(raw) as SessionState;
  } catch {
    return null;
  }
}
function saveSession(trackId: string, state: SessionState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SESSION_PREFIX + trackId, JSON.stringify(state));
  } catch {}
}

export function DailyGame({ track: serverTrack }: { track: RiffleTrack }) {
  const [levelIdx, setLevelIdx] = useState(0);
  const [guesses, setGuesses] = useState<Guess[]>([]);
  const [playing, setPlaying] = useState(false);
  const [done, setDone] = useState<FinishedState | null>(null);
  // The server now resolves overrides from Supabase before passing the
  // track prop, so we just use whatever the server gave us. The title
  // is obfuscated server-side to prevent devtools peeking, we decode
  // it client-side only when needed (matching + reveal).
  const track = serverTrack;
  const realTitle = deobfuscateTitle(track.title);
  const revealTrack = { ...track, title: realTitle };

  // On mount / track change, restore per-device daily state:
  //   - finished? jump straight to the reveal
  //   - in progress? resume at the same clip level + guesses ladder
  useEffect(() => {
    const finished = loadFinished(track.id);
    if (finished) {
      setDone(finished);
      if (finished.guesses) setGuesses(finished.guesses);
      return;
    }
    const session = loadSession(track.id);
    if (session) {
      setLevelIdx(session.levelIdx);
      setGuesses(session.guesses);
    }
  }, [track.id]);

  // Once the answer is revealed, push the real title/artist into the
  // global audio store so the floating playback bar stops saying
  // "Mystery track" after the player navigates away from /daily.
  const setGlobalTrackInfo = useAudioStore((s) => s.setGlobalTrackInfo);
  useEffect(() => {
    if (!done) return;
    setGlobalTrackInfo(realTitle, track.artist);
  }, [done, realTitle, track.artist, setGlobalTrackInfo]);

  // Persist the result the first time we transition to `done`.
  // Also write the result + streak update to Supabase. Best-effort, the
  // local state is the source of truth for the UI.
  const { user, refreshStreak } = useAuth();
  useEffect(() => {
    if (!done) return;
    saveFinished(track.id, done);
    if (!user) return;
    const today = new Date().toISOString().slice(0, 10); // UTC YYYY-MM-DD
    const supabase = createClient();
    supabase
      .rpc("record_daily_result", {
        p_puzzle_date: today,
        p_correct: done.correct,
        p_clip_level: done.levelSolved ?? null,
        p_time_ms: 0,
        p_score: done.correct ? Math.max(0, 100 - LEVELS.indexOf(done.levelSolved as (typeof LEVELS)[number]) * 20) : 0,
      })
      .then(({ error }) => {
        if (error) {
          console.warn("record_daily_result failed:", error.message);
          return;
        }
        refreshStreak();
      });
  }, [done, track.id, user, refreshStreak]);

  // Persist in-progress state on every guess/skip so a refresh resumes at
  // the current level instead of starting over at 1s.
  useEffect(() => {
    if (done) return;
    if (levelIdx === 0 && guesses.length === 0) return;
    saveSession(track.id, { levelIdx, guesses });
  }, [levelIdx, guesses, done, track.id]);

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
    const correct = fuzzyMatchTitle(value, realTitle);
    const next: Guess = { kind: correct ? "correct" : "wrong", value };
    const nextArr = [...guesses, next];
    setGuesses(nextArr);
    setPlaying(false);
    if (correct) {
      setDone({ correct: true, levelSolved: LEVELS[levelIdx], guesses: nextArr });
    } else if (levelIdx >= LEVELS.length - 1) {
      setDone({ correct: false, guesses: nextArr });
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
      setDone({ correct: false, guesses: nextArr });
    } else {
      setLevelIdx(levelIdx + 1);
    }
  }

  return (
    <div className="flex w-full max-w-md flex-col items-center gap-6">
      <AdminBar
        onResetDaily={() => {
          resetDailyProgress();
          setLevelIdx(0);
          setGuesses([]);
          setDone(null);
        }}
      />
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
          <VolumeControl />
          <GuessInput onGuess={handleGuess} onSkip={handleSkip} currentLevel={current} />
        </>
      )}
      {done && (
        <>
          <RevealCard
            track={revealTrack}
            correct={done.correct}
            levelSolved={done.levelSolved}
            share={{
              date: new Date().toISOString().slice(0, 10),
              guesses: (done.guesses ?? guesses).map((g) => g.kind),
            }}
          />
          <SaveProgressNudge />
          <HousePromo />
          <NextDailyCountdown />
          <KeepPlayingCTA />
        </>
      )}
    </div>
  );
}

function AdminBar({ onResetDaily }: { onResetDaily: () => void }) {
  const [on, setAdmin] = useAdminMode();
  if (!on) return null;
  return (
    <div className="flex w-full items-center justify-between gap-2 rounded-2xl border-2 border-amber-400 bg-amber-400/10 px-3 py-2 text-xs font-black uppercase tracking-wider text-amber-200">
      <span>🛠 Admin mode</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onResetDaily}
          className="rounded-full border-2 border-stone-900 bg-amber-400 px-3 py-1 text-stone-900 shadow-[0_2px_0_0_rgba(0,0,0,0.9)]"
        >
          Reset daily
        </button>
        <button
          type="button"
          onClick={() => setAdmin(false)}
          className="rounded-full border-2 border-stone-900 bg-stone-50 px-3 py-1 text-stone-900 shadow-[0_2px_0_0_rgba(0,0,0,0.9)]"
        >
          Exit
        </button>
      </div>
    </div>
  );
}

function NextDailyCountdown() {
  const [text, setText] = useState("");
  const [localTime, setLocalTime] = useState("");
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
      // Show the user when the next puzzle drops in *their* local clock.
      // Renders client-side so the timezone is correct.
      setLocalTime(
        next.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }),
      );
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="text-center text-sm text-amber-100/70">
      Come back tomorrow for a new song
      <div className="mt-1 font-mono text-lg font-black text-amber-300">{text}</div>
      {localTime && (
        <div className="mt-0.5 text-xs text-amber-100/50">
          New puzzle at {localTime} your time
        </div>
      )}
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
