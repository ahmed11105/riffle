"use client";

import { useEffect, useRef, useState } from "react";
import type { RiffleTrack } from "@/lib/itunes";
import { VolumeControl } from "@/components/VolumeControl";

type Props = {
  onGuess: (value: string) => void;
  onSkip: () => void;
  disabled?: boolean;
  // When set, the typeahead is restricted to songs by these artists.
  artistFilter?: string[];
};

export function GuessInput({ onGuess, onSkip, disabled, artistFilter }: Props) {
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

  return (
    <div className="relative w-full max-w-md">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(value);
        }}
        // Two columns: volume on the left, then a right column that holds
        // the input + action buttons. On mobile (<sm) the right column
        // stacks (input on top, buttons below, aligned to the text box,
        // not under the volume icon). On sm+ the right column becomes a
        // single row so we get the original desktop layout back.
        className="flex w-full items-start gap-2 sm:items-center"
      >
        <VolumeControl />
        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center">
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onFocus={() => suggestions.length && setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            placeholder="Type the song..."
            disabled={disabled}
            className="min-w-0 flex-1 rounded-full border-2 border-amber-100/20 bg-stone-900 px-5 py-3 text-amber-100 placeholder:text-amber-100/40 focus:outline-none focus:border-amber-300 focus:ring-4 focus:ring-amber-300/40 disabled:opacity-50"
          />
          {/* Button row. On desktop the wrapper becomes `contents` so SKIP
              and GUESS flow inline next to the input like before. */}
          <div className="flex items-center gap-2 sm:contents">
            <button
              type="button"
              onClick={onSkip}
              disabled={disabled}
              className="flex-1 rounded-full border-2 border-stone-900 bg-stone-700 px-4 py-3 text-sm font-black text-stone-50 transition hover:bg-stone-600 disabled:opacity-50 sm:flex-none"
            >
              SKIP
            </button>
            <button
              type="submit"
              disabled={disabled || !value.trim()}
              className="flex-[2] rounded-full border-2 border-stone-900 bg-amber-400 px-5 py-3 text-sm font-black text-stone-900 shadow-[0_4px_0_0_rgba(0,0,0,0.9)] transition active:translate-y-0.5 active:shadow-[0_2px_0_0_rgba(0,0,0,0.9)] disabled:opacity-50 sm:flex-none"
            >
              GUESS
            </button>
          </div>
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
