import type { RiffleTrack } from "@/lib/itunes";
import { Calendar, CaseSensitive, Mic2, type LucideIcon } from "lucide-react";

export type HintKind = "year" | "artist_letter" | "artist";

export const HINT_KINDS: HintKind[] = ["year", "artist_letter", "artist"];

export const HINT_COSTS: Record<HintKind, number> = {
  year: 10,
  artist_letter: 15,
  artist: 25,
};

export const HINT_LABELS: Record<HintKind, string> = {
  year: "Year",
  artist_letter: "First letter",
  artist: "Artist",
};

export const HINT_ICONS: Record<HintKind, LucideIcon> = {
  year: Calendar,
  artist_letter: CaseSensitive,
  artist: Mic2,
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
