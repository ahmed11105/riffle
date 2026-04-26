import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const VALID_KINDS = new Set(["year", "artist_letter", "artist"]);

// Grant a single free hint of the given kind. Called by the client
// after the placeholder ad-watch interstitial finishes its countdown.
//
// When AdSense / a real reward video SDK is wired, the SDK will
// produce a signed completion token (SSV — server-side validation)
// that we'd verify here before granting. For now we trust the client
// because the only "ad" is a 5-second house countdown with no
// monetary value attached. Worst case: a player spams the button to
// get free hints — annoying but not financially exploitable, and the
// per-call rate-limit below caps it at one per 4 seconds.

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

  const { error } = await supabase.rpc("grant_hint", { p_kind: kind, p_amount: 1 });
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
