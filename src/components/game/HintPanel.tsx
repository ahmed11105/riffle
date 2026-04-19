"use client";

import { useState } from "react";
import {
  HINT_COSTS,
  HINT_LABELS,
  describeHint,
  type HintKind,
} from "@/lib/riffs/hints";
import { useRiffs } from "@/lib/riffs/useRiffs";
import { useAdminMode } from "@/lib/admin";
import type { RiffleTrack } from "@/lib/itunes";

type RevealedHint = { kind: HintKind; value: string };

type Props = {
  track: RiffleTrack;
  // Hints already revealed this round (shared up so the parent can persist
  // them across re-renders or broadcast them in multiplayer).
  revealed: RevealedHint[];
  onReveal: (hint: RevealedHint) => void;
  // Optional broadcast hook for Rooms, fires after a successful reveal so
  // the room channel can show "X bought a Year hint" to opponents.
  onBroadcast?: (hint: RevealedHint) => void;
  disabled?: boolean;
};

const HINT_ORDER: HintKind[] = ["year", "artist_letter", "artist"];

// Solo / Rooms tracks come from now-pool.json which doesn't carry
// release year inline. When the player buys a year hint we fall back
// to the iTunes lookup route. Artist name is always on the pool track
// so "artist" and "artist_letter" resolve locally.
async function lookupMissingField(
  trackId: string,
  kind: HintKind,
): Promise<string | null> {
  try {
    const res = await fetch(`/api/itunes/lookup?trackId=${encodeURIComponent(trackId)}`);
    if (!res.ok) return null;
    const json = (await res.json()) as {
      releaseYear?: number | null;
      artist?: string | null;
    };
    if (kind === "year") return json.releaseYear ? String(json.releaseYear) : null;
    if (kind === "artist_letter") return json.artist?.[0]?.toUpperCase() ?? null;
    if (kind === "artist") return json.artist ?? null;
  } catch {
    return null;
  }
  return null;
}

// Prefer local track data, fall back to iTunes lookup so the user
// always gets a real answer for their Riffs instead of "Unknown".
async function resolveHintValue(
  track: RiffleTrack,
  kind: HintKind,
): Promise<string> {
  const local = describeHint(track, kind);
  const isPlaceholder =
    local === "Unknown year" ||
    local === "Unknown artist" ||
    local === "?";
  if (!isPlaceholder) return local;
  const fetched = await lookupMissingField(track.id, kind);
  return fetched ?? local;
}

export function HintPanel({ track, revealed, onReveal, onBroadcast, disabled }: Props) {
  const { balance, spend, spending, ready } = useRiffs();
  const [adminOn] = useAdminMode();
  const [error, setError] = useState<string | null>(null);
  const [buying, setBuying] = useState<HintKind | null>(null);
  const revealedKinds = new Set(revealed.map((h) => h.kind));

  async function buyHint(kind: HintKind) {
    setError(null);
    setBuying(kind);
    try {
      // Admin bypass: skip the spend RPC entirely so hints are free.
      if (!adminOn) {
        const cost = HINT_COSTS[kind];
        const result = await spend(cost, "hint", kind);
        if (!result.ok) {
          if (result.reason === "insufficient") {
            setError(`Need ${cost} Riffs. Visit the shop to top up.`);
          } else if (result.reason === "auth") {
            setError("Sign in to use hints.");
          } else {
            setError(result.message ?? "Couldn't buy hint.");
          }
          return;
        }
      }
      const value = await resolveHintValue(track, kind);
      const hint: RevealedHint = { kind, value };
      onReveal(hint);
      onBroadcast?.(hint);
    } finally {
      setBuying(null);
    }
  }

  return (
    <div className="flex w-full max-w-md flex-col gap-3 rounded-2xl border-4 border-stone-900 bg-stone-50 p-4 text-stone-900 shadow-[0_6px_0_0_rgba(0,0,0,0.9)]">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-black uppercase tracking-wider">
          Hints
          {adminOn && (
            <span className="ml-2 rounded bg-amber-400 px-1.5 py-0.5 text-[9px] text-stone-900">
              ADMIN
            </span>
          )}
        </h3>
        <span className="text-xs font-bold text-stone-500">
          Balance: <span className="text-stone-900">{adminOn ? "∞" : ready ? balance : "-"}</span> Riffs
        </span>
      </div>

      {revealed.length > 0 && (
        <ul className="flex flex-col gap-1 rounded-xl border-2 border-stone-900 bg-stone-900 p-3 text-sm text-stone-50 shadow-[0_2px_0_0_rgba(0,0,0,0.9)]">
          {revealed.map((h) => (
            <li key={h.kind} className="flex items-baseline justify-between gap-3">
              <span className="text-xs font-bold uppercase tracking-wider text-stone-400">
                {HINT_LABELS[h.kind]}
              </span>
              <span className="font-black text-amber-300">{h.value}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="grid grid-cols-3 gap-2">
        {HINT_ORDER.map((kind) => {
          const cost = HINT_COSTS[kind];
          const used = revealedKinds.has(kind);
          const cantAfford = !adminOn && ready && balance < cost;
          const isBuyingThis = buying === kind;
          const isDisabled =
            !!disabled || used || spending || cantAfford || isBuyingThis;
          return (
            <button
              key={kind}
              type="button"
              onClick={() => buyHint(kind)}
              disabled={isDisabled}
              className={
                used
                  ? "rounded-xl border-2 border-stone-300 bg-stone-100 px-2 py-2 text-xs font-black text-stone-400"
                  : isDisabled
                    ? "rounded-xl border-2 border-stone-900 bg-stone-100 px-2 py-2 text-xs font-black text-stone-400"
                    : "rounded-xl border-2 border-stone-900 bg-amber-300 px-2 py-2 text-xs font-black text-stone-900 shadow-[0_2px_0_0_rgba(0,0,0,0.9)] active:translate-y-0.5 active:shadow-[0_1px_0_0_rgba(0,0,0,0.9)]"
              }
            >
              <div>{HINT_LABELS[kind]}</div>
              <div className="text-[10px] uppercase tracking-wider opacity-70">
                {used ? "Used" : isBuyingThis ? "…" : adminOn ? "Free" : `${cost} Riffs`}
              </div>
            </button>
          );
        })}
      </div>

      {error && (
        <p className="text-xs font-bold text-rose-700">{error}</p>
      )}
    </div>
  );
}
