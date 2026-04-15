"use client";

import { useEffect, useRef, useState } from "react";
import type { RoomRow } from "@/lib/rooms";
import { PHASE_DURATIONS } from "@/lib/rooms";

// Countdown for the current phase. Returns remaining seconds and fires
// `onExpired` exactly once when the timer reaches 0 (for the given
// phase_started_at + status combo). Pause freezes the countdown.

export function usePhaseTimer(
  room: RoomRow | null,
  onExpired: () => void,
  enabled: boolean,
) {
  const [remaining, setRemaining] = useState<number>(0);
  const firedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!room || !room.phase_started_at || room.paused) {
      setRemaining(0);
      return;
    }
    const duration = PHASE_DURATIONS[room.status] ?? 0;
    if (!duration) {
      setRemaining(0);
      return;
    }
    const key = `${room.code}:${room.status}:${room.current_round}:${room.phase_started_at}`;

    function tick() {
      if (!room || !room.phase_started_at) return;
      const started = new Date(room.phase_started_at).getTime();
      const now = Date.now();
      const left = Math.max(0, Math.ceil((started + duration * 1000 - now) / 1000));
      setRemaining(left);
      if (left <= 0 && enabled && firedKeyRef.current !== key) {
        firedKeyRef.current = key;
        onExpired();
      }
    }

    tick();
    const id = setInterval(tick, 200);
    return () => clearInterval(id);
  }, [
    room,
    enabled,
    onExpired,
  ]);

  return remaining;
}
