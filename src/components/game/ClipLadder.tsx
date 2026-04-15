"use client";

import { cn } from "@/lib/utils";

const LEVELS = [1, 2, 4, 8, 16] as const;

export function ClipLadder({
  currentLevel,
  guesses,
}: {
  currentLevel: number;
  guesses: ("pending" | "skipped" | "wrong" | "correct")[];
}) {
  return (
    <div className="flex w-full max-w-md items-center justify-between gap-2">
      {LEVELS.map((sec, i) => {
        const state = guesses[i] ?? "pending";
        const active = sec === currentLevel;
        return (
          <div
            key={sec}
            className={cn(
              "relative flex-1 rounded-full border-2 border-stone-900 px-2 py-2 text-center text-sm font-black tracking-tight transition",
              state === "correct" && "bg-emerald-400 text-stone-900",
              state === "wrong" && "bg-rose-400 text-stone-900",
              state === "skipped" && "bg-stone-700 text-stone-300",
              state === "pending" && !active && "bg-stone-100/10 text-stone-400",
              state === "pending" && active && "bg-amber-400 text-stone-900 shadow-[0_4px_0_0_rgba(0,0,0,0.9)]",
            )}
          >
            {sec}s
          </div>
        );
      })}
    </div>
  );
}
