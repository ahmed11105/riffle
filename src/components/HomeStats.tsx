"use client";

import { useAuth } from "@/lib/auth/AuthProvider";

export function HomeStats() {
  const { profile, streak, loading } = useAuth();

  const streakNum = streak?.current_streak ?? 0;
  const riffs = profile?.coin_balance ?? 0;
  const level = profile?.level ?? 1;

  return (
    <div className="mt-8 flex gap-6 text-sm text-amber-100/60">
      <div>
        <span className="font-black text-amber-300">🔥 {loading ? "—" : streakNum}</span>{" "}
        day streak
      </div>
      <div>
        <span className="font-black text-amber-300">{loading ? "—" : riffs}</span>{" "}
        Riffs
      </div>
      <div>
        <span className="font-black text-amber-300">Lv {loading ? "—" : level}</span>
      </div>
    </div>
  );
}
