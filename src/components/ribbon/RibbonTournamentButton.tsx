"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Trophy } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { createClient } from "@/lib/supabase/client";
import { RibbonIconButtonShell } from "@/components/ribbon/RibbonDailyButton";

type ActiveEvent = {
  id: string;
  slug: string;
  milestone_thresholds: { score: number; riffs: number }[];
};

type Entry = { score: number; milestone_claims: number[] };

// Tournament shortcut. When an event is live the icon links to
// /events/<slug> and shows a progress bar toward the next unclaimed
// milestone (goal-gradient cue) plus a corner badge counting any
// milestones currently ready to claim. When no event is active, the
// button hides itself — better than a dead icon.
export function RibbonTournamentButton() {
  const { user } = useAuth();
  const [event, setEvent] = useState<ActiveEvent | null>(null);
  const [entry, setEntry] = useState<Entry | null>(null);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    (async () => {
      const { data } = await supabase.rpc("get_active_event");
      if (cancelled) return;
      const row = (data as ActiveEvent[] | null)?.[0] ?? null;
      setEvent(row);
      if (row && user) {
        const { data: entryData } = await supabase
          .from("event_entries")
          .select("score, milestone_claims")
          .eq("event_id", row.id)
          .eq("user_id", user.id)
          .maybeSingle();
        if (!cancelled) setEntry(entryData ?? { score: 0, milestone_claims: [] });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (!event) return null;

  const score = entry?.score ?? 0;
  const claimed = entry?.milestone_claims ?? [];
  const milestones = event.milestone_thresholds ?? [];

  // Next unclaimed milestone defines the progress target. If
  // everything is claimed, peg progress at 1 (full bar).
  const nextIdx = milestones.findIndex(
    (_, i) => !claimed.includes(i) && score < milestones[i].score,
  );
  const target = nextIdx >= 0 ? milestones[nextIdx].score : milestones[milestones.length - 1]?.score ?? 1;
  const progress = Math.min(1, score / Math.max(1, target));

  // Count milestones the player can claim right now (score >=
  // threshold, not yet claimed).
  const claimable = milestones.filter(
    (m, i) => score >= m.score && !claimed.includes(i),
  ).length;

  return (
    <Link href={`/events/${event.slug}`} aria-label="Active event">
      <RibbonIconButtonShell
        label="Active event"
        icon={<Trophy className="h-5 w-5" />}
        onClick={() => {}}
        progress={progress}
        badge={claimable > 0 ? String(claimable) : undefined}
      />
    </Link>
  );
}
