import { NextResponse } from "next/server";
import {
  RegExpMatcher,
  englishDataset,
  englishRecommendedTransformers,
} from "obscenity";
import { createClient } from "@/lib/supabase/server";

// Profanity filter runs server-side so it's tamper-proof.
// englishRecommendedTransformers normalises leetspeak / spacing /
// unicode lookalikes — "5h1t", "s h i t", "ʂ𝒽𝒾𝓉" all match.
const profanityMatcher = new RegExpMatcher({
  ...englishDataset.build(),
  ...englishRecommendedTransformers,
});

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { name?: string };
  const name = (body.name ?? "").trim();

  if (name && profanityMatcher.hasMatch(name)) {
    return NextResponse.json({ ok: false, error: "inappropriate_name" });
  }

  // Skip an auth.getUser() round-trip — the RPC itself returns
  // not_authenticated via auth.uid() when the cookie is missing or
  // expired, and supabase-ssr forwards the JWT to the RPC call
  // automatically.
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("set_display_name", { p_name: name });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}
