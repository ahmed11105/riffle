"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { AdSlot } from "@/components/AdSlot";
import { AD_SLOTS } from "@/lib/adslots";

// Forced 5-second break shown between Solo rounds for free players.
// For now the slot renders a Pro upsell card (the only "ad" we have);
// when AdSense / a reward video SDK is wired later, this is the
// component that swaps to a real third-party slot. Pro and admin
// users never mount this.
export function SoloAdBreak({ onContinue }: { onContinue: () => void }) {
  const [seconds, setSeconds] = useState(5);

  useEffect(() => {
    if (seconds <= 0) return;
    const id = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [seconds]);

  const ready = seconds <= 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Ad break"
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/80 px-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-md rounded-3xl border-4 border-stone-900 bg-stone-50 p-6 text-stone-900 shadow-[0_8px_0_0_rgba(0,0,0,0.9)]">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-wider text-stone-500">
            Quick break
          </p>
          <span className="text-xs font-bold tabular-nums text-stone-500">
            {ready ? "ready" : `${seconds}s`}
          </span>
        </div>

        {/* AdSense ad slot. Renders the configured Display unit
            once AD_SLOTS.soloAdBreak is set; until then shows a Pro
            upsell as a brand-safe fallback. */}
        <div className="mt-3 min-h-[140px] overflow-hidden rounded-2xl border-2 border-stone-900 bg-amber-100">
          <AdSlot
            slotId={AD_SLOTS.soloAdBreak}
            format="rectangle"
            className="block h-full w-full"
            fallback={
              <div className="flex items-start gap-3 p-4">
                <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
                <div>
                  <p className="text-base font-black text-stone-900">
                    No ad breaks with Riffle Pro
                  </p>
                  <p className="mt-0.5 text-sm text-stone-700">
                    £2.99/mo · skip these breaks, unlimited Friends rooms,
                    unlimited rounds, free artist filters.
                  </p>
                  <Link
                    href="/shop"
                    className="mt-2 inline-flex items-center rounded-full border-2 border-stone-900 bg-amber-400 px-4 py-1.5 text-xs font-black uppercase tracking-wider text-stone-900 shadow-[0_2px_0_0_rgba(0,0,0,0.9)] active:translate-y-0.5 active:shadow-[0_1px_0_0_rgba(0,0,0,0.9)]"
                  >
                    Try Pro
                  </Link>
                </div>
              </div>
            }
          />
        </div>

        <button
          type="button"
          onClick={ready ? onContinue : undefined}
          disabled={!ready}
          className="mt-4 w-full rounded-full border-4 border-stone-900 bg-amber-400 px-6 py-3 text-sm font-black text-stone-900 shadow-[0_4px_0_0_rgba(0,0,0,0.9)] transition active:translate-y-0.5 active:shadow-[0_2px_0_0_rgba(0,0,0,0.9)] disabled:bg-stone-200 disabled:text-stone-500 disabled:shadow-[0_4px_0_0_rgba(0,0,0,0.4)]"
        >
          {ready ? "Continue →" : `Continue in ${seconds}s`}
        </button>
      </div>
    </div>
  );
}
