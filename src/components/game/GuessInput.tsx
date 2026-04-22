"use client";

import { useEffect, useRef, useState } from "react";
import { Flag } from "lucide-react";
import type { RiffleTrack } from "@/lib/itunes";

const LEVELS = [1, 2, 4, 8, 16] as const;
type Level = (typeof LEVELS)[number];

// How many seconds the next clip step adds. null at the final level
// (no next step) — the skip button becomes a "give up" flag instead.
function nextLevelDiff(current: number | undefined): number | null {
  const idx = LEVELS.indexOf(current as Level);
  if (idx < 0 || idx >= LEVELS.length - 1) return null;
  return LEVELS[idx + 1] - LEVELS[idx];
}

type Props = {
  onGuess: (value: string) => void;
  onSkip: () => void;
  disabled?: boolean;
  // When set, the typeahead is restricted to songs by these artists.
  artistFilter?: string[];
  // Current clip seconds (1, 2, 4, 8, or 16). Used to label the skip
  // button with the cost of skipping ("+2s" etc) and to swap to the
  // "give up" flag at the final level.
  currentLevel?: number;
};

export function GuessInput({ onGuess, onSkip, disabled, artistFilter, currentLevel }: Props) {
  const [value, setValue] = useState("");
  const [suggestions, setSuggestions] = useState<RiffleTrack[]>([]);
  const [open, setOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const artistsKey = (artistFilter ?? []).join(",");

  useEffect(() => {
    if (value.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    const t = setTimeout(async () => {
      try {
        const qs = new URLSearchParams({ q: value });
        if (artistsKey) qs.set("artists", artistsKey);
        const res = await fetch(`/api/itunes/search?${qs.toString()}`, {
          signal: ac.signal,
        });
        if (!res.ok) return;
        const json = (await res.json()) as { tracks: RiffleTrack[] };
        setSuggestions(json.tracks.slice(0, 6));
        setOpen(true);
      } catch {
        /* aborted */
      }
    }, 150);
    return () => clearTimeout(t);
  }, [value, artistsKey]);

  function submit(val: string) {
    if (!val.trim()) return;
    onGuess(val);
    setValue("");
    setSuggestions([]);
    setOpen(false);
  }

  const skipDiff = nextLevelDiff(currentLevel);
  const isFinalLevel = currentLevel != null && skipDiff === null;

  return (
    <div className="relative w-full max-w-md">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(value);
        }}
        className="flex w-full items-center gap-2"
      >
        {/* The whole input + actions live inside a single dark pill so
            it reads as one control. Focus styling lives on the wrapper
            (focus-within), not the bare input — matches the mockup.
            VolumeControl moved out of the input row; render it above
            the GuessInput in the parent. */}
        <div
          className={`flex min-w-0 flex-1 items-center gap-1.5 rounded-full border-2 bg-stone-900 py-1.5 pl-2 pr-1.5 transition focus-within:ring-4 focus-within:ring-amber-300/40 ${
            disabled
              ? "border-amber-100/10 opacity-70"
              : "border-amber-100/20 focus-within:border-amber-300"
          }`}
        >
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onFocus={() => suggestions.length && setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            placeholder="Type the song..."
            disabled={disabled}
            className="min-w-0 flex-1 bg-transparent px-3 py-1 text-amber-100 placeholder:text-amber-100/40 focus:outline-none disabled:cursor-not-allowed"
          />
          {/* Skip / give-up button. Pre-final: small grey circle with
              the cost of skipping ("+1s"). Final clip: rose flag,
              same shape, signalling forfeit-and-reveal. */}
          <button
            type="button"
            onClick={onSkip}
            disabled={disabled}
            aria-label={isFinalLevel ? "Give up and reveal" : `Skip · adds ${skipDiff}s to the clip`}
            title={isFinalLevel ? "Give up" : `+${skipDiff}s clip`}
            className={`flex h-9 shrink-0 items-center justify-center rounded-full px-3 text-xs font-black tabular-nums transition active:translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed ${
              isFinalLevel
                ? "bg-rose-400 text-stone-900 shadow-[0_2px_0_0_rgba(0,0,0,0.6)] active:shadow-[0_1px_0_0_rgba(0,0,0,0.6)]"
                : "bg-stone-700 text-amber-100/90 shadow-[0_2px_0_0_rgba(0,0,0,0.6)] hover:bg-stone-600 active:shadow-[0_1px_0_0_rgba(0,0,0,0.6)]"
            }`}
          >
            {isFinalLevel ? <Flag className="h-4 w-4" /> : skipDiff != null ? `+${skipDiff}s` : "SKIP"}
          </button>
          <button
            type="submit"
            disabled={disabled || !value.trim()}
            className="flex h-9 shrink-0 items-center justify-center rounded-full bg-amber-400 px-4 text-sm font-black tracking-wider text-stone-900 shadow-[0_2px_0_0_rgba(0,0,0,0.7)] transition active:translate-y-0.5 active:shadow-[0_1px_0_0_rgba(0,0,0,0.7)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            GUESS
          </button>
        </div>
      </form>
      {open && suggestions.length > 0 && (
        <ul className="absolute left-0 right-0 top-full z-10 mt-2 overflow-hidden rounded-2xl border-2 border-amber-100/20 bg-stone-900 shadow-[0_4px_0_0_rgba(0,0,0,0.9)]">
          {suggestions.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  submit(t.title);
                }}
                className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm text-amber-100 hover:bg-stone-800"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={t.albumArtUrl} alt="" className="h-8 w-8 rounded" />
                <span className="flex-1 truncate">
                  <span className="font-bold">{t.title}</span>{" "}
                  <span className="text-amber-100/50">· {t.artist}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
