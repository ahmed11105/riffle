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
  genres: string[];
  artist_query: string | null;
  phase_started_at: string | null;
  paused: boolean;
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
};

// Phase durations in seconds. Tuned for a snappy game loop.
export const PHASE_DURATIONS: Record<RoomStatus, number> = {
  lobby: 0,
  wager: 10,
  guess: 30,
  reveal: 6,
  finished: 0,
};

// Available genre chips in the lobby. Labels must match the categories that
// the server's track picker knows how to seed from iTunes.
export const GENRE_CHIPS: { id: string; label: string }[] = [
  { id: "popular", label: "Popular Now" },
  { id: "2020s", label: "2020s" },
  { id: "2010s", label: "2010s" },
  { id: "2000s", label: "2000s" },
  { id: "90s", label: "90s" },
  { id: "80s", label: "80s" },
  { id: "rock", label: "Rock" },
  { id: "hiphop", label: "Hip Hop" },
  { id: "rnb", label: "R&B" },
  { id: "dance", label: "Dance" },
  { id: "indie", label: "Indie" },
  { id: "latin", label: "Latin" },
];

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
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < length; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}
