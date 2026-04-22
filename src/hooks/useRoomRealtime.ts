"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PHASE_DURATIONS, type RoomPlayerRow, type RoomRoundRow, type RoomRow } from "@/lib/rooms";

type State = {
  room: RoomRow | null;
  players: RoomPlayerRow[];
  round: RoomRoundRow | null;
  loading: boolean;
  error: string | null;
};

type Returned = State & { refresh: () => void };

export function useRoomRealtime(code: string): Returned {
  const supabase = useMemo(() => createClient(), []);
  const [state, setState] = useState<State>({
    room: null,
    players: [],
    round: null,
    loading: true,
    error: null,
  });
  const stateRef = useRef(state);
  stateRef.current = state;
  const advancingRef = useRef(false);

  // Auto-advance the room when the current phase is "done". Two triggers:
  //   1. The phase timer has expired (server-clock check).
  //   2. Every player is already resolved for the phase, all wagers locked
  //      in during wager phase, or every player done/any player correct in
  //      guess phase. This keeps the game snappy instead of dead-waiting on
  //      a 30s clock when everybody's already ready.
  // Any client can fire /advance; the server's `from` check dedupes so only
  // the first call actually transitions.
  const maybeAutoAdvance = useCallback(
    async (
      room: RoomRow,
      players: RoomPlayerRow[],
      round: RoomRoundRow | null,
    ) => {
      if (advancingRef.current) return;
      if (room.paused) return;
      if (room.status === "lobby" || room.status === "finished") return;
      if (!room.phase_started_at) return;

      const duration = PHASE_DURATIONS[room.status];
      const started = new Date(room.phase_started_at).getTime();
      const timerDone = duration > 0 && started + duration * 1000 <= Date.now();

      let stateDone = false;
      // Need at least 2 players with a loaded round to consider state-
      // based advancement. The >= 2 guard prevents [].every() → true
      // from firing a false positive when the player list hasn't loaded.
      if (players.length >= 2 && round) {
        if (room.status === "wager") {
          const wagers = round.wagers ?? {};
          stateDone = players.every((p) => Boolean(wagers[p.display_name]));
        } else if (room.status === "guess") {
          const guesses = round.guesses ?? {};
          const anyCorrect = players.some((p) => guesses[p.display_name]?.correct);
          const allDone = players.every((p) => Boolean(guesses[p.display_name]?.done));
          stateDone = anyCorrect || allDone;
        }
      }

      if (!timerDone && !stateDone) return;

      advancingRef.current = true;
      try {
        await fetch(`/api/rooms/${code}/advance`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ from: room.status }),
        });
      } catch (e) {
        console.error("[riffle] auto-advance failed", e);
      } finally {
        advancingRef.current = false;
      }
    },
    [code],
  );

  const loadAll = useCallback(async () => {
    // Race each query against a short timeout. If Supabase's auth lock
    // gets stolen mid-call (iOS Safari bfcache, incognito), the promise
    // can hang indefinitely and the room screen would stay on "Loading…"
    // forever. On timeout we throw and the next 1s poll retries cleanly
    // without setting `error: "Room not found"`.
    const withTimeout = <T,>(p: PromiseLike<T>, ms = 4000): Promise<T> =>
      Promise.race<T>([
        Promise.resolve(p),
        new Promise<T>((_, reject) =>
          setTimeout(() => reject(new Error("supabase-timeout")), ms),
        ),
      ]);

    let room: RoomRow | null;
    let players: RoomPlayerRow[];
    try {
      const [r, p] = await Promise.all([
        withTimeout(
          supabase.from("rooms").select("*").eq("code", code).maybeSingle(),
        ),
        withTimeout(
          supabase.from("room_players").select("*").eq("room_code", code),
        ),
      ]);
      room = (r.data as RoomRow | null) ?? null;
      players = (p.data as RoomPlayerRow[] | null) ?? [];
    } catch {
      // Soft-fail. Leave state alone so the existing loading/data shows
      // and let the next poll retry. Only the very first call needs the
      // initial loading shell to clear quickly; that path is handled by
      // a subsequent successful poll.
      return;
    }

    let round: RoomRoundRow | null = null;
    if (room && room.current_round > 0) {
      try {
        const { data } = await withTimeout(
          supabase
            .from("room_rounds")
            .select("*")
            .eq("room_code", code)
            .eq("round_num", room.current_round)
            .maybeSingle(),
        );
        round = (data as RoomRoundRow | null) ?? null;
      } catch {
        round = null;
      }
    }
    setState((prev) => {
      const nextRoom = (room as RoomRow | null) ?? null;
      let nextRound: RoomRoundRow | null = round ?? null;
      if (
        !nextRound &&
        prev.round &&
        nextRoom &&
        prev.round.round_num === nextRoom.current_round
      ) {
        nextRound = prev.round;
      }
      return {
        ...prev,
        room: nextRoom,
        players: (players as RoomPlayerRow[] | null) ?? [],
        round: nextRound,
        loading: false,
        error: nextRoom ? null : "Room not found",
      };
    });
    if (room) {
      maybeAutoAdvance(
        room as RoomRow,
        (players as RoomPlayerRow[] | null) ?? [],
        round,
      );
    }
  }, [supabase, code, maybeAutoAdvance]);

  const loadRef = useRef(loadAll);
  loadRef.current = loadAll;

  // Skip a tick if a previous loadAll is still in flight. Without this,
  // the 1s interval stacks parallel supabase calls that fight for the
  // auth-js Web Lock and never resolve — symptom is the lobby getting
  // stuck on "Loading room…" indefinitely.
  const inflightRef = useRef(false);
  const pollOnce = useCallback(async () => {
    if (inflightRef.current) return;
    inflightRef.current = true;
    try {
      await loadRef.current();
    } finally {
      inflightRef.current = false;
    }
  }, []);

  useEffect(() => {
    pollOnce();
    const pollId = setInterval(pollOnce, 1500);

    const channel = supabase
      .channel(`riffle:room:${code}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "rooms",
          filter: `code=eq.${code}`,
        },
        (payload) => {
          const nextRoom = payload.new as RoomRow | undefined;
          if (!nextRoom) return;
          setState((s) => ({ ...s, room: nextRoom }));
          if (
            nextRoom.current_round > 0 &&
            nextRoom.current_round !== stateRef.current.round?.round_num
          ) {
            supabase
              .from("room_rounds")
              .select("*")
              .eq("room_code", code)
              .eq("round_num", nextRoom.current_round)
              .maybeSingle()
              .then(({ data }) => {
                setState((s) => ({ ...s, round: (data as RoomRoundRow | null) ?? s.round }));
              });
          }
          maybeAutoAdvance(
            nextRoom,
            stateRef.current.players,
            stateRef.current.round,
          );
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "room_players",
          filter: `room_code=eq.${code}`,
        },
        () => {
          supabase
            .from("room_players")
            .select("*")
            .eq("room_code", code)
            .then(({ data }) => {
              setState((s) => ({ ...s, players: (data as RoomPlayerRow[] | null) ?? [] }));
            });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "room_rounds",
          filter: `room_code=eq.${code}`,
        },
        (payload) => {
          const n = payload.new as RoomRoundRow | undefined;
          if (!n) return;
          setState((s) => {
            if (s.room && n.round_num !== s.room.current_round) return s;
            return { ...s, round: n };
          });
          if (stateRef.current.room) {
            maybeAutoAdvance(
              stateRef.current.room,
              stateRef.current.players,
              n,
            );
          }
        },
      )
      .subscribe();

    return () => {
      clearInterval(pollId);
      supabase.removeChannel(channel);
    };
  }, [supabase, code, loadAll, maybeAutoAdvance]);

  const refresh = useCallback(() => {
    loadRef.current();
  }, []);

  return { ...state, refresh };
}
