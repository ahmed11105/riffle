"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Pause, Play, SkipForward, X, LogOut, XCircle } from "lucide-react";
import { Logo } from "@/components/branding/Logo";
import { AudioClip } from "@/components/game/AudioClip";
import { ClipLadder } from "@/components/game/ClipLadder";
import { GuessInput } from "@/components/game/GuessInput";
import { RevealCard } from "@/components/game/RevealCard";
import { WagerPanel } from "@/components/game/WagerPanel";
import { HintPanel } from "@/components/game/HintPanel";
import { LobbyConfig } from "@/components/game/LobbyConfig";
import { PhaseCountdown } from "@/components/game/PhaseCountdown";
import { PauseModal } from "@/components/game/PauseModal";
import { createClient } from "@/lib/supabase/client";
import type { RiffleTrack } from "@/lib/itunes";
import { loadLocalPlayer, saveLocalPlayer, PHASE_DURATIONS, type GuessRecord } from "@/lib/rooms";
import { fuzzyMatchTitle } from "@/lib/utils";
import { sfxSkip } from "@/lib/sfx";
import { useRoomRealtime } from "@/hooks/useRoomRealtime";
import { usePhaseTimer } from "@/hooks/usePhaseTimer";
import { CLIP_LEVELS, type ClipLevel } from "@/lib/game/wager";
import type { HintKind } from "@/lib/riffs/hints";

const LEVELS = [1, 2, 4, 8, 16] as const;
// Per-clip-level countdown in seconds. Each level gets its own timer that
// resets every time the shared level advances. Levels start at 10s for the
// first clip and grow by 2s per step, so 10/12/14/16/18 across 1s..16s.
function levelCountdownFor(levelIdx: number) {
  return 10 + 2 * levelIdx;
}

export function RoomGame({ code }: { code: string }) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const searchParams = useSearchParams();
  const isCreator = searchParams.get("host") === "1";
  const { room, players, round, loading, error, refresh } = useRoomRealtime(code);

  const [player, setPlayer] = useState(() => loadLocalPlayer());
  const [nameDraft, setNameDraft] = useState("");
  const [track, setTrack] = useState<RiffleTrack | null>(null);
  const [hints, setHints] = useState<{ kind: HintKind; value: string }[]>([]);
  const [playing, setPlaying] = useState(false);
  const [showPauseModal, setShowPauseModal] = useState(false);
  const [advancing, setAdvancing] = useState(false);

  // Local drafts of lobby config for the host, synced down from room on load.
  const [draftGenres, setDraftGenres] = useState<string[]>([]);
  const [draftArtists, setDraftArtists] = useState<string[]>([]);
  const [draftRounds, setDraftRounds] = useState<number>(10);
  const [draftAllowFeaturedTracks, setDraftAllowFeaturedTracks] =
    useState<boolean>(false);

  // Keep lobby drafts in sync with server state. For the host we seed once
  // per lobby entry and then let them edit freely, re-syncing on every poll
  // would fight the user's keystrokes (stale poll → reset input). Non-hosts
  // always mirror the server so they see the host's picks live.
  const seededRef = useRef(false);
  useEffect(() => {
    if (!room) return;
    if (room.status !== "lobby" && room.status !== "finished") {
      seededRef.current = false;
      return;
    }
    if (isCreator && seededRef.current) return;
    seededRef.current = true;
    setDraftGenres(room.genres ?? []);
    setDraftArtists(
      (room.artist_query ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    );
    setDraftRounds(room.rounds_total);
    setDraftAllowFeaturedTracks(Boolean(room.allow_featured_tracks));
  }, [room, isCreator]);

  // Ensure this player is in the room_players table when first arriving.
  useEffect(() => {
    if (!player || !room) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("room_players")
        .select("display_name")
        .eq("room_code", code)
        .eq("display_name", player.name)
        .maybeSingle();
      if (cancelled) return;
      if (!data) {
        const { error: insertErr } = await supabase.from("room_players").insert({
          room_code: code,
          display_name: player.name,
          bank: room.starting_bank,
          is_host: isCreator,
        });
        if (insertErr) console.error("[riffle] room_players insert failed", insertErr);
        refresh();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [player, room, code, isCreator, supabase, refresh]);

  // Load the current round's track metadata from the tracks table. We
  // cancel any in-flight fetch when the track_id changes so a slow earlier
  // request can't overwrite a faster later one.
  useEffect(() => {
    if (!round?.track_id) {
      setTrack(null);
      setHints([]);
      return;
    }
    let cancelled = false;
    setTrack(null);
    setHints([]);
    supabase
      .from("tracks")
      .select("*")
      .eq("id", round.track_id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled || !data) return;
        setTrack({
          id: data.id,
          source: "itunes",
          title: data.title,
          artist: data.artist,
          album: data.album ?? "",
          albumArtUrl: data.album_art_url ?? "",
          previewUrl: data.preview_url,
          durationMs: data.duration_ms ?? 0,
          releaseYear: data.release_year ?? undefined,
        });
      });
    return () => {
      cancelled = true;
    };
  }, [round?.track_id, supabase]);

  // Reset per-round client state when the round number changes.
  useEffect(() => {
    setPlaying(false);
  }, [round?.round_num]);

  // Shared clip level across both players (min of committed level_idx for
  // players still active). Computed before any early returns so the autoplay
  // effect below can depend on it.
  const sharedLevelIdx = useMemo(() => {
    const guessMap = round?.guesses ?? {};
    const active = players
      .filter((p) => !guessMap[p.display_name]?.done)
      .map((p) => guessMap[p.display_name]?.level_idx ?? 0);
    if (active.length === 0) return LEVELS.length - 1;
    return Math.min(...active);
  }, [round, players]);

  // Auto-play when entering guess phase, and re-play automatically when the
  // shared clip level advances (so the longer segment kicks off on both
  // clients in sync).
  useEffect(() => {
    if (room?.status === "guess") setPlaying(true);
  }, [room?.status, sharedLevelIdx, round?.round_num]);

  // Per-level countdown. We stamp "now" into state on a 250ms interval while
  // in the guess phase; the remaining time is derived from the delta since
  // the current level began. Resetting `levelStartMs` whenever the shared
  // level advances (or the round changes) is what makes each clip length
  // have its own fresh timer.
  const [levelStartMs, setLevelStartMs] = useState<number>(() => Date.now());
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  useEffect(() => {
    setLevelStartMs(Date.now());
  }, [sharedLevelIdx, round?.round_num, room?.status]);
  useEffect(() => {
    if (room?.status !== "guess") return;
    if (room?.paused) return;
    const id = window.setInterval(() => setNowMs(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [room?.status, room?.paused]);

  // Auto-skip dispatch: when the per-level timer expires we want to fire
  // handleSkip, but that function is defined after the early returns. A ref
  // lets the effect call the latest closure without pulling state up.
  // `firedForLevelRef` guards against double-fires while the write is in
  // flight, the dedupe key is round_num + sharedLevelIdx.
  const autoSkipRef = useRef<(() => void) | null>(null);
  const firedForLevelRef = useRef<string | null>(null);
  useEffect(() => {
    if (room?.status !== "guess") return;
    if (room?.paused) return;
    const elapsed = nowMs - levelStartMs;
    if (elapsed < levelCountdownFor(sharedLevelIdx) * 1000) return;
    const key = `${round?.round_num}:${sharedLevelIdx}`;
    if (firedForLevelRef.current === key) return;
    firedForLevelRef.current = key;
    autoSkipRef.current?.();
  }, [nowMs, levelStartMs, room?.status, room?.paused, round?.round_num, sharedLevelIdx]);

  // Persist lobby config drafts to the room row (host only, debounced).
  useEffect(() => {
    if (!room || !isCreator) return;
    if (room.status !== "lobby" && room.status !== "finished") return;
    const t = setTimeout(async () => {
      // Update the core lobby fields first, these always exist.
      const { error: coreErr } = await supabase
        .from("rooms")
        .update({
          genres: draftGenres,
          artist_query: draftArtists.length > 0 ? draftArtists.join(",") : null,
          rounds_total: draftRounds,
        })
        .eq("code", code);
      if (coreErr) console.error("[riffle] lobby persist failed", coreErr);
      // Try to persist the advanced toggle separately. If the migration
      // that adds this column hasn't been applied we swallow the error so
      // the rest of the lobby config still saves.
      const { error: advErr } = await supabase
        .from("rooms")
        .update({ allow_featured_tracks: draftAllowFeaturedTracks })
        .eq("code", code);
      if (advErr && !/column.*allow_featured_tracks/i.test(advErr.message)) {
        console.error("[riffle] allow_featured_tracks persist failed", advErr);
      }
      refresh();
    }, 350);
    return () => clearTimeout(t);
  }, [
    draftGenres,
    draftArtists,
    draftRounds,
    draftAllowFeaturedTracks,
    room,
    isCreator,
    supabase,
    code,
    refresh,
  ]);

  // Manual advance (lobby Start button only). Auto-advance during play is
  // handled by useRoomRealtime checking the server clock on every poll.
  const advance = useCallback(async () => {
    if (advancing) return;
    setAdvancing(true);
    try {
      const res = await fetch(`/api/rooms/${code}/advance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from: room?.status }),
      });
      await res.json().catch(() => ({}));
    } finally {
      setAdvancing(false);
      refresh();
    }
  }, [advancing, code, refresh, room?.status]);

  const isHost = Boolean(isCreator || players.find((p) => p.display_name === player?.name)?.is_host);

  // Visual countdown only, no longer drives advance (poll loop does that).
  const remaining = usePhaseTimer(room, () => {}, false);

  // Derived per-level countdown. Floored integer seconds for display; auto
  // skip when it hits 0 and the player hasn't already advanced past this
  // level.
  const levelCountdownTotal = levelCountdownFor(sharedLevelIdx);
  const levelRemaining = Math.max(
    0,
    Math.ceil((levelCountdownTotal * 1000 - (nowMs - levelStartMs)) / 1000),
  );

  // ---- Early returns ---------------------------------------------------
  if (error) return <div className="p-10 text-center text-rose-300">{error}</div>;
  if (loading || !room) return <LoadingShell label="Loading room…" />;

  if (!player) {
    return (
      <main className="flex flex-1 flex-col items-center px-6 py-10">
        <Link href="/"><Logo /></Link>
        <div className="mt-10 w-full max-w-md rounded-3xl border-4 border-stone-900 bg-stone-50 p-5 text-stone-900 shadow-[0_8px_0_0_rgba(0,0,0,0.9)]">
          <div className="text-center text-xl font-black">Join room {code}</div>
          <input
            type="text"
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            placeholder="Your name"
            className="mt-3 w-full rounded-full border-2 border-stone-900 bg-stone-100 px-4 py-2.5 font-black placeholder:text-stone-400 focus:outline-none focus:ring-4 focus:ring-amber-300"
          />
          <button
            type="button"
            onClick={() => {
              if (!nameDraft.trim()) return;
              setPlayer(saveLocalPlayer(nameDraft));
            }}
            className="mt-3 w-full rounded-full border-4 border-stone-900 bg-amber-400 px-5 py-3 font-black shadow-[0_4px_0_0_rgba(0,0,0,0.9)] active:translate-y-0.5 active:shadow-[0_2px_0_0_rgba(0,0,0,0.9)]"
          >
            Join
          </button>
        </div>
      </main>
    );
  }

  const me = players.find((p) => p.display_name === player.name);
  const myWager = round?.wagers?.[player.name];
  const myGuess = round?.guesses?.[player.name];
  const proxiedSrc = track
    ? `/api/audio/${track.id}?src=${encodeURIComponent(track.previewUrl)}`
    : "";

  const levelIdx = sharedLevelIdx;
  const myLevelIdx = round?.guesses?.[player.name]?.level_idx ?? 0;
  const iHaveSkippedAhead = myLevelIdx > sharedLevelIdx;
  const solved: ClipLevel | null = myGuess?.correct
    ? (myGuess.clip_level as ClipLevel)
    : null;

  // --- Host controls: pause, end, back to lobby ---
  async function togglePause(next: boolean) {
    await fetch(`/api/rooms/${code}/pause`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paused: next }),
    });
    refresh();
  }
  async function endGame() {
    await fetch(`/api/rooms/${code}/end`, { method: "POST" });
    setShowPauseModal(false);
    refresh();
  }
  async function backToLobby() {
    const res = await fetch(`/api/rooms/${code}/restart`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        genres: draftGenres,
        artist_query: draftArtists.length > 0 ? draftArtists.join(",") : null,
        rounds: draftRounds,
        allow_featured_tracks: draftAllowFeaturedTracks,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error("[riffle] restart failed", res.status, err);
    }
    refresh();
  }

  async function kickPlayer(displayName: string) {
    if (!confirm(`Kick "${displayName}" from the room?`)) return;
    await fetch(`/api/rooms/${code}/kick`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName }),
    });
    refresh();
  }

  async function leaveRoom() {
    if (!confirm("Leave this room?")) return;
    await fetch(`/api/rooms/${code}/leave`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName: player!.name }),
    });
    router.push("/rooms");
  }

  async function endRoom() {
    if (!confirm("End this room for everyone?")) return;
    await fetch(`/api/rooms/${code}/end`, { method: "POST" });
    router.push("/rooms");
  }

  // --- Guess handling (local client) ---
  async function lockInWager(amount: number, level: ClipLevel) {
    if (!round) return;
    const nextWagers = { ...(round.wagers ?? {}), [player!.name]: { amount, level } };
    await supabase
      .from("room_rounds")
      .update({ wagers: nextWagers })
      .eq("room_code", code)
      .eq("round_num", round.round_num);
    refresh();
  }

  // Write the current player's progression for this round. If `done` is
  // true the player is out (solved or failed at the last level) and no
  // longer blocks the shared level from advancing.
  async function writeMyGuess(patch: Partial<GuessRecord>) {
    if (!round) return;
    const prev = (round.guesses?.[player!.name] ?? {}) as Partial<GuessRecord>;
    const merged: GuessRecord = {
      value: prev.value ?? "",
      correct: prev.correct ?? false,
      clip_level: (prev.clip_level ?? LEVELS[levelIdx]) as ClipLevel,
      time_ms: prev.time_ms ?? 0,
      level_idx: prev.level_idx ?? 0,
      done: prev.done ?? false,
      ...patch,
    };
    const nextGuesses = { ...(round.guesses ?? {}), [player!.name]: merged };
    await supabase
      .from("room_rounds")
      .update({ guesses: nextGuesses })
      .eq("room_code", code)
      .eq("round_num", round.round_num);
    refresh();
  }

  function handleGuess(value: string) {
    if (solved || !track || iHaveSkippedAhead) return;
    // Check if another player already solved, if so, this player's
    // guess can still be recorded but won't count as a "first solve".
    const guessMap = round?.guesses ?? {};
    const someoneAlreadySolved = Object.values(guessMap).some(
      (g) => g?.correct && g?.done,
    );
    const correct = fuzzyMatchTitle(value, track.title);
    if (correct && !someoneAlreadySolved) {
      setPlaying(false);
      writeMyGuess({
        value,
        correct: true,
        clip_level: LEVELS[levelIdx] as ClipLevel,
        level_idx: myLevelIdx,
        done: true,
        solved_at: Date.now(),
      });
    } else if (correct && someoneAlreadySolved) {
      // Someone beat us to it, record as done but not the winner.
      setPlaying(false);
      writeMyGuess({
        value,
        correct: true,
        clip_level: LEVELS[levelIdx] as ClipLevel,
        level_idx: myLevelIdx,
        done: true,
      });
    } else {
      // Wrong answer behaves like a skip: commit to the next level and wait
      // for the other player before the longer segment plays.
      if (myLevelIdx >= LEVELS.length - 1) {
        writeMyGuess({
          value,
          correct: false,
          clip_level: LEVELS[myLevelIdx] as ClipLevel,
          level_idx: myLevelIdx,
          done: true,
        });
      } else {
        writeMyGuess({ value, level_idx: myLevelIdx + 1, done: false });
      }
    }
  }

  function handleSkip() {
    if (solved || iHaveSkippedAhead) return;
    sfxSkip();
    if (myLevelIdx >= LEVELS.length - 1) {
      writeMyGuess({
        clip_level: LEVELS[myLevelIdx] as ClipLevel,
        level_idx: myLevelIdx,
        done: true,
      });
    } else {
      writeMyGuess({ level_idx: myLevelIdx + 1, done: false });
    }
  }

  // Silent variant for timer expiry, same effect as pressing SKIP but
  // without the sound cue, and only when the player hasn't already moved
  // past this level.
  autoSkipRef.current = () => {
    if (solved || iHaveSkippedAhead) return;
    if (myLevelIdx >= LEVELS.length - 1) {
      writeMyGuess({
        clip_level: LEVELS[myLevelIdx] as ClipLevel,
        level_idx: myLevelIdx,
        done: true,
      });
    } else {
      writeMyGuess({ level_idx: myLevelIdx + 1, done: false });
    }
  };

  const myCorrectLevelIdx =
    myGuess?.correct && myGuess.clip_level
      ? LEVELS.indexOf(myGuess.clip_level as (typeof LEVELS)[number])
      : -1;
  const ladder: ("pending" | "wrong" | "skipped" | "correct")[] = LEVELS.map(
    (_, i) => {
      if (i === myCorrectLevelIdx) return "correct";
      if (i < myLevelIdx) return "skipped";
      return "pending";
    },
  );

  const phaseLabel =
    room.status === "wager"
      ? "Wager phase"
      : room.status === "guess"
        ? "Guess phase"
        : room.status === "reveal"
          ? "Round reveal"
          : "";

  // ---- Render ----------------------------------------------------------
  return (
    <main className="flex flex-1 flex-col items-center px-4 py-6">
      <PauseModal
        open={showPauseModal}
        onResume={() => {
          setShowPauseModal(false);
          togglePause(false);
        }}
        onEnd={endGame}
        onLeave={leaveRoom}
        isHost={isHost}
      />

      <header className="flex w-full max-w-md items-center justify-between gap-2">
        {/* Left: pause / host */}
        {isHost && room.status !== "lobby" && room.status !== "finished" ? (
          <button
            type="button"
            onClick={() => {
              togglePause(true);
              setShowPauseModal(true);
            }}
            aria-label="Pause game"
            className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-stone-900 bg-stone-50 text-stone-900 shadow-[0_3px_0_0_rgba(0,0,0,0.9)] hover:bg-amber-100"
          >
            <Pause className="h-4 w-4" />
          </button>
        ) : room.status !== "lobby" && room.status !== "finished" ? (
          <button
            type="button"
            onClick={leaveRoom}
            aria-label="Leave room"
            className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-stone-900 bg-stone-50 text-stone-900 shadow-[0_3px_0_0_rgba(0,0,0,0.9)] hover:bg-rose-100"
          >
            <LogOut className="h-4 w-4" />
          </button>
        ) : (
          <Link href="/"><Logo /></Link>
        )}
        {/* Center: room code */}
        <div className="flex items-center gap-2 rounded-full border-2 border-stone-900 bg-stone-50 px-3 py-1 font-mono text-xs font-black text-stone-900">
          ROOM {code}
          <button
            type="button"
            onClick={() =>
              navigator.clipboard.writeText(`${window.location.origin}/rooms/${code}`)
            }
            className="text-[10px] uppercase text-amber-600 hover:text-amber-700"
          >
            copy
          </button>
        </div>
        {/* Right: host skip-phase button */}
        {isHost &&
        (room.status === "wager" ||
          room.status === "guess" ||
          room.status === "reveal") ? (
          <button
            type="button"
            onClick={advance}
            disabled={advancing}
            aria-label="Skip phase"
            title="Skip to next phase"
            className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-stone-900 bg-amber-400 text-stone-900 shadow-[0_3px_0_0_rgba(0,0,0,0.9)] transition active:translate-y-0.5 active:shadow-[0_1px_0_0_rgba(0,0,0,0.9)] disabled:opacity-60"
          >
            <SkipForward className="h-4 w-4 fill-stone-900" />
          </button>
        ) : (
          <div className="h-10 w-10" />
        )}
      </header>

      {/* Round header */}
      {room.status !== "lobby" && room.status !== "finished" && (
        <div className="mt-4 flex w-full max-w-md flex-col gap-2">
          <div className="text-center text-xs uppercase tracking-wider text-amber-100/60">
            Round {Math.max(1, room.current_round)} / {room.rounds_total}
          </div>
          <Leaderboard players={players} me={player.name} />
          {phaseLabel &&
            (room.status === "guess" ? (
              <PhaseCountdown
                label={
                  room.paused
                    ? `${LEVELS[levelIdx]}s clip · paused`
                    : `${LEVELS[levelIdx]}s clip`
                }
                remaining={levelRemaining}
                total={levelCountdownTotal}
              />
            ) : (
              <PhaseCountdown
                label={room.paused ? `${phaseLabel} · paused` : phaseLabel}
                remaining={remaining}
                total={PHASE_DURATIONS[room.status]}
              />
            ))}
        </div>
      )}

      <section className="mt-5 flex w-full max-w-md flex-col items-center gap-5">
        {/* Lobby */}
        {room.status === "lobby" && (
          <Lobby
            code={code}
            isHost={isHost}
            players={players}
            me={player.name}
            onStart={advance}
            advancing={advancing}
            genres={draftGenres}
            artists={draftArtists}
            rounds={draftRounds}
            allowFeaturedTracks={draftAllowFeaturedTracks}
            onGenresChange={setDraftGenres}
            onArtistsChange={setDraftArtists}
            onRoundsChange={setDraftRounds}
            onAllowFeaturedTracksChange={setDraftAllowFeaturedTracks}
            onKick={kickPlayer}
            onLeave={leaveRoom}
            onEnd={endRoom}
          />
        )}

        {/* Wager phase */}
        {room.status === "wager" &&
          (me ? (
            <WagerPanel
              bank={me.bank}
              onLockIn={lockInWager}
              locked={Boolean(myWager)}
              lockedAmount={myWager?.amount}
              lockedLevel={myWager?.level as ClipLevel | undefined}
            />
          ) : (
            <LoadingShell label="Syncing players…" />
          ))}

        {/* Guess phase */}
        {room.status === "guess" &&
          (track ? (
            <>
              <ClipLadder currentLevel={LEVELS[levelIdx]} guesses={ladder} />
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
              <GuessInput
                onGuess={handleGuess}
                onSkip={handleSkip}
                disabled={Boolean(solved || myGuess?.correct || iHaveSkippedAhead)}
                artistFilter={(room.artist_query ?? "")
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean)}
              />
              <HintPanel
                track={track}
                revealed={hints}
                onReveal={(h) => setHints((prev) => [...prev, h])}
                disabled={Boolean(solved || myGuess?.correct || iHaveSkippedAhead)}
              />
              {solved && (
                <p className="text-sm font-black text-emerald-300">
                  Got it! Waiting for the round to end…
                </p>
              )}
              {!solved && iHaveSkippedAhead && (
                <p className="text-sm font-black text-amber-200">
                  Waiting for other players to skip…
                </p>
              )}
            </>
          ) : (
            <LoadingShell label="Loading track…" />
          ))}

        {/* Reveal */}
        {room.status === "reveal" &&
          (track ? (
            <>
              <RoundWinnerBanner guesses={round?.guesses ?? {}} players={players} />
              <RevealCard
                track={track}
                correct={Boolean(myGuess?.correct)}
                levelSolved={myGuess?.clip_level}
              />
              {remaining <= 8 && (
                <button
                  type="button"
                  onClick={advance}
                  disabled={advancing}
                  className="w-full rounded-full border-4 border-stone-900 bg-amber-400 px-6 py-3 text-lg font-black text-stone-900 shadow-[0_4px_0_0_rgba(0,0,0,0.9)] transition active:translate-y-0.5 active:shadow-[0_2px_0_0_rgba(0,0,0,0.9)] disabled:opacity-60"
                >
                  {advancing ? "Starting…" : "Next round →"}
                </button>
              )}
            </>
          ) : (
            <LoadingShell label="Revealing…" />
          ))}

        {/* Finished */}
        {room.status === "finished" && (
          <FinalResults
            players={players}
            me={player.name}
            isHost={isHost}
            onBackToLobby={backToLobby}
            onExit={() => router.push("/rooms")}
            genres={draftGenres}
            artists={draftArtists}
            rounds={draftRounds}
            onGenresChange={setDraftGenres}
            onArtistsChange={setDraftArtists}
            onRoundsChange={setDraftRounds}
          />
        )}
      </section>
    </main>
  );
}

function RoundWinnerBanner({
  guesses,
  players,
}: {
  guesses: Record<string, GuessRecord>;
  players: { display_name: string }[];
}) {
  // Find all players who guessed correctly, pick the one with the
  // earliest solved_at (or lowest clip_level as tiebreaker).
  const solvers = players
    .map((p) => ({ name: p.display_name, guess: guesses[p.display_name] }))
    .filter((p) => p.guess?.correct);

  if (solvers.length === 0) {
    return (
      <div className="w-full rounded-2xl bg-stone-800 px-4 py-3 text-center text-sm font-black text-stone-400">
        Nobody got it this round
      </div>
    );
  }

  // Sort by solved_at (earliest wins), then clip_level (lower = harder = better)
  solvers.sort((a, b) => {
    const aTime = a.guess?.solved_at ?? Infinity;
    const bTime = b.guess?.solved_at ?? Infinity;
    if (aTime !== bTime) return aTime - bTime;
    const aLevel = a.guess?.clip_level ?? 16;
    const bLevel = b.guess?.clip_level ?? 16;
    return aLevel - bLevel;
  });

  const winner = solvers[0];
  return (
    <div className="w-full rounded-2xl border-2 border-emerald-500 bg-emerald-500/20 px-4 py-3 text-center">
      <div className="text-xs font-black uppercase tracking-wider text-emerald-300">
        Round winner
      </div>
      <div className="mt-1 text-lg font-black text-emerald-100">
        {winner.name}
      </div>
      <div className="text-xs text-emerald-300/60">
        Solved at {winner.guess?.clip_level ?? "?"}s clip
      </div>
    </div>
  );
}

function LoadingShell({ label }: { label: string }) {
  return (
    <div className="flex min-h-[240px] w-full max-w-md flex-col items-center justify-center gap-3 text-amber-100/70">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-amber-300 border-t-transparent" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

function Lobby({
  code,
  isHost,
  players,
  me,
  onStart,
  advancing,
  genres,
  artists,
  rounds,
  allowFeaturedTracks,
  onGenresChange,
  onArtistsChange,
  onRoundsChange,
  onAllowFeaturedTracksChange,
  onKick,
  onLeave,
  onEnd,
}: {
  code: string;
  isHost: boolean;
  players: { display_name: string }[];
  me: string;
  onStart: () => void;
  advancing: boolean;
  genres: string[];
  artists: string[];
  rounds: number;
  allowFeaturedTracks: boolean;
  onGenresChange: (g: string[]) => void;
  onArtistsChange: (a: string[]) => void;
  onRoundsChange: (r: number) => void;
  onAllowFeaturedTracksChange: (v: boolean) => void;
  onKick: (name: string) => void;
  onLeave: () => void;
  onEnd: () => void;
}) {
  return (
    <div className="flex w-full flex-col gap-4">
      <div className="rounded-3xl border-4 border-stone-900 bg-stone-50 p-5 text-stone-900 shadow-[0_8px_0_0_rgba(0,0,0,0.9)]">
        <div className="text-xs font-bold uppercase tracking-wider text-stone-500">
          Share this code
        </div>
        <div className="mt-1 font-mono text-4xl font-black tracking-widest">{code}</div>
        <p className="mt-2 text-sm text-stone-600">
          {players.length === 0
            ? "Waiting for players to join…"
            : `${players.length} player${players.length === 1 ? "" : "s"} in the lobby`}
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {players.map((p) => (
            <span
              key={p.display_name}
              className={
                p.display_name === me
                  ? "flex items-center gap-1 rounded-full bg-amber-400 px-3 py-0.5 text-xs font-black text-stone-900"
                  : "flex items-center gap-1 rounded-full bg-stone-100 px-3 py-0.5 text-xs font-black text-stone-700"
              }
            >
              {p.display_name}
              {isHost && p.display_name !== me && (
                <button
                  type="button"
                  onClick={() => onKick(p.display_name)}
                  aria-label={`Kick ${p.display_name}`}
                  className="ml-0.5 rounded-full hover:text-rose-600"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </span>
          ))}
        </div>
      </div>

      <LobbyConfig
        isHost={isHost}
        genres={genres}
        artists={artists}
        rounds={rounds}
        allowFeaturedTracks={allowFeaturedTracks}
        onGenresChange={onGenresChange}
        onArtistsChange={onArtistsChange}
        onRoundsChange={onRoundsChange}
        onAllowFeaturedTracksChange={onAllowFeaturedTracksChange}
      />

      {isHost ? (
        <button
          type="button"
          onClick={onStart}
          disabled={advancing}
          className="group flex w-full items-center justify-center gap-3 rounded-full border-4 border-stone-900 bg-amber-400 px-6 py-5 text-2xl font-black text-stone-900 shadow-[0_8px_0_0_rgba(0,0,0,0.9)] transition active:translate-y-1 active:shadow-[0_2px_0_0_rgba(0,0,0,0.9)] disabled:opacity-60"
        >
          <Play className="h-6 w-6 fill-stone-900" />
          {advancing ? "Starting…" : "START"}
        </button>
      ) : (
        <div className="rounded-full bg-stone-100/10 px-4 py-3 text-center text-sm font-bold text-amber-100/60">
          Waiting for host to start…
        </div>
      )}

      <div className="flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={onLeave}
          className="flex items-center gap-2 text-xs uppercase tracking-wider text-amber-100/50 hover:text-rose-400"
        >
          <LogOut className="h-3 w-3" />
          Leave room
        </button>
        {isHost && (
          <button
            type="button"
            onClick={onEnd}
            className="flex items-center gap-2 text-xs uppercase tracking-wider text-amber-100/50 hover:text-rose-400"
          >
            <XCircle className="h-3 w-3" />
            Close room
          </button>
        )}
      </div>
    </div>
  );
}

function Leaderboard({
  players,
  me,
}: {
  players: { display_name: string; bank: number; correct_count: number }[];
  me: string;
}) {
  const sorted = [...players].sort((a, b) => b.bank - a.bank);
  return (
    <div className="flex flex-wrap gap-2 rounded-2xl border-2 border-stone-900 bg-stone-50/5 p-2">
      {sorted.length === 0 && <span className="text-xs text-amber-100/60">No players yet…</span>}
      {sorted.map((p) => (
        <div
          key={p.display_name}
          className={
            p.display_name === me
              ? "flex items-center gap-2 rounded-full bg-amber-400 px-3 py-1 text-xs font-black text-stone-900"
              : "flex items-center gap-2 rounded-full bg-stone-100/10 px-3 py-1 text-xs font-black text-amber-100"
          }
        >
          <span className="truncate">{p.display_name}</span>
          <span className="font-mono text-[10px] text-amber-600">{p.bank}</span>
        </div>
      ))}
    </div>
  );
}

function FinalResults({
  players,
  me,
  isHost,
  onBackToLobby,
  onExit,
  genres,
  artists,
  rounds,
  onGenresChange,
  onArtistsChange,
  onRoundsChange,
}: {
  players: { display_name: string; bank: number; correct_count: number }[];
  me: string;
  isHost: boolean;
  onBackToLobby: () => void;
  onExit: () => void;
  genres: string[];
  artists: string[];
  rounds: number;
  onGenresChange: (g: string[]) => void;
  onArtistsChange: (a: string[]) => void;
  onRoundsChange: (r: number) => void;
}) {
  // Unused here now that the final-results screen doesn't reuse LobbyConfig.
  // The host re-configures from the actual lobby after clicking "Play again".
  void genres;
  void artists;
  void rounds;
  void onGenresChange;
  void onArtistsChange;
  void onRoundsChange;

  const sorted = [...players].sort((a, b) => b.bank - a.bank);
  const winner = sorted[0];
  const runnerUp = sorted[1];
  const myRank = sorted.findIndex((p) => p.display_name === me) + 1;
  const iWon = winner?.display_name === me;
  return (
    <div className="flex w-full flex-col items-center gap-6">
      {/* Hero: big "Game Over" banner so it reads nothing like the lobby. */}
      <div className="flex w-full flex-col items-center gap-2 rounded-3xl border-4 border-stone-900 bg-gradient-to-br from-rose-500 via-amber-400 to-amber-300 p-6 text-stone-900 shadow-[0_10px_0_0_rgba(0,0,0,0.9)]">
        <div className="text-xs font-black uppercase tracking-[0.3em] text-stone-900/80">
          Game Over
        </div>
        <div className="text-center text-3xl font-black leading-tight">
          {winner ? (iWon ? "You win!" : `${winner.display_name} wins`) : "No winner"}
        </div>
        {winner && (
          <div className="font-mono text-sm font-black text-stone-900/80">
            {winner.bank} coins
            {runnerUp ? ` · +${winner.bank - runnerUp.bank} over 2nd` : ""}
          </div>
        )}
        {!iWon && myRank > 0 && (
          <div className="mt-1 rounded-full bg-stone-900/20 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-stone-900">
            You finished #{myRank}
          </div>
        )}
      </div>

      {/* Scoreboard */}
      <div className="w-full rounded-3xl border-4 border-stone-900 bg-stone-50 p-4 text-stone-900 shadow-[0_8px_0_0_rgba(0,0,0,0.9)]">
        <div className="mb-2 text-center text-[11px] font-black uppercase tracking-wider text-stone-500">
          Final scoreboard
        </div>
        <ol className="space-y-2">
          {sorted.map((p, i) => {
            const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`;
            return (
              <li
                key={p.display_name}
                className={
                  p.display_name === me
                    ? "flex items-center justify-between rounded-xl bg-amber-100 px-3 py-2"
                    : "flex items-center justify-between rounded-xl bg-stone-100 px-3 py-2"
                }
              >
                <div className="flex items-center gap-3">
                  <span className="w-8 text-center font-mono text-sm font-black text-stone-600">
                    {medal}
                  </span>
                  <span className="font-black">{p.display_name}</span>
                </div>
                <div className="text-right">
                  <div className="font-black">{p.bank} coins</div>
                  <div className="text-xs text-stone-500">{p.correct_count} correct</div>
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      {isHost ? (
        <button
          type="button"
          onClick={onBackToLobby}
          className="w-full rounded-full border-4 border-stone-900 bg-emerald-400 px-6 py-4 text-xl font-black text-stone-900 shadow-[0_6px_0_0_rgba(0,0,0,0.9)] transition active:translate-y-1 active:shadow-[0_2px_0_0_rgba(0,0,0,0.9)]"
        >
          Back to lobby
        </button>
      ) : (
        <div className="rounded-full bg-stone-100/10 px-4 py-3 text-center text-sm font-bold text-amber-100/60">
          Waiting for host to start a new game…
        </div>
      )}

      <button
        type="button"
        onClick={onExit}
        className="text-xs uppercase tracking-wider text-amber-100/60 hover:text-amber-200"
      >
        Exit to rooms list
      </button>
    </div>
  );
}
