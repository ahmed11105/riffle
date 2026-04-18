"use client";

import { useState } from "react";

type Entry = { id: string; name: string; value: number };

type Props = {
  longestStreaks: Entry[];
  activeStreaks: Entry[];
  monthlyWins: Entry[];
};

type TabId = "active" | "longest" | "wins";

const TABS: { id: TabId; label: string; valueLabel: string; emptyMsg: string }[] = [
  { id: "active", label: "Active streak", valueLabel: "days", emptyMsg: "No active streaks yet, be the first." },
  { id: "longest", label: "Longest ever", valueLabel: "days", emptyMsg: "No streaks recorded yet." },
  { id: "wins", label: "Wins last 30d", valueLabel: "wins", emptyMsg: "No daily wins recorded yet." },
];

export function LeaderboardTabs({ longestStreaks, activeStreaks, monthlyWins }: Props) {
  const [tab, setTab] = useState<TabId>("active");
  const data = tab === "active" ? activeStreaks : tab === "longest" ? longestStreaks : monthlyWins;
  const meta = TABS.find((t) => t.id === tab)!;

  return (
    <div className="mt-6">
      <div role="tablist" className="flex gap-2 overflow-x-auto">
        {TABS.map((t) => {
          const active = t.id === tab;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={active}
              type="button"
              onClick={() => setTab(t.id)}
              className={
                active
                  ? "rounded-full border-2 border-stone-900 bg-amber-400 px-4 py-2 text-sm font-black text-stone-900 shadow-[0_3px_0_0_rgba(0,0,0,0.9)]"
                  : "rounded-full border-2 border-stone-900 bg-stone-800 px-4 py-2 text-sm font-black text-amber-100 hover:bg-stone-700"
              }
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="mt-4 rounded-3xl border-4 border-stone-900 bg-stone-50 p-2 text-stone-900 shadow-[0_8px_0_0_rgba(0,0,0,0.9)]">
        {data.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-stone-500">
            {meta.emptyMsg}
          </p>
        ) : (
          <ol className="divide-y-2 divide-stone-100">
            {data.map((entry, i) => (
              <li
                key={entry.id}
                className="flex items-center gap-4 px-4 py-3"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-stone-900 bg-amber-100 text-sm font-black">
                  {i + 1}
                </div>
                <div className="min-w-0 flex-1 truncate font-bold">{entry.name}</div>
                <div className="text-right">
                  <div className="text-xl font-black leading-none">{entry.value}</div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
                    {meta.valueLabel}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
