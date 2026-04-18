"use client";

import { useState } from "react";
import { CLIP_LEVELS, LENGTH_MULTIPLIER, type ClipLevel } from "@/lib/game/wager";

type Props = {
  bank: number;
  onLockIn: (amount: number, level: ClipLevel) => void;
  locked?: boolean;
  lockedAmount?: number;
  lockedLevel?: ClipLevel;
};

type Preset = "min" | "25" | "50" | "all";

export function WagerPanel({ bank, onLockIn, locked, lockedAmount, lockedLevel }: Props) {
  const [amount, setAmount] = useState(Math.max(10, Math.floor(bank * 0.25)));
  const [level, setLevel] = useState<ClipLevel>(4);
  // Tracks which preset button is "active" so we can highlight it. We reset
  // this to null the moment the player drags the slider, so the highlight
  // follows the most recent source of the stake value.
  const [activePreset, setActivePreset] = useState<Preset | null>("25");

  function pickPreset(preset: Preset, value: number) {
    setAmount(value);
    setActivePreset(preset);
  }

  if (locked) {
    return (
      <div className="flex w-full max-w-md flex-col items-center gap-3 rounded-3xl border-4 border-stone-900 bg-stone-50 p-6 text-stone-900 shadow-[0_8px_0_0_rgba(0,0,0,0.9)]">
        <div className="text-xs font-bold uppercase tracking-wider text-stone-500">
          Wager locked
        </div>
        <div className="text-3xl font-black">
          {lockedAmount} @ {lockedLevel}s
          <span className="ml-2 text-amber-500">
            ×{LENGTH_MULTIPLIER[lockedLevel ?? 4]}
          </span>
        </div>
        <p className="text-sm text-stone-500">Waiting for other players…</p>
      </div>
    );
  }

  const maxAmount = Math.max(10, bank);
  const potentialPayout = Math.floor(amount * LENGTH_MULTIPLIER[level]);

  return (
    <div className="flex w-full max-w-md flex-col gap-4 rounded-3xl border-4 border-stone-900 bg-stone-50 p-5 text-stone-900 shadow-[0_8px_0_0_rgba(0,0,0,0.9)]">
      <div className="flex items-baseline justify-between">
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-stone-500">
            Your bank
          </div>
          <div className="text-2xl font-black">{bank} coins</div>
        </div>
        <div className="text-right">
          <div className="text-xs font-bold uppercase tracking-wider text-stone-500">
            Payout
          </div>
          <div className="text-2xl font-black text-emerald-600">+{potentialPayout}</div>
        </div>
      </div>

      <div>
        <div className="mb-1 flex items-baseline justify-between">
          <div className="text-xs font-bold uppercase tracking-wider text-stone-500">
            Stake
          </div>
          <div className="text-xl font-black">{amount}</div>
        </div>
        <input
          type="range"
          min={10}
          max={maxAmount}
          step={5}
          value={amount}
          onChange={(e) => {
            setAmount(Number(e.target.value));
            setActivePreset(null);
          }}
          className="w-full accent-amber-500"
        />
        <div className="mt-2 grid grid-cols-4 gap-2">
          {(
            [
              { key: "min", label: "MIN", value: 10, activeBg: "bg-amber-400", idleBg: "bg-stone-100" },
              { key: "25", label: "25%", value: Math.max(10, Math.floor(bank / 4)), activeBg: "bg-amber-400", idleBg: "bg-stone-100" },
              { key: "50", label: "50%", value: Math.max(10, Math.floor(bank / 2)), activeBg: "bg-amber-400", idleBg: "bg-stone-100" },
              { key: "all", label: "ALL IN", value: bank, activeBg: "bg-rose-500 text-stone-50", idleBg: "bg-rose-400" },
            ] as const
          ).map((p) => {
            const active = activePreset === p.key;
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => pickPreset(p.key, p.value)}
                className={
                  active
                    ? `rounded-full border-2 border-stone-900 ${p.activeBg} py-1 text-xs font-black shadow-[0_3px_0_0_rgba(0,0,0,0.9)]`
                    : `rounded-full border-2 border-stone-900 ${p.idleBg} py-1 text-xs font-black`
                }
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <div className="mb-1 text-xs font-bold uppercase tracking-wider text-stone-500">
          Promise to guess within
        </div>
        <div className="grid grid-cols-5 gap-2">
          {CLIP_LEVELS.map((lv) => {
            const active = level === lv;
            return (
              <button
                key={lv}
                type="button"
                onClick={() => setLevel(lv as ClipLevel)}
                className={
                  active
                    ? "rounded-xl border-2 border-stone-900 bg-amber-400 py-2 text-center font-black shadow-[0_3px_0_0_rgba(0,0,0,0.9)]"
                    : "rounded-xl border-2 border-stone-900 bg-stone-100 py-2 text-center font-black text-stone-700 hover:bg-stone-200"
                }
              >
                <div>{lv}s</div>
                <div className="text-[10px] uppercase tracking-wider text-stone-500">
                  ×{LENGTH_MULTIPLIER[lv as ClipLevel]}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <button
        type="button"
        onClick={() => onLockIn(amount, level)}
        className="mt-1 rounded-full border-4 border-stone-900 bg-amber-400 px-6 py-3 text-lg font-black text-stone-900 shadow-[0_4px_0_0_rgba(0,0,0,0.9)] active:translate-y-0.5 active:shadow-[0_2px_0_0_rgba(0,0,0,0.9)]"
      >
        Lock in wager
      </button>
    </div>
  );
}
