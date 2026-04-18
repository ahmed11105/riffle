import type { RiffleTrack } from "@/lib/itunes";
import nowPool from "@/lib/daily/now-pool.json";

export type PoolTrack = {
  id: string;
  title: string;
  artist: string;
  album: string;
  albumArtUrl: string;
  previewUrl: string;
  durationMs: number;
  releaseYear: number | null;
};

type PoolFile = { tracks: PoolTrack[] };

export const DAILY_POOL: PoolTrack[] = (nowPool as PoolFile).tracks;

export function toRiffleTrack(t: PoolTrack): RiffleTrack {
  return {
    id: t.id,
    source: "itunes",
    title: t.title,
    artist: t.artist,
    album: t.album,
    albumArtUrl: t.albumArtUrl,
    previewUrl: t.previewUrl,
    durationMs: t.durationMs,
    releaseYear: t.releaseYear ?? undefined,
  };
}

// Build the dayKey that identifies a daily slot. A configurable UTC hour
// offset lets admins shift when the rollover happens without touching the
// server clock, shifting by +5h means the "day" starts at 05:00 UTC.
export function dayKeyFor(date: Date, rolloverHourUtc = 0): string {
  const shifted = new Date(date.getTime() - rolloverHourUtc * 3_600_000);
  return `${shifted.getUTCFullYear()}-${shifted.getUTCMonth()}-${shifted.getUTCDate()}`;
}

export function hashDayKey(key: string): number {
  let hash = 0;
  for (const ch of key) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return Math.abs(hash);
}

// Pick today's track from the pool for a given day key. Returns null when
// the pool is empty.
export function pickTrackForDay(key: string): PoolTrack | null {
  if (DAILY_POOL.length === 0) return null;
  return DAILY_POOL[hashDayKey(key) % DAILY_POOL.length];
}
