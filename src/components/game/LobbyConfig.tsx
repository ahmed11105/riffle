"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Lock, X } from "lucide-react";
import { GENRE_CHIPS } from "@/lib/rooms";
import { cn } from "@/lib/utils";
import { useRiffs } from "@/lib/riffs/useRiffs";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useAdminMode } from "@/lib/admin";

const FREE_ARTIST_SLOTS = 1;
const EXTRA_ARTIST_COST = 25;
const FREE_MAX_ROUNDS = 5;

type Props = {
  isHost: boolean;
  genres: string[];
  artists: string[];
  rounds: number;
  allowFeaturedTracks: boolean;
  onGenresChange: (next: string[]) => void;
  onArtistsChange: (next: string[]) => void;
  onRoundsChange: (next: number) => void;
  onAllowFeaturedTracksChange: (next: boolean) => void;
};

const ROUND_OPTIONS = [5, 10, 15, 20];

export function LobbyConfig({
  isHost,
  genres,
  artists,
  rounds,
  allowFeaturedTracks,
  onGenresChange,
  onArtistsChange,
  onRoundsChange,
  onAllowFeaturedTracksChange,
}: Props) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  function toggle(id: string) {
    if (!isHost) return;
    if (genres.includes(id)) {
      onGenresChange(genres.filter((g) => g !== id));
    } else {
      onGenresChange([...genres, id]);
    }
  }

  const [artistDraft, setArtistDraft] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [focused, setFocused] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [paidSlots, setPaidSlots] = useState(0);
  const [slotError, setSlotError] = useState<string | null>(null);
  const [unlocking, setUnlocking] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const { spend, balance, ready: riffsReady } = useRiffs();
  const { isPro: realIsPro } = useAuth();
  const [adminOn] = useAdminMode();
  // Treat admin as Pro for all UX gates: unlimited rounds + unlimited
  // artist slots + no Riffs charge.
  const isPro = realIsPro || adminOn;

  // Available slots = the free baseline plus any slots the host has
  // already paid Riffs for in this room session. Removing an artist
  // doesn't refund the slot, so the host can swap artists for free
  // up to whatever they've already unlocked.
  // Pro users skip the cap entirely.
  const totalSlots = FREE_ARTIST_SLOTS + paidSlots;
  const atLimit = !isPro && artists.length >= totalSlots;

  // Debounced iTunes artist typeahead. Cancels any in-flight request when
  // the draft changes so we never race stale results over newer ones.
  useEffect(() => {
    const q = artistDraft.trim();
    if (q.length < 2) {
      setSuggestions([]);
      return;
    }
    const t = setTimeout(async () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        const res = await fetch(`/api/artists/search?q=${encodeURIComponent(q)}`, {
          signal: ctrl.signal,
        });
        if (!res.ok) return;
        const json = (await res.json()) as { artists?: string[] };
        const filtered = (json.artists ?? []).filter(
          (a) => !artists.some((existing) => existing.toLowerCase() === a.toLowerCase()),
        );
        setSuggestions(filtered);
        setHighlight(0);
      } catch {
        // ignore aborts / network blips
      }
    }, 200);
    return () => clearTimeout(t);
  }, [artistDraft, artists]);

  async function addArtist(name: string) {
    if (unlocking) return;
    const trimmed = name.trim().slice(0, 40);
    if (!trimmed) return;
    if (artists.some((a) => a.toLowerCase() === trimmed.toLowerCase())) {
      setArtistDraft("");
      setSuggestions([]);
      return;
    }
    if (atLimit) {
      if (!riffsReady) {
        setSlotError("Sign in to unlock more artist slots.");
        return;
      }
      if (balance < EXTRA_ARTIST_COST) {
        setSlotError(`Need ${EXTRA_ARTIST_COST} Riffs for an extra slot.`);
        return;
      }
      setUnlocking(true);
      try {
        const result = await spend(EXTRA_ARTIST_COST, "extra_artist_slot");
        if (!result.ok) {
          setSlotError(
            result.reason === "insufficient"
              ? `Need ${EXTRA_ARTIST_COST} Riffs.`
              : (result.message ?? "Couldn't unlock slot."),
          );
          return;
        }
        setPaidSlots((n) => n + 1);
      } finally {
        setUnlocking(false);
      }
    }
    setSlotError(null);
    onArtistsChange([...artists, trimmed]);
    setArtistDraft("");
    setSuggestions([]);
    setHighlight(0);
  }

  function removeArtist(name: string) {
    onArtistsChange(artists.filter((a) => a !== name));
  }

  function onArtistKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (suggestions.length > 0 && highlight >= 0) {
        addArtist(suggestions[highlight] ?? artistDraft);
      } else {
        addArtist(artistDraft);
      }
    } else if (e.key === "ArrowDown" && suggestions.length > 0) {
      e.preventDefault();
      setHighlight((h) => (h + 1) % suggestions.length);
    } else if (e.key === "ArrowUp" && suggestions.length > 0) {
      e.preventDefault();
      setHighlight((h) => (h - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === "Backspace" && artistDraft === "" && artists.length > 0) {
      removeArtist(artists[artists.length - 1]);
    } else if (e.key === "Escape") {
      setSuggestions([]);
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
          Artists (optional)
        </div>
        <div
          className={cn(
            "relative mt-2 rounded-2xl border-2 border-stone-900 bg-stone-100 p-2",
            !isHost && "opacity-60",
          )}
        >
          <div className="flex flex-wrap items-center gap-1.5">
            {artists.map((a) => (
              <span
                key={a}
                className="flex items-center gap-1 rounded-full bg-amber-400 px-2.5 py-1 text-xs font-black text-stone-900 shadow-[0_2px_0_0_rgba(0,0,0,0.9)]"
              >
                {a}
                {isHost && (
                  <button
                    type="button"
                    onClick={() => removeArtist(a)}
                    aria-label={`Remove ${a}`}
                    className="ml-0.5 rounded-full hover:bg-amber-300"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </span>
            ))}
            <input
              type="text"
              value={artistDraft}
              disabled={!isHost}
              onChange={(e) => setArtistDraft(e.target.value)}
              onKeyDown={onArtistKeyDown}
              onFocus={() => setFocused(true)}
              onBlur={() => setTimeout(() => setFocused(false), 150)}
              placeholder={
                isHost
                  ? artists.length === 0
                    ? "Type an artist, press Enter…"
                    : atLimit
                      ? unlocking
                        ? "Unlocking…"
                        : `Type, +${EXTRA_ARTIST_COST} Riffs to add`
                      : "Add another…"
                  : "-"
              }
              className="min-w-[8rem] flex-1 bg-transparent px-2 py-1 font-black placeholder:text-stone-400 focus:outline-none"
            />
          </div>
          {isHost && focused && suggestions.length > 0 && (
            <ul className="absolute left-0 right-0 top-full z-20 mt-1 max-h-56 overflow-y-auto rounded-2xl border-2 border-stone-900 bg-stone-50 py-1 shadow-[0_4px_0_0_rgba(0,0,0,0.9)]">
              {suggestions.map((s, i) => (
                <li key={s}>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      addArtist(s);
                    }}
                    onMouseEnter={() => setHighlight(i)}
                    className={cn(
                      "block w-full px-4 py-2 text-left text-sm font-black text-stone-900",
                      i === highlight ? "bg-amber-300" : "hover:bg-amber-100",
                    )}
                  >
                    {s}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <p className="mt-2 text-xs text-stone-500">
          {isHost
            ? isPro
              ? "Press Enter to add. Pro lets you add as many artists as you want."
              : `Press Enter to add. First slot is free, each extra slot costs ${EXTRA_ARTIST_COST} Riffs (or go Pro for unlimited).`
            : "Set by host."}
        </p>
        {isHost && slotError && (
          <p className="mt-1 text-xs font-bold text-rose-700">{slotError}</p>
        )}
      </div>

      <div>
        <div className="flex items-baseline justify-between">
          <div className="text-xs font-bold uppercase tracking-wider text-stone-500">
            Rounds
          </div>
          {!isPro && isHost && (
            <Link
              href="/shop#pro"
              className="text-[10px] font-black uppercase tracking-wider text-amber-700 hover:text-amber-900"
            >
              Pro unlocks 10/15/20 →
            </Link>
          )}
        </div>
        <div className="mt-2 grid grid-cols-4 gap-2">
          {ROUND_OPTIONS.map((r) => {
            const active = rounds === r;
            const locked = !isPro && r > FREE_MAX_ROUNDS;
            return (
              <button
                key={r}
                type="button"
                disabled={!isHost || locked}
                onClick={() => onRoundsChange(r)}
                title={locked ? "Pro unlocks this length" : undefined}
                className={cn(
                  "relative rounded-full border-2 border-stone-900 py-2 text-sm font-black transition",
                  active
                    ? "bg-amber-400 text-stone-900 shadow-[0_3px_0_0_rgba(0,0,0,0.9)]"
                    : locked
                      ? "bg-stone-100 text-stone-400"
                      : "bg-stone-100 text-stone-700 hover:bg-stone-200",
                  (!isHost || locked) && "cursor-not-allowed",
                  !isHost && !locked && "opacity-60",
                )}
              >
                {locked && (
                  <Lock className="absolute right-1.5 top-1.5 h-3 w-3 text-stone-500" />
                )}
                {r}
              </button>
            );
          })}
        </div>
      </div>

      <div className="border-t-2 border-stone-200 pt-3">
        <button
          type="button"
          onClick={() => setAdvancedOpen((o) => !o)}
          className="flex w-full items-center justify-between text-xs font-black uppercase tracking-wider text-stone-500 hover:text-stone-900"
        >
          <span>Advanced settings</span>
          {advancedOpen ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </button>
        {advancedOpen && (
          <label className="mt-3 flex items-start gap-3">
            <input
              type="checkbox"
              checked={allowFeaturedTracks}
              disabled={!isHost}
              onChange={(e) => onAllowFeaturedTracksChange(e.target.checked)}
              className="mt-1 h-4 w-4 cursor-pointer accent-amber-500 disabled:cursor-not-allowed"
            />
            <span className="flex-1">
              <span className="block text-sm font-black text-stone-900">
                Allow feature appearances
              </span>
              <span className="block text-xs text-stone-500">
                Include tracks where the selected artists are only featured
                performers. Off by default, keeps rounds to songs by the
                artist, not songs that just list them in the credits.
              </span>
            </span>
          </label>
        )}
      </div>
    </div>
  );
}
