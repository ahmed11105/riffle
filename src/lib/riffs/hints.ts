import type { RiffleTrack } from "@/lib/itunes";

export type HintKind = "genre" | "year" | "artist_letter";

export const HINT_COSTS: Record<HintKind, number> = {
  genre: 10,
  year: 15,
  artist_letter: 25,
};

export const HINT_LABELS: Record<HintKind, string> = {
  genre: "Genre",
  year: "Year",
  artist_letter: "First letter of artist",
};

export function describeHint(track: RiffleTrack, kind: HintKind): string {
  switch (kind) {
    case "genre":
      return track.genre ?? "Unknown genre";
    case "year":
      return track.releaseYear ? String(track.releaseYear) : "Unknown year";
    case "artist_letter":
      return track.artist?.[0]?.toUpperCase() ?? "?";
  }
}

export function isHintAvailable(track: RiffleTrack, kind: HintKind): boolean {
  switch (kind) {
    case "genre":
      return !!track.genre;
    case "year":
      return !!track.releaseYear;
    case "artist_letter":
      return !!track.artist;
  }
}
