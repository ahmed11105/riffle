"use client";

import { GENRE_CHIPS } from "@/lib/rooms";
import { cn } from "@/lib/utils";

type Props = {
  isHost: boolean;
  genres: string[];
  artistQuery: string | null;
  rounds: number;
  onGenresChange: (next: string[]) => void;
  onArtistChange: (next: string) => void;
  onRoundsChange: (next: number) => void;
};

const ROUND_OPTIONS = [5, 10, 15, 20];

export function LobbyConfig({
  isHost,
  genres,
  artistQuery,
  rounds,
  onGenresChange,
  onArtistChange,
  onRoundsChange,
}: Props) {
  function toggle(id: string) {
    if (!isHost) return;
    if (genres.includes(id)) {
      onGenresChange(genres.filter((g) => g !== id));
    } else {
      onGenresChange([...genres, id]);
    }
  }

  return (
    <div className="w-full space-y-5 rounded-3xl border-4 border-stone-900 bg-stone-50 p-5 text-stone-900 shadow-[0_8px_0_0_rgba(0,0,0,0.9)]">
      <div>
        <div className="text-xs font-bold uppercase tracking-wider text-stone-500">
          Song source {isHost ? "" : "(set by host)"}
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {GENRE_CHIPS.map((chip) => {
            const active = genres.includes(chip.id);
            return (
              <button
                key={chip.id}
                type="button"
                disabled={!isHost}
                onClick={() => toggle(chip.id)}
                className={cn(
                  "rounded-full border-2 border-stone-900 px-3 py-2 text-sm font-black transition",
                  active
                    ? "bg-amber-400 text-stone-900 shadow-[0_3px_0_0_rgba(0,0,0,0.9)]"
                    : "bg-stone-100 text-stone-700 hover:bg-stone-200",
                  !isHost && "cursor-not-allowed opacity-60",
                )}
              >
                {chip.label}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-stone-500">
          Pick one or more, or leave empty for a random mix.
        </p>
      </div>

      <div>
        <div className="text-xs font-bold uppercase tracking-wider text-stone-500">
          Artist (optional)
        </div>
        <input
          type="text"
          value={artistQuery ?? ""}
          disabled={!isHost}
          onChange={(e) => onArtistChange(e.target.value)}
          placeholder={isHost ? "e.g. Taylor Swift, Queen, Drake" : "—"}
          className="mt-2 w-full rounded-full border-2 border-stone-900 bg-stone-100 px-4 py-2.5 font-black placeholder:text-stone-400 focus:outline-none focus:ring-4 focus:ring-amber-300 disabled:opacity-60"
        />
      </div>

      <div>
        <div className="text-xs font-bold uppercase tracking-wider text-stone-500">
          Rounds
        </div>
        <div className="mt-2 grid grid-cols-4 gap-2">
          {ROUND_OPTIONS.map((r) => {
            const active = rounds === r;
            return (
              <button
                key={r}
                type="button"
                disabled={!isHost}
                onClick={() => onRoundsChange(r)}
                className={cn(
                  "rounded-full border-2 border-stone-900 py-2 text-sm font-black transition",
                  active
                    ? "bg-amber-400 text-stone-900 shadow-[0_3px_0_0_rgba(0,0,0,0.9)]"
                    : "bg-stone-100 text-stone-700 hover:bg-stone-200",
                  !isHost && "cursor-not-allowed opacity-60",
                )}
              >
                {r}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
