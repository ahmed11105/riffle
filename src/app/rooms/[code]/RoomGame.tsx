"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Logo } from "@/components/branding/Logo";
import { AudioClip } from "@/components/game/AudioClip";
import { ClipLadder } from "@/components/game/ClipLadder";
import { GuessInput } from "@/components/game/GuessInput";
import { RevealCard } from "@/components/game/RevealCard";
import { WagerPanel } from "@/components/game/WagerPanel";
import { createClient } from "@/lib/supabase/client";
import type { RiffleTrack } from "@/lib/itunes";
import { loadLocalPlayer, saveLocalPlayer } from "@/lib/rooms";
import { fuzzyMatchTitle } from "@/lib/utils";
import { sfxSkip } from "@/lib/sfx";
import { useRoomRealtime } from "@/hooks/useRoomRealtime";
import { CLIP_LEVELS, type ClipLevel } from "@/lib/game/wager";

const LEVELS = [1, 2, 4, 8, 16] as const;

export function RoomGame({ code }: { code: string }) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const searchParams = useSearchParams();
  const isCreator = searchParams.get("host") === "1";
  const { room, players, round, loading, error } = useRoomRealtime(code);

  const [player, setPlayer] = useState(() => loadLocalPlayer());
  const [nameDraft, setNameDraft] = useState("");
  const [joining, setJoining] = useState(false);
  const [track, setTrack] = useState<RiffleTrack | null>(null);
  const [levelIdx, setLevelIdx] = useState(0);
  const [guessed, setGuessed] = useState<("pending" | "wrong" | "skipped" | "correct")[]>([]);
  const [playing, setPlaying] = useState(false);
  const [solved, setSolved] = useState<ClipLevel | null>(null);
  const [advancing, setAdvancing] = useState(false);

  // Ensure this player is in the room_players table when first arriving.
  useEffect(() => {
    if (!player || !room) return;
    (async () => {
      const { data } = await supabase
        .from("room_players")
        .select("display_name")
        .eq("room_code", code)
        .eq("display_name", player.name)
        .maybeSingle();
      if (!data) {
        await supabase.from("room_players").insert({
          room_code: code,
          display_name: player.name,
          bank: room.starting_bank,
          is_host: isCreator,
        });
        if (isCreator && !room.host_id) {
          // host_id requires a profile row; we don't have auth yet, so leave null.
        }
      }
    })();
  }, [player, room, code, isCreator, supabase]);

  // Load the current round's track metadata from the tracks table.
  useEffect(() => {
    if (!round?.track_id) {
      setTrack(null);
      return;
    }
    supabase
      .from("tracks")
      .select("*")
      .eq("id", round.track_id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
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

  if (error) return <div className="p-10 text-center text-rose-300">{error}</div>;
  if (loading || !room) return <div className="p-10 text-center text-amber-100/70">Loading room…</div>;

  // No local identity — prompt for a name.
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
              if (!nameDraft.trim() || joining) return;
              setJoining(true);
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
  const isHost = Boolean(isCreator || me?.is_host);
  const myWager = round?.wagers?.[player.name];
  const myGuess = round?.guesses?.[player.name];
  const proxiedSrc = track
    ? `/api/audio/${track.id}?src=${encodeURIComponent(track.previewUrl)}`
    : "";

  async function advance() {
    if (!isHost || advancing) return;
    setAdvancing(true);
    try {
      if (room && room.status === "reveal") {
        await fetch(`/api/rooms/${code}/settle`, { method: "POST" });
      }
      await fetch(`/api/rooms/${code}/advance`, { method: "POST" });
    } finally {
      setAdvancing(false);
    }
  }

  async function lockInWager(amount: number, level: ClipLevel) {
    if (!round) return;
    const nextWagers = { ...(round.wagers ?? {}), [player!.name]: { amount, level } };
    await supabase
      .from("room_rounds")
      .update({ wagers: nextWagers })
      .eq("room_code", code)
      .eq("round_num", round.round_num);
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

  return (
    <main className="flex flex-1 flex-col items-center px-4 py-6">
      <header className="flex w-full max-w-md items-center justify-between">
        <Link href="/"><Logo /></Link>
        <div className="flex items-center gap-2 rounded-full border-2 border-stone-900 bg-stone-50 px-3 py-1 font-mono text-xs font-black text-stone-900">
          ROOM {code}
          <button
            type="button"
            onClick={() => navigator.clipboard.writeText(`${window.location.origin}/rooms/${code}`)}
            className="text-[10px] uppercase text-amber-600 hover:text-amber-700"
          >
            copy link
          </button>
        </div>
      </header>

      <div className="mt-4 flex w-full max-w-md flex-col gap-2">
        <div className="text-center text-xs uppercase tracking-wider text-amber-100/60">
          Round {Math.max(1, room.current_round)} / {room.rounds_total}
        </div>
        <Leaderboard players={players} me={player.name} />
      </div>

      <section className="mt-5 flex w-full max-w-md flex-col items-center gap-5">
        {room.status === "lobby" && (
          <Lobby
            code={code}
            isHost={isHost}
            onStart={advance}
            advancing={advancing}
          />
        )}

        {room.status === "wager" && me && (
          <>
            <div className="text-2xl font-black text-amber-100">Place your wager</div>
            <WagerPanel
              bank={me.bank}
              onLockIn={(amount, level) => lockInWager(amount, level)}
              locked={Boolean(myWager)}
              lockedAmount={myWager?.amount}
              lockedLevel={myWager?.level as ClipLevel | undefined}
            />
            {isHost && (
              <button
                type="button"
                onClick={advance}
                disabled={advancing}
                className="rounded-full border-2 border-stone-900 bg-stone-50 px-5 py-2 text-xs font-black text-stone-900 shadow-[0_3px_0_0_rgba(0,0,0,0.9)] disabled:opacity-50"
              >
                Host: start guessing phase →
              </button>
            )}
          </>
        )}

        {room.status === "guess" && track && (
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
              Playing the first {LEVELS[levelIdx]} second{LEVELS[levelIdx] === 1 ? "" : "s"}
            </p>
            <GuessInput onGuess={handleGuess} onSkip={handleSkip} disabled={Boolean(solved || myGuess?.correct)} />
            {solved && (
              <p className="text-sm font-black text-emerald-300">
                Got it! Waiting for the round to end…
              </p>
            )}
            {isHost && (
              <button
                type="button"
                onClick={advance}
                disabled={advancing}
                className="rounded-full border-2 border-stone-900 bg-stone-50 px-5 py-2 text-xs font-black text-stone-900 shadow-[0_3px_0_0_rgba(0,0,0,0.9)] disabled:opacity-50"
              >
                Host: end round →
              </button>
            )}
          </>
        )}

        {room.status === "reveal" && track && (
          <>
            <RevealCard
              track={track}
              correct={Boolean(myGuess?.correct)}
              levelSolved={myGuess?.clip_level}
            />
            {isHost && room.current_round < room.rounds_total && (
              <button
                type="button"
                onClick={advance}
                disabled={advancing}
                className="rounded-full border-4 border-stone-900 bg-amber-400 px-6 py-3 text-sm font-black shadow-[0_4px_0_0_rgba(0,0,0,0.9)] active:translate-y-0.5 active:shadow-[0_2px_0_0_rgba(0,0,0,0.9)]"
              >
                Next round →
              </button>
            )}
            {isHost && room.current_round >= room.rounds_total && (
              <button
                type="button"
                onClick={advance}
                disabled={advancing}
                className="rounded-full border-4 border-stone-900 bg-amber-400 px-6 py-3 text-sm font-black shadow-[0_4px_0_0_rgba(0,0,0,0.9)] active:translate-y-0.5 active:shadow-[0_2px_0_0_rgba(0,0,0,0.9)]"
              >
                Finish game →
              </button>
            )}
            {!isHost && (
              <p className="text-sm text-amber-100/60">Waiting for host to continue…</p>
            )}
          </>
        )}

        {room.status === "finished" && (
          <FinalResults
            players={players}
            me={player.name}
            onExit={() => router.push("/rooms")}
          />
        )}
      </section>
    </main>
  );
}

function Lobby({
  code,
  isHost,
  onStart,
  advancing,
}: {
  code: string;
  isHost: boolean;
  onStart: () => void;
  advancing: boolean;
}) {
  return (
    <div className="w-full rounded-3xl border-4 border-stone-900 bg-stone-50 p-5 text-stone-900 shadow-[0_8px_0_0_rgba(0,0,0,0.9)]">
      <div className="text-xs font-bold uppercase tracking-wider text-stone-500">Share this code</div>
      <div className="mt-1 font-mono text-4xl font-black tracking-widest">{code}</div>
      <p className="mt-3 text-sm text-stone-600">
        Waiting in the lobby. When everyone&rsquo;s in, the host starts round 1.
      </p>
      {isHost ? (
        <button
          type="button"
          onClick={onStart}
          disabled={advancing}
          className="mt-4 w-full rounded-full border-4 border-stone-900 bg-amber-400 px-5 py-3 font-black shadow-[0_4px_0_0_rgba(0,0,0,0.9)] transition active:translate-y-0.5 active:shadow-[0_2px_0_0_rgba(0,0,0,0.9)] disabled:opacity-60"
        >
          {advancing ? "Starting…" : "Start Game"}
        </button>
      ) : (
        <div className="mt-4 rounded-full bg-stone-100 px-4 py-2 text-center text-sm font-bold text-stone-500">
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
  onExit,
}: {
  players: { display_name: string; bank: number; correct_count: number }[];
  me: string;
  onExit: () => void;
}) {
  const sorted = [...players].sort((a, b) => b.bank - a.bank);
  const winner = sorted[0];
  return (
    <div className="flex w-full flex-col items-center gap-4">
      <div className="text-xs uppercase tracking-wider text-amber-100/60">Final results</div>
      <div className="text-4xl font-black text-amber-100">🏆 {winner?.display_name}</div>
      <div className="w-full rounded-3xl border-4 border-stone-900 bg-stone-50 p-4 text-stone-900 shadow-[0_8px_0_0_rgba(0,0,0,0.9)]">
        <ol className="space-y-2">
          {sorted.map((p, i) => (
            <li
              key={p.display_name}
              className={
                p.display_name === me
                  ? "flex items-center justify-between rounded-xl bg-amber-100 px-3 py-2"
                  : "flex items-center justify-between rounded-xl bg-stone-100 px-3 py-2"
              }
            >
              <div className="flex items-center gap-3">
                <span className="font-mono text-sm font-black text-stone-500">#{i + 1}</span>
                <span className="font-black">{p.display_name}</span>
              </div>
              <div className="text-right">
                <div className="font-black">{p.bank} coins</div>
                <div className="text-xs text-stone-500">{p.correct_count} correct</div>
              </div>
            </li>
          ))}
        </ol>
      </div>
      <button
        type="button"
        onClick={onExit}
        className="rounded-full border-4 border-stone-900 bg-amber-400 px-6 py-3 font-black shadow-[0_4px_0_0_rgba(0,0,0,0.9)] active:translate-y-0.5 active:shadow-[0_2px_0_0_rgba(0,0,0,0.9)]"
      >
        Back to Rooms
      </button>
    </div>
  );
}
