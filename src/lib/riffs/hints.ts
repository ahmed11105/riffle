import type { RiffleTrack } from "@/lib/itunes";
import { Calendar, CaseSensitive, Mic2, type LucideIcon } from "lucide-react";

// Three hint kinds. The "title_letters" hint is special: each
// purchase reveals the NEXT alphabet character of the song title,
// rather than being a one-shot reveal. The badge label and cost
// progress as the player keeps buying letters; the displayed
// "revealed" value is the partial title with all bought letters
// filled in.
//
// Pricing:
//   year         10 Riffs
//   title_letters 15 Riffs for the 1st letter, 10 Riffs for each
//                 subsequent letter (so 1+2 letters = artist cost,
//                 keeping letter-by-letter and full-artist paths
//                 economically comparable)
//   artist       25 Riffs
export type HintKind = "year" | "title_letters" | "artist";

export const HINT_KINDS: HintKind[] = ["year", "title_letters", "artist"];

// Static base costs. For title_letters this is the cost of the
// first letter only — see costForLetterIndex().
export const HINT_COSTS: Record<HintKind, number> = {
  year: 10,
  title_letters: 15,
  artist: 25,
};

const LETTER_REPEAT_COST = 10;

export function costForLetterIndex(letterIdx: number): number {
  // letterIdx is 1-indexed (1 = 1st letter, 2 = 2nd, ...)
  return letterIdx <= 1 ? HINT_COSTS.title_letters : LETTER_REPEAT_COST;
}

export const HINT_LABELS: Record<HintKind, string> = {
  year: "Year",
  title_letters: "Letters",
  artist: "Artist",
};

export const HINT_ICONS: Record<HintKind, LucideIcon> = {
  year: Calendar,
  title_letters: CaseSensitive,
  artist: Mic2,
};

// Ordinal label for the next letter the player would buy. Generic
// past 3 ("4th letter", "11th letter", etc).
export function ordinalLetter(n: number): string {
  if (n === 1) return "1st letter";
  if (n === 2) return "2nd letter";
  if (n === 3) return "3rd letter";
  return `${n}th letter`;
}

export function countAlphas(s: string): number {
  return (s.match(/[a-zA-Z]/g) ?? []).length;
}

// Build a partial title where the first N alphabet characters are
// revealed in order; non-alphabet characters (spaces, digits,
// punctuation) are always shown.
//   partialTitle("Wonderwall", 3)     -> "Won_______"
//   partialTitle("Hot In Herre", 3)   -> "Hot __ _____"
export function partialTitle(title: string, revealCount: number): string {
  let i = 0;
  return title
    .split("")
    .map((ch) => {
      if (/[a-zA-Z]/.test(ch)) {
        i++;
        return i <= revealCount ? ch : "_";
      }
      return ch;
    })
    .join("");
}

export function describeHint(track: RiffleTrack, kind: HintKind): string {
  switch (kind) {
    case "year":
      return track.releaseYear ? String(track.releaseYear) : "Unknown year";
    case "title_letters":
      // Default to revealing one letter when called without a
      // count; HintPanel computes the real count and uses
      // partialTitle() directly.
      return partialTitle(track.title, 1);
    case "artist":
      return track.artist ?? "Unknown artist";
  }
}
