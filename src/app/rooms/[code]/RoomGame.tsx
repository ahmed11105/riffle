"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Pause, Play } from "lucide-react";
import { Logo } from "@/components/branding/Logo";
import { AudioClip } from "@/components/game/AudioClip";
import { ClipLadder } from "@/components/game/ClipLadder";
import { GuessInput } from "@/components/game/GuessInput";
import { RevealCard } from "@/components/game/RevealCard";
import { WagerPanel } from "@/components/game/WagerPanel";
import { LobbyConfig } from "@/components/game/LobbyConfig";
import { PhaseCountdown } from "@/components/game/PhaseCountdown";
import { PauseModal } from "@/components/game/PauseModal";
import { createClient } from "@/lib/supabase/client";
import type { RiffleTrack } from "@/lib/itunes";
import { loadLocalPlayer, saveLocalPlayer, PHASE_DURATIONS } from "@/lib/rooms";
import { fuzzyMatchTitle } from "@/lib/utils";
import { sfxSkip } from "@/lib/sfx";
import { useRoomRealtime } from "@/hooks/useRoomRealtime";
import { usePhaseTimer } from "@/hooks/usePhaseTimer";
import { CLIP_LEVELS, type ClipLevel } from "@/lib/game/wager";

const LEVELS = [1, 2, 4, 8, 16] as const;

export function RoomGame({ code }: { code: string }) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const searchParams = useSearchParams();
  const isCreator = searchParams.get("host") === "1";
  const { room, players, round, loading, error, refresh } = useRoomRealtime(code);

  const [player, setPlayer] = useState(() => loadLocalPlayer());
  const [nameDraft, setNameDraft] = useState("");
  const [track, setTrack] = useState<RiffleTrack | null>(null);
  const [levelIdx, setLevelIdx] = useState(0);
  const [guessed, setGuessed] = useState<("pending" | "wrong" | "skipped" | "correct")[]>([]);
  const [playing, setPlaying] = useState(false);
  const [solved, setSolved] = useState<ClipLevel | null>(null);
  const [showPauseModal, setShowPauseModal] = useState(false);
  const [advancing, setAdvancing] = useState(false);

  // Local drafts of lobby config for the host — synced down from room on load.
  const [draftGenres, setDraftGenres] = useState<string[]>([]);
  const [draftArtist, setDraftArtist] = useState<string>("");
  const [draftRounds, setDraftRounds] = useState<number>(10);

  // Keep lobby drafts in sync with server state whenever we're in lobby.
  useEffect(() => {
    if (!room) return;
    if (room.status === "lobby" || room.status === "finished") {
      setDraftGenres(room.genres ?? []);
      setDraftArtist(room.artist_query ?? "");
      setDraftRounds(room.rounds_total);
    }
  }, [room]);

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
      return;
    }
    let cancelled = false;
    setTrack(null);
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
    setLevelIdx(0);
    setGuessed([]);
    setSolved(null);
    setPlaying(false);
  }, [round?.round_num]);

  // Auto-play the clip when the round flips into guess phase.
  useEffect(() => {
    if (room?.status === "guess") setPlaying(true);
  }, [room?.status]);

  // Persist lobby config drafts to the room row (host only, debounced).
  useEffect(() => {
    if (!room || !isCreator) return;
    if (room.status !== "lobby" && room.status !== "finished") return;
    const t = setTimeout(() => {
      supabase
        .from("rooms")
        .update({
          genres: draftGenres,
          artist_query: draftArtist || null,
          rounds_total: draftRounds,
        })
        .eq("code", code)
        .then(() => refresh());
    }, 350);
    return () => clearTimeout(t);
  }, [draftGenres, draftArtist, draftRounds, room, isCreator, supabase, code, refresh]);

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

  // Visual countdown only — no longer drives advance (poll loop does that).
  const remaining = usePhaseTimer(room, () => {}, false);

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
    await fetch(`/api/rooms/${code}/restart`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        genres: draftGenres,
        artist_query: draftArtist || null,
        rounds: draftRounds,
      }),
    });
    refresh();
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

  async function recordGuess(kind: "correct" | "wrong" | "skipped", value = "") {
    if (!round || !track) return;
    const level = LEVELS[levelIdx] as ClipLevel;
    const nextGuesses = {
      ...(round.guesses ?? {}),
      [player!.name]: {
        value,
        correct: kind === "correct",
        clip_level: level,
        time_ms: 0,
      },
    };
    await supabase
      .from("room_rounds")
      .update({ guesses: nextGuesses })
      .eq("room_code", code)
      .eq("round_num", round.round_num);
    refresh();
  }

  function handleGuess(value: string) {
    if (solved || !track) return;
    const correct = fuzzyMatchTitle(value, track.title);
    if (correct) {
      setGuessed((g) => [...g, "correct"]);
      setSolved(LEVELS[levelIdx] as ClipLevel);
      setPlaying(false);
      recordGuess("correct", value);
    } else {
      setGuessed((g) => [...g, "wrong"]);
      setPlaying(false);
      if (levelIdx >= LEVELS.length - 1) {
        recordGuess("wrong", value);
      } else {
        setLevelIdx(levelIdx + 1);
      }
    }
  }

  function handleSkip() {
    if (solved) return;
    sfxSkip();
    setGuessed((g) => [...g, "skipped"]);
    setPlaying(false);
    if (levelIdx >= LEVELS.length - 1) {
      recordGuess("wrong");
    } else {
      setLevelIdx(levelIdx + 1);
    }
  }

  const ladder: ("pending" | "wrong" | "skipped" | "correct")[] = LEVELS.map(
    (_, i) => guessed[i] ?? "pending",
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
      </header>

      {/* Round header */}
      {room.status !== "lobby" && room.status !== "finished" && (
        <div className="mt-4 flex w-full max-w-md flex-col gap-2">
          <div className="text-center text-xs uppercase tracking-wider text-amber-100/60">
            Round {Math.max(1, room.current_round)} / {room.rounds_total}
          </div>
          <Leaderboard players={players} me={player.name} />
          {phaseLabel && (
            <PhaseCountdown
              label={room.paused ? `${phaseLabel} · paused` : phaseLabel}
              remaining={remaining}
              total={PHASE_DURATIONS[room.status]}
            />
          )}
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
            artistQuery={draftArtist}
            rounds={draftRounds}
            onGenresChange={setDraftGenres}
            onArtistChange={setDraftArtist}
            onRoundsChange={setDraftRounds}
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
                disabled={Boolean(solved || myGuess?.correct)}
              />
              {solved && (
                <p className="text-sm font-black text-emerald-300">
                  Got it! Waiting for the round to end…
                </p>
              )}
            </>
          ) : (
            <LoadingShell label="Loading track…" />
          ))}

        {/* Reveal */}
        {room.status === "reveal" &&
          (track ? (
            <RevealCard
              track={track}
              correct={Boolean(myGuess?.correct)}
              levelSolved={myGuess?.clip_level}
            />
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
            artistQuery={draftArtist}
            rounds={draftRounds}
            onGenresChange={setDraftGenres}
            onArtistChange={setDraftArtist}
            onRoundsChange={setDraftRounds}
          />
        )}
      </section>
    </main>
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
  artistQuery,
  rounds,
  onGenresChange,
  onArtistChange,
  onRoundsChange,
}: {
  code: string;
  isHost: boolean;
  players: { display_name: string }[];
  me: string;
  onStart: () => void;
  advancing: boolean;
  genres: string[];
  artistQuery: string;
  rounds: number;
  onGenresChange: (g: string[]) => void;
  onArtistChange: (a: string) => void;
  onRoundsChange: (r: number) => void;
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
                  ? "rounded-full bg-amber-400 px-3 py-0.5 text-xs font-black text-stone-900"
                  : "rounded-full bg-stone-100 px-3 py-0.5 text-xs font-black text-stone-700"
              }
            >
              {p.display_name}
            </span>
          ))}
        </div>
      </div>

      <LobbyConfig
        isHost={isHost}
        genres={genres}
        artistQuery={artistQuery}
        rounds={rounds}
        onGenresChange={onGenresChange}
        onArtistChange={onArtistChange}
        onRoundsChange={onRoundsChange}
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
  artistQuery,
  rounds,
  onGenresChange,
  onArtistChange,
  onRoundsChange,
}: {
  players: { display_name: string; bank: number; correct_count: number }[];
  me: string;
  isHost: boolean;
  onBackToLobby: () => void;
  onExit: () => void;
  genres: string[];
  artistQuery: string;
  rounds: number;
  onGenresChange: (g: string[]) => void;
  onArtistChange: (a: string) => void;
  onRoundsChange: (r: number) => void;
}) {
  const sorted = [...players].sort((a, b) => b.bank - a.bank);
  const winner = sorted[0];
  return (
    <div className="flex w-full flex-col items-center gap-5">
      <div className="text-xs uppercase tracking-wider text-amber-100/60">Final results</div>
      <div className="text-4xl font-black text-amber-100">🏆 {winner?.display_name ?? "—"}</div>
      <div className="w-full rounded-3xl border-4 border-stone-900 bg-stone-50 p-4 text-stone-900 shadow-[0_8px_0_0_rgba(0,0,0,0.9)]">
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

      {isHost && (
        <>
          <div className="text-xs uppercase tracking-wider text-amber-100/60">Play again?</div>
          <LobbyConfig
            isHost
            genres={genres}
            artistQuery={artistQuery}
            rounds={rounds}
            onGenresChange={onGenresChange}
            onArtistChange={onArtistChange}
            onRoundsChange={onRoundsChange}
          />
          <button
            type="button"
            onClick={onBackToLobby}
            className="w-full rounded-full border-4 border-stone-900 bg-amber-400 px-6 py-4 text-xl font-black shadow-[0_6px_0_0_rgba(0,0,0,0.9)] transition active:translate-y-1 active:shadow-[0_2px_0_0_rgba(0,0,0,0.9)]"
          >
            Back to Lobby
          </button>
        </>
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
