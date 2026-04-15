import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Toggle paused state. When unpausing, bump phase_started_at so the client
// countdown restarts the current phase fresh (simpler than tracking pause
// duration).

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const body = (await req.json().catch(() => ({}))) as { paused?: boolean };
  const supabase = await createClient();

  const patch: Record<string, unknown> = { paused: Boolean(body.paused) };
  if (body.paused === false) {
    patch.phase_started_at = new Date().toISOString();
  }

  const { error } = await supabase.from("rooms").update(patch).eq("code", code);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, paused: Boolean(body.paused) });
}
