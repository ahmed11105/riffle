import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Server-side rename. The browser supabase-js client routes through
// the navigator.locks Web Lock, which can hang in iOS Safari /
// incognito and stall the rename for the full client-side timeout.
// Calling the RPC server-to-server via cookie-auth has no Web Lock
// involvement so it completes promptly.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { name?: string };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }
  const { data, error } = await supabase.rpc("set_display_name", {
    p_name: body.name ?? "",
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}
