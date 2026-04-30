import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { EventDetailClient } from "./EventDetailClient";

type EventRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  accent_color: string;
  icon: string;
  starts_at: string;
  ends_at: string;
  milestone_thresholds: { score: number; riffs: number }[];
  badge_label: string | null;
};

type LeaderboardRow = {
  user_id: string;
  score: number;
  display_name: string;
  tag: number | null;
};

// All DB reads live inside this async island so the surrounding shell
// can prerender. Next 16's cacheComponents requires uncached data
// (event row + leaderboard, AND `await params`) to be wrapped in
// Suspense — same pattern /daily uses with TodayTrack.
async function EventBody({
  paramsPromise,
}: {
  paramsPromise: Promise<{ slug: string }>;
}) {
  await connection();
  const { slug } = await paramsPromise;
  const supabase = await createClient();
  const { data: event } = await supabase
    .from("events")
    .select(
      "id, slug, name, description, accent_color, icon, starts_at, ends_at, milestone_thresholds, badge_label",
    )
    .eq("slug", slug)
    .maybeSingle();

  if (!event) notFound();
  const evt = event as EventRow;

  const admin = createAdminClient();
  const { data: rawEntries } = await admin
    .from("event_entries")
    .select("user_id, score")
    .eq("event_id", evt.id)
    .order("score", { ascending: false })
    .limit(50);

  let leaderboard: LeaderboardRow[] = [];
  if (rawEntries && rawEntries.length > 0) {
    const ids = rawEntries.map((r) => r.user_id);
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, display_name, tag")
      .in("id", ids);
    const profMap = new Map<string, { display_name: string; tag: number | null }>(
      (profiles ?? []).map((p) => [p.id, { display_name: p.display_name, tag: p.tag }]),
    );
    leaderboard = rawEntries.map((r) => {
      const prof = profMap.get(r.user_id);
      return {
        user_id: r.user_id,
        score: r.score,
        display_name: prof?.display_name ?? "Player",
        tag: prof?.tag ?? null,
      };
    });
  }

  return <EventDetailClient event={evt} leaderboard={leaderboard} />;
}

function EventSkeleton() {
  return (
    <div className="mt-8 flex min-h-[240px] w-full max-w-md items-center justify-center text-amber-100/70">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-amber-300 border-t-transparent" />
    </div>
  );
}

export default function EventPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  return (
    <main className="flex flex-1 flex-col items-center px-6 py-10">
      <Suspense fallback={<EventSkeleton />}>
        <EventBody paramsPromise={params} />
      </Suspense>
    </main>
  );
}
