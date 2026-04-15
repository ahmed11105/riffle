"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RoomPlayerRow, RoomRoundRow, RoomRow } from "@/lib/rooms";

type State = {
  room: RoomRow | null;
  players: RoomPlayerRow[];
  round: RoomRoundRow | null;
  loading: boolean;
  error: string | null;
};

export function useRoomRealtime(code: string) {
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

  useEffect(() => {
    let cancelled = false;

    async function loadAll() {
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
      if (cancelled) return;
      setState({
        room: (room as RoomRow | null) ?? null,
        players: (players as RoomPlayerRow[] | null) ?? [],
        round,
        loading: false,
        error: room ? null : "Room not found",
      });
    }

    loadAll();

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
          setState((s) => ({ ...s, room: (payload.new as RoomRow) ?? s.room }));
          const nextRoom = payload.new as RoomRow | undefined;
          if (
            nextRoom &&
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
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [supabase, code]);

  return state;
}
