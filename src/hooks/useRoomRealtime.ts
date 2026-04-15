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

  // Server-clock auto-advance: any client (not just the host) checks every
  // poll whether the current phase has expired and, if so, fires /advance.
  // The server uses the `from` parameter to deduplicate so simultaneous
  // fires no-op.
  const maybeAutoAdvance = useCallback(
    async (room: RoomRow) => {
      if (advancingRef.current) return;
      if (room.paused) return;
      if (room.status === "lobby" || room.status === "finished") return;
      if (!room.phase_started_at) return;
      const duration = PHASE_DURATIONS[room.status];
      if (!duration) return;
      const started = new Date(room.phase_started_at).getTime();
      if (started + duration * 1000 > Date.now()) return;
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
    const [{ data: room }, { data: players }] = await Promise.all([
      supabase.from("rooms").select("*").eq("code", code).maybeSingle(),
      supabase.from("room_players").select("*").eq("room_code", code),
    ]);
    let round: RoomRoundRow | null = null;
    if (room && room.current_round > 0) {
      const { data } = await supabase
        .from("room_rounds")
        .select("*")
        .eq("room_code", code)
        .eq("round_num", room.current_round)
        .maybeSingle();
      round = (data as RoomRoundRow | null) ?? null;
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
      maybeAutoAdvance(room as RoomRow);
    }
  }, [supabase, code, maybeAutoAdvance]);

  const loadRef = useRef(loadAll);
  loadRef.current = loadAll;

  useEffect(() => {
    loadAll();
    const pollId = setInterval(() => loadRef.current(), 1000);

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
          maybeAutoAdvance(nextRoom);
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
