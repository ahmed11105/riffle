import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const VALID_KINDS = new Set(["year", "title_letters", "artist"]);

// Grant a single free hint of the given kind. Called by the client
// after the placeholder ad-watch interstitial finishes its countdown.
//
// Implemented as a direct admin UPDATE rather than an RPC to dodge
// PostgREST's SECURITY DEFINER cold-start (5-15s on first call by
// a freshly-authenticated user). Read-modify-write is safe here
// because each user only grants their own hints, and the in-memory
// rate-limit below caps concurrent calls to 1 per 4s per user.
//
// When AdSense / a reward video SDK is wired the SDK's signed
// completion token (SSV) gets verified before this update.

const RATE_WINDOW_MS = 4_000;
const lastGrantByUser = new Map<string, number>();

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { kind?: string };
  const kind = body.kind;
  if (!kind || !VALID_KINDS.has(kind)) {
    return NextResponse.json({ ok: false, error: "invalid_kind" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });
  }
  const userId = session.user.id;

  const now = Date.now();
  const last = lastGrantByUser.get(userId) ?? 0;
  if (now - last < RATE_WINDOW_MS) {
    return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
  }
  lastGrantByUser.set(userId, now);

  const admin = createAdminClient();
  const { data: row, error: readErr } = await admin
    .from("profiles")
    .select("hint_inventory")
    .eq("id", userId)
    .maybeSingle();
  if (readErr) {
    return NextResponse.json({ ok: false, error: readErr.message }, { status: 500 });
  }
  const current = (row?.hint_inventory ?? {}) as Record<string, number>;
  const next = { ...current, [kind]: (current[kind] ?? 0) + 1 };

  const { error: updateErr } = await admin
    .from("profiles")
    .update({ hint_inventory: next })
    .eq("id", userId);
  if (updateErr) {
    return NextResponse.json({ ok: false, error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, hint_inventory: next });
}
