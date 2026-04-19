import type { RiffleTrack } from "@/lib/itunes";

export type HintKind = "year" | "artist_letter" | "artist";

export const HINT_COSTS: Record<HintKind, number> = {
  year: 10,
  artist_letter: 15,
  artist: 25,
};

export const HINT_LABELS: Record<HintKind, string> = {
  year: "Year",
  artist_letter: "First letter of artist",
  artist: "Artist",
};

export function describeHint(track: RiffleTrack, kind: HintKind): string {
  switch (kind) {
    case "year":
      return track.releaseYear ? String(track.releaseYear) : "Unknown year";
    case "artist_letter":
      return track.artist?.[0]?.toUpperCase() ?? "?";
    case "artist":
      return track.artist ?? "Unknown artist";
  }
}
