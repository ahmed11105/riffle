// Room domain types + local player identity.

import type { ClipLevel } from "./game/wager";

export type RoomStatus = "lobby" | "wager" | "guess" | "reveal" | "finished";

export type RoomRow = {
  code: string;
  host_id: string | null;
  status: RoomStatus;
  mode: string;
  pack_slug: string | null;
  rounds_total: number;
  current_round: number;
  starting_bank: number;
  created_at: string;
};

export type RoomPlayerRow = {
  room_code: string;
  user_id: string | null;
  display_name: string;
  bank: number;
  correct_count: number;
  is_host: boolean;
  joined_at: string;
};

export type WagerRecord = {
  amount: number;
  level: ClipLevel;
};

export type GuessRecord = {
  value: string;
  correct: boolean;
  clip_level: ClipLevel;
  time_ms: number;
};

export type RoomRoundRow = {
  room_code: string;
  round_num: number;
  track_id: string | null;
  wagers: Record<string, WagerRecord>;
  guesses: Record<string, GuessRecord>;
  revealed_at: string | null;
  // Not in DB: we hydrate the track client-side from an API call.
};

const PLAYER_STORAGE_KEY = "riffle:player";

export type LocalPlayer = {
  id: string;
  name: string;
};

export function loadLocalPlayer(): LocalPlayer | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(PLAYER_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LocalPlayer;
    if (!parsed.id || !parsed.name) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveLocalPlayer(name: string): LocalPlayer {
  const existing = loadLocalPlayer();
  const player: LocalPlayer = {
    id: existing?.id ?? crypto.randomUUID(),
    name: name.trim().slice(0, 24),
  };
  localStorage.setItem(PLAYER_STORAGE_KEY, JSON.stringify(player));
  return player;
}

export function generateRoomCode(length = 6): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no confusing chars
  let out = "";
  for (let i = 0; i < length; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}
