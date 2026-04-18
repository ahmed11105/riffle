import { NextRequest, NextResponse } from "next/server";

// Simple in-memory rate limiter for API routes. This runs on the Edge
// runtime and resets when the function cold-starts, so it's not perfect
//, but it's enough to stop casual abuse without needing Redis.
//
// Limits: 30 requests per 60 seconds per IP per route group.

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 30;

const counters = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const entry = counters.get(key);
  if (!entry || now > entry.resetAt) {
    counters.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > MAX_REQUESTS;
}

let lastClean = Date.now();
function cleanOld() {
  const now = Date.now();
  if (now - lastClean < WINDOW_MS) return;
  lastClean = now;
  for (const [key, entry] of counters) {
    if (now > entry.resetAt) counters.delete(key);
  }
}

const RATE_LIMITED_PATHS = [
  "/api/itunes/",
  "/api/artists/",
  "/api/rooms/create",
  "/api/daily/overrides",
  "/api/songs/",
];

export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const shouldLimit = RATE_LIMITED_PATHS.some((p) => path.startsWith(p));
  if (!shouldLimit) return NextResponse.next();

  cleanOld();
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";
  const key = `${ip}:${path}`;

  if (isRateLimited(key)) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 },
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};
