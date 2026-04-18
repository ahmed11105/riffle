import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Magic-link / OAuth callback. Supabase sends the user here with a one-time
// code that we exchange for a session cookie. Then bounce them back to the
// page they were originally trying to reach (or the lobby).
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(
        new URL(`/?auth_error=${encodeURIComponent(error.message)}`, url.origin),
      );
    }
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
