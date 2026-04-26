"use client";

import { useEffect, useState } from "react";
import { X, Sparkles } from "lucide-react";
import { HINT_ICONS, HINT_KINDS, HINT_LABELS, type HintKind } from "@/lib/riffs/hints";
import { useAuth } from "@/lib/auth/AuthProvider";
import { AdSlot } from "@/components/AdSlot";
import { AD_SLOTS } from "@/lib/adslots";

// Forced 5-second placeholder "ad" that grants the player one free
// hint of the kind they selected. Same shell as SoloAdBreak; once
// AdSense / a reward-video SDK is wired the inner content swaps to
// a real ad surface and the grant happens after the SDK's signed
// completion callback.

type Phase = "select" | "watching" | "rewarded" | "error";

export function EarnHintsModal({
  open,
  onClose,
  onEarned,
}: {
  open: boolean;
  onClose: () => void;
  onEarned?: (kind: HintKind) => void;
}) {
  const { mergeProfile } = useAuth();
  const [phase, setPhase] = useState<Phase>("select");
  const [chosen, setChosen] = useState<HintKind | null>(null);
  const [seconds, setSeconds] = useState(5);
  const [error, setError] = useState<string | null>(null);

  // Reset state every time the modal re-opens.
  useEffect(() => {
    if (open) {
      setPhase("select");
      setChosen(null);
      setSeconds(5);
      setError(null);
    }
  }, [open]);

  // Run the "ad" countdown.
  useEffect(() => {
    if (phase !== "watching") return;
    if (seconds <= 0) {
      // Time's up — grant the hint. 8s client timeout so the modal
      // can't get stuck if the network or function cold-start hangs.
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 8000);
      (async () => {
        try {
          const res = await fetch("/api/account/earn-hint", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ kind: chosen }),
            signal: ctrl.signal,
          });
          const json = (await res.json()) as {
            ok?: boolean;
            error?: string;
            hint_inventory?: Record<string, number>;
          };
          if (!res.ok || !json.ok) {
            setError(json.error ?? "Couldn't award hint. Try again.");
            setPhase("error");
            return;
          }
          // Patch the auth context locally with the inventory the
          // server just wrote — no follow-up fetch, no Web Lock risk.
          if (json.hint_inventory) {
            mergeProfile({ hint_inventory: json.hint_inventory });
          }
          if (chosen) onEarned?.(chosen);
          setPhase("rewarded");
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Network error.";
          setError(msg.includes("aborted") ? "Request timed out, try again." : msg);
          setPhase("error");
        } finally {
          clearTimeout(timer);
        }
      })();
      return () => clearTimeout(timer);
    }
    const id = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [phase, seconds, chosen, mergeProfile, onEarned]);

  if (!open) return null;

  const inWatching = phase === "watching";
  const closeable = phase !== "watching";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Earn a free hint"
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/80 px-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-md rounded-3xl border-4 border-stone-900 bg-stone-50 p-5 text-stone-900 shadow-[0_8px_0_0_rgba(0,0,0,0.9)]">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-black">
            {phase === "select" && "Earn a free hint"}
            {phase === "watching" && "Quick break"}
            {phase === "rewarded" && "Hint earned"}
            {phase === "error" && "Something went wrong"}
          </h2>
          {closeable && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex h-8 w-8 items-center justify-center rounded-full text-stone-500 hover:text-stone-900"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Phase: select hint kind */}
        {phase === "select" && (
          <>
            <p className="mt-2 text-sm text-stone-600">
              Watch a 5-second break to bank one free hint. Choose which
              type you want to earn:
            </p>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {HINT_KINDS.map((kind) => {
                const Icon = HINT_ICONS[kind];
                return (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => {
                      setChosen(kind);
                      setSeconds(5);
                      setPhase("watching");
                    }}
                    className="flex flex-col items-center gap-1 rounded-2xl border-2 border-stone-900 bg-amber-300 p-3 text-stone-900 shadow-[0_3px_0_0_rgba(0,0,0,0.9)] transition active:translate-y-0.5 active:shadow-[0_1px_0_0_rgba(0,0,0,0.9)]"
                  >
                    <Icon className="h-6 w-6" />
                    <span className="text-[10px] font-black uppercase tracking-wider">
                      {HINT_LABELS[kind]}
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {/* Phase: forced break before the hint is granted. */}
        {inWatching && (
          <div className="mt-3 space-y-3">
            <div className="min-h-[120px] overflow-hidden rounded-2xl border-2 border-stone-900 bg-stone-100">
              <AdSlot
                slotId={AD_SLOTS.earnHint}
                format="rectangle"
                className="block h-full w-full"
                fallback={
                  <div className="flex h-full min-h-[120px] flex-col items-center justify-center gap-1 p-4 text-stone-700">
                    <p className="text-base font-black">No ad breaks with Riffle Pro</p>
                    <p className="text-xs text-stone-500">
                      £2.99/mo · skip these waits forever
                    </p>
                  </div>
                }
              />
            </div>
            <div className="flex items-center justify-between rounded-xl bg-stone-900 px-4 py-3 text-stone-50">
              <span className="text-xs font-bold uppercase tracking-wider text-stone-400">
                Awarding hint in
              </span>
              <span className="text-3xl font-black tabular-nums text-amber-300">
                {seconds}
              </span>
            </div>
          </div>
        )}

        {/* Phase: success */}
        {phase === "rewarded" && chosen && (
          <div className="mt-3 flex items-center gap-3 rounded-2xl border-2 border-stone-900 bg-emerald-300 p-4">
            <Sparkles className="h-6 w-6 shrink-0" />
            <div>
              <p className="text-base font-black">
                +1 {HINT_LABELS[chosen]} hint
              </p>
              <p className="text-xs text-stone-700">
                Banked. Use it instead of Riffs next time.
              </p>
            </div>
          </div>
        )}

        {/* Phase: error */}
        {phase === "error" && (
          <p className="mt-3 rounded-xl bg-rose-100 px-3 py-2 text-sm font-bold text-rose-700">
            {error}
          </p>
        )}

        {(phase === "rewarded" || phase === "error") && (
          <button
            type="button"
            onClick={onClose}
            className="mt-4 w-full rounded-full border-4 border-stone-900 bg-amber-400 px-6 py-2.5 text-sm font-black text-stone-900 shadow-[0_3px_0_0_rgba(0,0,0,0.9)] active:translate-y-0.5 active:shadow-[0_1px_0_0_rgba(0,0,0,0.9)]"
          >
            Done
          </button>
        )}
      </div>
    </div>
  );
}
