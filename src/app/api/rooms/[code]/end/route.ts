import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Force-end the current game and jump to the finished state so the final
// results screen renders for everyone.

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const supabase = await createClient();
  const { error } = await supabase
    .from("rooms")
    .update({ status: "finished", paused: false, phase_started_at: new Date().toISOString() })
    .eq("code", code);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
