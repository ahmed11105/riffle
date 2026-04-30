import type { Metadata } from "next";
import { Suspense } from "react";
import { LeaderboardTabs } from "./LeaderboardTabs";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Leaderboard",
  description: "Longest streaks and most daily wins on Riffle.",
};

type StreakRow = {
  user_id: string;
  current_streak: number;
  longest_streak: number;
  profiles: { display_name: string | null } | null;
};

type WinsRow = {
  user_id: string;
  count: number;
  profiles: { display_name: string | null } | null;
};

type Entry = { id: string; name: string; value: number };

async function loadBoards() {
  const supabase = await createClient();

  // Longest streaks all-time. Top 50 by longest_streak desc.
  const { data: streaksData } = await supabase
    .from("streaks")
    .select("user_id, current_streak, longest_streak, profiles(display_name)")
    .order("longest_streak", { ascending: false })
    .limit(50);

  const longestStreaks: Entry[] = ((streaksData ?? []) as unknown as StreakRow[]).map((r) => ({
    id: r.user_id,
    name: r.profiles?.display_name || "Anonymous",
    value: r.longest_streak,
  }));

  // Active streaks (currently on a streak right now).
  const activeStreaks: Entry[] = ((streaksData ?? []) as unknown as StreakRow[])
    .filter((r) => r.current_streak > 0)
    .sort((a, b) => b.current_streak - a.current_streak)
    .slice(0, 50)
    .map((r) => ({
      id: r.user_id,
      name: r.profiles?.display_name || "Anonymous",
      value: r.current_streak,
    }));

  // Daily wins in the last 30 days. Group client-side because Supabase JS
  // doesn't expose group-by directly.
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 30);
  const { data: winsData } = await supabase
    .from("daily_results")
    .select("user_id, profiles(display_name)")
    .eq("correct", true)
    .gte("puzzle_date", since.toISOString().slice(0, 10));

  const winsByUser = new Map<string, WinsRow>();
  for (const row of (winsData ?? []) as unknown as WinsRow[]) {
    const existing = winsByUser.get(row.user_id);
    if (existing) {
      existing.count++;
    } else {
      winsByUser.set(row.user_id, { ...row, count: 1 });
    }
  }
  const monthlyWins: Entry[] = [...winsByUser.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 50)
    .map((r) => ({
      id: r.user_id,
      name: r.profiles?.display_name || "Anonymous",
      value: r.count,
    }));

  return { longestStreaks, activeStreaks, monthlyWins };
}

async function LeaderboardData() {
  const boards = await loadBoards();
  return <LeaderboardTabs {...boards} />;
}

function LeaderboardFallback() {
  return (
    <div className="mt-6 grid gap-4">
      <div className="h-12 rounded-2xl border-4 border-stone-900 bg-stone-50/10 animate-pulse" />
      <div className="h-64 rounded-3xl border-4 border-stone-900 bg-stone-50/10 animate-pulse" />
    </div>
  );
}

export default function LeaderboardPage() {
  return (
    <main className="flex flex-1 flex-col items-center px-6 py-10 text-amber-100">
      <section className="mt-8 w-full max-w-3xl">
        <h1 className="text-4xl font-black tracking-tight sm:text-5xl">
          Leaderboard
        </h1>
        <p className="mt-2 text-amber-100/70">
          Top 50 across each board. Updated as players finish their daily.
        </p>
        <Suspense fallback={<LeaderboardFallback />}>
          <LeaderboardData />
        </Suspense>
      </section>
    </main>
  );
}
