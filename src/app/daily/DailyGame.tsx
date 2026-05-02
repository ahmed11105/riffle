"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AudioClip } from "@/components/game/AudioClip";
import { ClipLadder } from "@/components/game/ClipLadder";
import { GuessInput } from "@/components/game/GuessInput";
import { VolumeControl } from "@/components/VolumeControl";
import { RevealCard } from "@/components/game/RevealCard";
import { SaveProgressNudge } from "@/components/game/SaveProgressNudge";
import { StreakBadge } from "@/components/game/StreakBadge";
import { StreakRestoreOffer } from "@/components/game/StreakRestoreOffer";
import { BonusRoundPrompt } from "@/components/game/BonusRoundPrompt";
import type { RiffleTrack } from "@/lib/itunes";
import { fuzzyMatchTitle } from "@/lib/utils";
import { sfxSkip, sfxWrongAttempt } from "@/lib/sfx";
import { deobfuscateTitle } from "@/lib/obfuscate";
import { recordEvent, awardXp } from "@/lib/metrics";
import { useAuth } from "@/lib/auth/AuthProvider";
import { createClient } from "@/lib/supabase/client";
import { useAudioStore } from "@/lib/store/audio";

import {
  LEVELS,
  type Guess,
  type FinishedState,
  loadFinished,
  saveFinished,
  loadSession,
  saveSession,
} from "@/lib/daily/session";

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

  // Clear any leftover audio registration from a different game mode
  // so the floating remote bar doesn't sit on top of the in-page
  // controls when the player switches mode.
  const unregisterAudio = useAudioStore((s) => s.unregisterAudio);
  useEffect(() => {
    const origin = useAudioStore.getState().globalOriginPath;
    if (origin && origin !== "/daily") unregisterAudio();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!done) return;
    setGlobalTrackInfo(realTitle, track.artist);
  }, [done, realTitle, track.artist, setGlobalTrackInfo]);

  // Persist the result the first time we transition to `done`.
  // Also write the result + streak update to Supabase. Best-effort, the
  // local state is the source of truth for the UI.
  //
  // The submittedRef guard stops the RPC firing twice when the user
  // identity object updates (e.g. profile fetch resolves and bumps
  // user). Without it daily_results' unique (user_id, puzzle_date)
  // index returns 409 on the second insert.
  const { user, refreshStreak } = useAuth();
  const submittedRef = useRef<string | null>(null);
  const [freezeConsumed, setFreezeConsumed] = useState(false);
  useEffect(() => {
    if (!done) return;
    saveFinished(track.id, done);
    if (!user) return;
    if (submittedRef.current === track.id) return;
    submittedRef.current = track.id;
    const today = new Date().toISOString().slice(0, 10); // UTC YYYY-MM-DD
    const supabase = createClient();
    supabase
      .rpc("record_daily_result", {
        p_puzzle_date: today,
        p_correct: done.correct,
        p_clip_level: done.levelSolved ?? null,
        p_time_ms: 0,
        // 6 levels: 100, 84, 68, 52, 36, 20.
        p_score: done.correct
          ? Math.max(20, 100 - LEVELS.indexOf(done.levelSolved as (typeof LEVELS)[number]) * 16)
          : 0,
      })
      .then(({ data, error }) => {
        if (error) {
          console.warn("record_daily_result failed:", error.message);
          return;
        }
        const result = data as { freeze_consumed?: boolean } | null;
        if (result?.freeze_consumed) setFreezeConsumed(true);
        refreshStreak();
        // Bump challenge metrics for solving the daily, and grant
        // XP — daily wins are the biggest XP source.
        if (done.correct) {
          recordEvent("daily_solve");
          awardXp(50);
        }
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
      sfxWrongAttempt();
      setLevelIdx(levelIdx + 1);
    }
  }

  function handleSkip() {
    if (done) return;
    const nextArr: Guess[] = [...guesses, { kind: "skipped", value: "" }];
    setGuesses(nextArr);
    if (levelIdx >= LEVELS.length - 1) {
      // Final skip → fail reveal. AudioClip unmounts when `done` is
      // truthy, so the audio stops naturally; no explicit pause needed.
      setDone({ correct: false, guesses: nextArr });
    } else {
      // Audio keeps playing through the skip — the AudioClip effect
      // re-runs with the new (longer) maxSeconds and reschedules its
      // auto-stop timer to the new boundary. Audio only pauses on
      // explicit play/pause click or when it hits the snippet end.
      sfxSkip();
      setLevelIdx(levelIdx + 1);
    }
  }

  return (
    <div className="flex w-full max-w-md flex-col items-center gap-6">
      <StreakBadge />
      <StreakRestoreOffer />
      <ClipLadder currentLevel={current} guesses={ladderStates} />
      {!done && (
        <>
          <AudioClip
            src={proxiedSrc}
            maxSeconds={current}
            playing={playing}
            trackId={track.id}
            onToggle={() => setPlaying((p) => !p)}
            onEnded={() => setPlaying(false)}
          />
          <VolumeControl />
          <GuessInput onGuess={handleGuess} onSkip={handleSkip} currentLevel={current} />
        </>
      )}
      {done && (
        <>
          {freezeConsumed && (
            <div className="rounded-2xl border-2 border-cyan-400 bg-cyan-400/10 px-4 py-3 text-center text-sm font-black uppercase tracking-wider text-cyan-200 shadow-[0_3px_0_0_rgba(0,0,0,0.9)]">
              ❄️ Streak Freeze used — yesterday saved
            </div>
          )}
          <RevealCard
            track={revealTrack}
            correct={done.correct}
            levelSolved={done.levelSolved}
            share={{
              date: new Date().toISOString().slice(0, 10),
              guesses: (done.guesses ?? guesses).map((g) => g.kind),
            }}
          />
          <BonusRoundPrompt />
          <NextDailyCountdown />
          <KeepPlayingCTA />
          <SaveProgressNudge />
        </>
      )}
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
