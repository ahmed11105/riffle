import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Leave a room voluntarily.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    displayName?: string;
  };
  if (!body.displayName) {
    return NextResponse.json({ error: "missing displayName" }, { status: 400 });
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("room_players")
    .delete()
    .eq("room_code", code)
    .eq("display_name", body.displayName);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
