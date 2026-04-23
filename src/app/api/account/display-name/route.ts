import { NextResponse } from "next/server";
import {
  RegExpMatcher,
  englishDataset,
  englishRecommendedTransformers,
} from "obscenity";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Server-side rename. Does the work as plain CRUD (read used tags,
// update profile) using the admin client to bypass RLS — avoids
// PostgREST's SECURITY DEFINER cold-start that was making the
// previous set_display_name RPC call hang for many seconds.
//
// Profanity check runs before any DB hit so a tampered client can't
// bypass it.
const profanityMatcher = new RegExpMatcher({
  ...englishDataset.build(),
  ...englishRecommendedTransformers,
});

const MAX_TAG = 9999;

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { name?: string };
  const name = (body.name ?? "").trim();

  if (!name) {
    return NextResponse.json({ ok: false, error: "empty" });
  }
  if (name.length > 24) {
    return NextResponse.json({ ok: false, error: "too_long" });
  }
  if (profanityMatcher.hasMatch(name)) {
    return NextResponse.json({ ok: false, error: "inappropriate_name" });
  }

  // getSession() decodes the cookie locally — no auth-server round
  // trip, unlike getUser().
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });
  }
  const userId = session.user.id;

  const admin = createAdminClient();

  // Same name (case-insensitive) and already has a tag? Just update
  // the casing if it changed; keep the existing tag.
  const { data: existing } = await admin
    .from("profiles")
    .select("display_name, tag")
    .eq("id", userId)
    .maybeSingle();

  if (
    existing?.tag != null &&
    typeof existing.display_name === "string" &&
    existing.display_name.toLowerCase() === name.toLowerCase()
  ) {
    if (existing.display_name !== name) {
      await admin.from("profiles").update({ display_name: name }).eq("id", userId);
    }
    return NextResponse.json({ ok: true, name, tag: existing.tag });
  }

  // Find the lowest unused tag for this lowercased name.
  const { data: usedRows, error: tagErr } = await admin
    .from("profiles")
    .select("tag")
    .ilike("display_name", name)
    .neq("id", userId);
  if (tagErr) {
    return NextResponse.json({ ok: false, error: tagErr.message }, { status: 500 });
  }
  const used = new Set<number>(
    (usedRows ?? [])
      .map((r) => r.tag as number | null)
      .filter((t): t is number => typeof t === "number"),
  );
  let nextTag = 1;
  while (nextTag <= MAX_TAG && used.has(nextTag)) nextTag++;
  if (nextTag > MAX_TAG) {
    return NextResponse.json({ ok: false, error: "name_full" });
  }

  const { error: updateErr } = await admin
    .from("profiles")
    .update({ display_name: name, tag: nextTag })
    .eq("id", userId);
  if (updateErr) {
    return NextResponse.json({ ok: false, error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, name, tag: nextTag });
}
