import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminRequest } from "@/lib/adminAuth";
import { generateRoomCode } from "@/lib/rooms";

const HOST_COOKIE = "riffle_host";
const ONE_YEAR_S = 60 * 60 * 24 * 365;

// Returns the existing host fingerprint cookie or generates a fresh one.
// httpOnly so client JS can't read or rewrite it (clearing localStorage
// won't bypass the daily cap, only clearing cookies / using incognito will).
async function ensureHostCookie(): Promise<{ fingerprint: string; isNew: boolean }> {
  const jar = await cookies();
  const existing = jar.get(HOST_COOKIE)?.value;
  if (existing) return { fingerprint: existing, isNew: false };
  return { fingerprint: crypto.randomUUID(), isNew: true };
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    rounds?: number;
    starting_bank?: number;
    genres?: string[];
    artist_query?: string | null;
  };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Daily host cap: 1 room per UTC day per device fingerprint. Pro users
  // (authenticated only) bypass. Anonymous hosts are tracked by the
  // riffle_host cookie set below.
  const { fingerprint, isNew } = await ensureHostCookie();

  // Admin header (Authorization: Bearer ADMIN_SECRET) gives the same
  // unlimited treatment as Pro, so internal testing can hammer rooms
  // without burning daily caps.
  const isAdmin = isAdminRequest(req);

  let isPro = isAdmin;
  if (!isAdmin && user) {
    const { data } = await supabase.rpc("is_pro_active");
    isPro = data === true;
  }

  if (!isPro) {
    // Use the admin client for the count so we don't depend on RLS for the
    // anon path. Same-day window keyed to UTC midnight.
    const admin = createAdminClient();
    const startOfDayUtc = new Date();
    startOfDayUtc.setUTCHours(0, 0, 0, 0);
    const { count } = await admin
      .from("rooms")
      .select("code", { count: "exact", head: true })
      .eq("host_fingerprint", fingerprint)
      .gte("created_at", startOfDayUtc.toISOString());

    if ((count ?? 0) >= 1) {
      return NextResponse.json(
        {
          error: "rooms_capped",
          message:
            "You can host one Friends room per day on the free tier. Go Pro for unlimited rooms.",
        },
        { status: 402 },
      );
    }
  }

  // Free users get the 5-round cap; Pro can pick anything up to 20.
  const requestedRounds = body.rounds ?? 5;
  const clampedRounds = isPro
    ? Math.max(3, Math.min(20, requestedRounds))
    : Math.max(3, Math.min(5, requestedRounds));

  for (let i = 0; i < 5; i++) {
    const code = generateRoomCode();
    const { error } = await supabase.from("rooms").insert({
      code,
      host_id: user?.id ?? null,
      host_fingerprint: fingerprint,
      status: "lobby",
      mode: "wager",
      rounds_total: clampedRounds,
      current_round: 0,
      starting_bank: Math.max(50, Math.min(500, body.starting_bank ?? 100)),
      genres: Array.isArray(body.genres) ? body.genres.slice(0, 12) : [],
      artist_query:
        typeof body.artist_query === "string" ? body.artist_query.slice(0, 80) : null,
      paused: false,
    });
    if (!error) {
      const res = NextResponse.json({ code });
      if (isNew) {
        res.cookies.set(HOST_COOKIE, fingerprint, {
          httpOnly: true,
          sameSite: "lax",
          path: "/",
          maxAge: ONE_YEAR_S,
          secure: process.env.NODE_ENV === "production",
        });
      }
      return res;
    }
    if (error.code !== "23505") {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }
  return NextResponse.json({ error: "failed to allocate code" }, { status: 500 });
}
