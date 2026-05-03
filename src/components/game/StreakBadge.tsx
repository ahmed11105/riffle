"use client";

import { Flame, Snowflake } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthProvider";

// Compact streak + freeze indicator. Renders nothing while loading or
// when there's no streak yet, so it doesn't take space for new users.
// On /daily this sits above the ladder; on results pages it works as
// a wrap-up. Pure visual — no actions; freezes are bought from /shop.
export function StreakBadge({ className }: { className?: string }) {
  const { streak, loading } = useAuth();
  if (loading) return null;
  const current = streak?.current_streak ?? 0;
  const freezes = streak?.freezes_available ?? 0;
  if (current === 0 && freezes === 0) return null;

  return (
    <div
      className={`flex items-center gap-3 rounded-full border-2 border-stone-900 bg-stone-900/80 px-4 py-1.5 text-xs font-black uppercase tracking-wider shadow-[0_3px_0_0_rgba(0,0,0,0.9)] ${className ?? ""}`}
    >
      <span className="inline-flex items-center gap-1.5 text-amber-300">
        <Flame className="h-4 w-4 text-orange-500" strokeWidth={2.5} fill="currentColor" />
        {current}
      </span>
      {freezes > 0 && (
        <>
          <span className="text-stone-700">·</span>
          <span className="inline-flex items-center gap-1.5 text-cyan-300">
            <Snowflake className="h-4 w-4" strokeWidth={2.5} />
            {freezes}
          </span>
        </>
      )}
    </div>
  );
}
