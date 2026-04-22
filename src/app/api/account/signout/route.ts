import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Server-side sign-out. Goes through @supabase/ssr's cookie writer,
// which sets the auth cookies to empty with maxAge:0 — actually
// clearing them. The browser supabase-js path can hang on the
// navigator.locks Web Lock and skip cookie clearing entirely, so
// after this returns the client should hard-reload to /.
export async function POST() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.json({ ok: true });
}
