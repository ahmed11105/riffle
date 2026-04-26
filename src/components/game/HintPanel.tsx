"use client";

import { useState } from "react";
import { Check, Gift, Lock } from "lucide-react";
import {
  HINT_COSTS,
  HINT_ICONS,
  HINT_KINDS,
  HINT_LABELS,
  HINT_PREREQS,
  describeHint,
  type HintKind,
} from "@/lib/riffs/hints";
import { useRiffs } from "@/lib/riffs/useRiffs";
import { useAdminMode } from "@/lib/admin";
import { useAuth } from "@/lib/auth/AuthProvider";
import { EarnHintsModal } from "@/components/game/EarnHintsModal";
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
    if (kind === "artist") return json.artist ?? null;
    // Title letters resolve from track.title locally — no iTunes
    // round-trip needed because the title is always present on the
    // pool track that drives the round.
  } catch {
    return null;
  }
  return null;
}

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
  const { profile, mergeProfile } = useAuth();
  const [adminOn] = useAdminMode();
  const [error, setError] = useState<string | null>(null);
  const [buying, setBuying] = useState<HintKind | null>(null);
  const [earnOpen, setEarnOpen] = useState(false);
  const revealedKinds = new Set(revealed.map((h) => h.kind));
  const inventory = profile?.hint_inventory ?? {};

  function getInventory(kind: HintKind): number {
    return inventory[kind] ?? 0;
  }

  async function buyHint(kind: HintKind) {
    setError(null);
    setBuying(kind);
    try {
      let consumed = false;

      if (!adminOn && getInventory(kind) > 0) {
        // Try to consume from banked inventory first via the server
        // route (admin client direct UPDATE — avoids the RPC cold
        // start). 8s client timeout so the spend button can never
        // hang.
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 8000);
        try {
          const res = await fetch("/api/account/consume-hint", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ kind }),
            signal: ctrl.signal,
          });
          const json = (await res.json()) as {
            ok?: boolean;
            consumed?: boolean;
            error?: string;
            hint_inventory?: Record<string, number>;
          };
          if (!res.ok || !json.ok) {
            setError(json.error ?? "Couldn't use banked hint.");
            return;
          }
          if (json.consumed) {
            consumed = true;
            if (json.hint_inventory) {
              mergeProfile({ hint_inventory: json.hint_inventory });
            }
          }
          // consumed=false → inventory was 0; fall through to Riffs.
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Network error.";
          setError(msg.includes("aborted") ? "Request timed out, try again." : msg);
          return;
        } finally {
          clearTimeout(timer);
        }
      }

      if (!adminOn && !consumed) {
        const cost = HINT_COSTS[kind];
        const result = await spend(cost, "hint", kind);
        if (!result.ok) {
          if (result.reason === "insufficient") {
            setError(`Need ${cost} Riffs. Watch an ad below or top up in the shop.`);
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

      {/* Revealed-so-far display, dark contrast pill below */}
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

      {/* Icon-based hint row. Each badge shows either the banked
          quantity (if > 0) or the Riffs cost. Used hints flip to a
          checkmark. Locked hints (e.g. 2nd letter before 1st is
          revealed) show a Lock icon and ignore clicks. */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {HINT_KINDS.map((kind) => {
          const Icon = HINT_ICONS[kind];
          const banked = getInventory(kind);
          const cost = HINT_COSTS[kind];
          const used = revealedKinds.has(kind);
          const prereq = HINT_PREREQS[kind];
          const locked = prereq != null && !revealedKinds.has(prereq);
          const cantAfford = !adminOn && banked === 0 && ready && balance < cost;
          const isBuyingThis = buying === kind;
          const isDisabled =
            !!disabled || used || locked || spending || cantAfford || isBuyingThis;
          return (
            <button
              key={kind}
              type="button"
              onClick={() => buyHint(kind)}
              disabled={isDisabled}
              aria-label={
                locked
                  ? `${HINT_LABELS[kind]} hint (locked, reveal ${HINT_LABELS[prereq!]} first)`
                  : `${HINT_LABELS[kind]} hint`
              }
              title={
                locked ? `Reveal ${HINT_LABELS[prereq!]} first` : undefined
              }
              className={`relative flex flex-col items-center gap-1 rounded-2xl border-2 px-2 pb-1.5 pt-3 transition ${
                used
                  ? "border-stone-300 bg-stone-100 text-stone-400"
                  : locked
                    ? "border-stone-300 bg-stone-100 text-stone-400"
                    : isDisabled
                      ? "border-stone-900 bg-stone-100 text-stone-400 shadow-[0_2px_0_0_rgba(0,0,0,0.9)]"
                      : "border-stone-900 bg-amber-300 text-stone-900 shadow-[0_3px_0_0_rgba(0,0,0,0.9)] active:translate-y-0.5 active:shadow-[0_1px_0_0_rgba(0,0,0,0.9)]"
              }`}
            >
              {used ? (
                <Check className="h-6 w-6" />
              ) : locked ? (
                <Lock className="h-6 w-6" />
              ) : (
                <Icon className="h-6 w-6" />
              )}
              <span className="text-[9px] font-black uppercase tracking-wider">
                {HINT_LABELS[kind]}
              </span>

              {!used && !locked && !adminOn && banked > 0 && (
                <span
                  aria-label={`${banked} banked`}
                  className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-stone-900 bg-emerald-400 px-1 text-[10px] font-black text-stone-900 shadow-[0_1px_0_0_rgba(0,0,0,0.9)]"
                >
                  {banked}
                </span>
              )}

              {used ? (
                <span className="text-[10px] font-black uppercase tracking-wider opacity-70">
                  Used
                </span>
              ) : locked ? (
                <span className="text-[10px] font-black uppercase tracking-wider opacity-60">
                  Locked
                </span>
              ) : (
                <span className="text-[10px] font-black uppercase tracking-wider opacity-70">
                  {adminOn
                    ? "Free"
                    : banked > 0
                      ? "Free"
                      : isBuyingThis
                        ? "…"
                        : `${cost} Riffs`}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Earn free hints — placeholder ad watch. Hidden in admin mode. */}
      {!adminOn && (
        <button
          type="button"
          onClick={() => setEarnOpen(true)}
          className="flex items-center justify-center gap-1.5 rounded-full border-2 border-stone-900 bg-stone-100 py-1.5 text-xs font-black uppercase tracking-wider text-stone-900 transition hover:bg-amber-200"
        >
          <Gift className="h-3.5 w-3.5" /> Earn free hints
        </button>
      )}

      {error && (
        <p className="text-xs font-bold text-rose-700">{error}</p>
      )}

      <EarnHintsModal
        open={earnOpen}
        onClose={() => setEarnOpen(false)}
      />
    </div>
  );
}
