import type { RiffleTrack } from "@/lib/itunes";
import { Calendar, CaseSensitive, Mic2, type LucideIcon } from "lucide-react";

// Hints reveal information about the current track. Letters reveal
// characters of the SONG TITLE (the answer the player is typing) —
// not the artist, which is its own contextual hint. This split
// matters because some players know the artist but not the song,
// and vice versa.
export type HintKind = "year" | "title_letter_1" | "title_letter_2" | "artist";

export const HINT_KINDS: HintKind[] = [
  "year",
  "title_letter_1",
  "title_letter_2",
  "artist",
];

export const HINT_COSTS: Record<HintKind, number> = {
  year: 10,
  title_letter_1: 15,
  // Cheaper than the 1st letter so two letters cost the same as
  // buying the full artist (15 + 10 = 25 = artist). Keeps the
  // letter-by-letter path competitive with the nuclear "show me
  // the artist" option.
  title_letter_2: 10,
  artist: 25,
};

export const HINT_LABELS: Record<HintKind, string> = {
  year: "Year",
  title_letter_1: "1st letter",
  title_letter_2: "2nd letter",
  artist: "Artist",
};

export const HINT_ICONS: Record<HintKind, LucideIcon> = {
  year: Calendar,
  title_letter_1: CaseSensitive,
  title_letter_2: CaseSensitive,
  artist: Mic2,
};

// Hints that have a prerequisite (the 2nd letter requires the 1st to
// be revealed first — buying it before would be useless).
export const HINT_PREREQS: Partial<Record<HintKind, HintKind>> = {
  title_letter_2: "title_letter_1",
};

export function describeHint(track: RiffleTrack, kind: HintKind): string {
  switch (kind) {
    case "year":
      return track.releaseYear ? String(track.releaseYear) : "Unknown year";
    case "title_letter_1":
      return track.title?.[0]?.toUpperCase() ?? "?";
    case "title_letter_2":
      return track.title?.[1]?.toUpperCase() ?? "—";
    case "artist":
      return track.artist ?? "Unknown artist";
  }
}
