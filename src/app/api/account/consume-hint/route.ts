import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const VALID_KINDS = new Set(["year", "title_letters", "artist"]);

// Consume one banked hint of the given kind. Direct admin
// read-modify-write to avoid the consume_hint RPC's SECURITY
// DEFINER cold start. Returns { ok: true, consumed: true } if a
// hint was banked and decremented, or { ok: true, consumed: false }
// when the user has no banked hints left (the client then falls
// back to spending Riffs).
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
  const have = current[kind] ?? 0;
  if (have <= 0) {
    return NextResponse.json({ ok: true, consumed: false });
  }
  const next = { ...current, [kind]: have - 1 };
  const { error: updateErr } = await admin
    .from("profiles")
    .update({ hint_inventory: next })
    .eq("id", userId);
  if (updateErr) {
    return NextResponse.json({ ok: false, error: updateErr.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, consumed: true, hint_inventory: next });
}
