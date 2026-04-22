import { NextResponse } from "next/server";
import {
  RegExpMatcher,
  englishDataset,
  englishRecommendedTransformers,
} from "obscenity";
import { createClient } from "@/lib/supabase/server";

// Server-side rename. The browser supabase-js client routes through
// the navigator.locks Web Lock, which can hang in iOS Safari /
// incognito and stall the rename indefinitely. Calling the RPC
// server-to-server via cookie-auth has no Web Lock involvement so it
// completes promptly.

// Profanity check happens here (not in the client) so it's tamper-
// proof. obscenity's englishDataset covers the standard slurs +
// cusses, and englishRecommendedTransformers normalises leetspeak,
// spacing, and unicode tricks (so "5h1t", "s h i t", "ʂ𝒽𝒾𝓉" are
// all caught).
const profanityMatcher = new RegExpMatcher({
  ...englishDataset.build(),
  ...englishRecommendedTransformers,
});

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { name?: string };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const name = (body.name ?? "").trim();
  if (name && profanityMatcher.hasMatch(name)) {
    return NextResponse.json({ ok: false, error: "inappropriate_name" });
  }

  const { data, error } = await supabase.rpc("set_display_name", { p_name: name });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}
