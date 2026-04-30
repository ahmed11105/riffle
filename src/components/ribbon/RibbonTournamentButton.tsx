"use client";

import { useEffect, useState } from "react";
import { Trophy } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { createClient } from "@/lib/supabase/client";
import {
  RibbonIconButtonShell,
  type RibbonIconAppearance,
} from "@/components/ribbon/RibbonDailyButton";
import { openTournament } from "@/lib/tournament";
import { applyTournamentEntryOverlay, useSimulation } from "@/lib/simulation";

type ActiveEvent = {
  id: string;
  slug: string;
  ends_at: string;
  milestone_thresholds: { score: number; riffs: number }[];
};

type Entry = { score: number; milestone_claims: number[] };

// Tournament shortcut. Three states map to the icon's three
// appearances:
//   - active (amber + claim badge) when the player has at least
//     one milestone reached but unclaimed
//   - ongoing (pale amber) while the event is running and there's
//     nothing to claim right now — different from the daily's
//     "claimed today" hollow because tournaments run for days
//   - hollow when the event has ended (kept visible for a short
//     window so the player can claim leftovers, then it'll go
//     away when get_active_event stops returning a row)
//
// Click opens the TournamentModal via openTournament() — same
// pattern as the Daily button.
export function RibbonTournamentButton() {
  const { user } = useAuth();
  const sim = useSimulation();
  const [event, setEvent] = useState<ActiveEvent | null>(null);
  const [rawEntry, setRawEntry] = useState<Entry | null>(null);
  const entry = applyTournamentEntryOverlay(rawEntry, sim);

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
        if (!cancelled) setRawEntry(entryData ?? { score: 0, milestone_claims: [] });
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

  const nextIdx = milestones.findIndex(
    (_, i) => !claimed.includes(i) && score < milestones[i].score,
  );
  const target =
    nextIdx >= 0
      ? milestones[nextIdx].score
      : milestones[milestones.length - 1]?.score ?? 1;
  const progress = Math.min(1, score / Math.max(1, target));

  const claimable = milestones.filter(
    (m, i) => score >= m.score && !claimed.includes(i),
  ).length;

  const ended = new Date(event.ends_at).getTime() < Date.now();

  let appearance: RibbonIconAppearance;
  if (ended) appearance = "hollow";
  else if (claimable > 0) appearance = "active";
  else appearance = "ongoing";

  return (
    <RibbonIconButtonShell
      label="Tournament"
      icon={<Trophy className="h-5 w-5" />}
      onClick={openTournament}
      appearance={appearance}
      progress={progress}
      badge={claimable > 0 ? String(claimable) : undefined}
    />
  );
}
