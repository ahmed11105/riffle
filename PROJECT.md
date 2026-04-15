# Riffle — Project Notes

## Project Overview

Riffle is a rebuild of the user's earlier song-guessing game at
https://songgame-puce.vercel.app. The rebuild is mobile-first, designed for
retention and monetization. Positioning: "Heardle you can gamble on, with your
friends, every day."

**Three modes on one engine:**

1. **Daily** — one shared song globally, streak-driven, share-card viral loop
2. **Solo Unlimited** — endless queue with genre filters, XP, levels
3. **Rooms with Wagers** — the signature differentiator. Stake-per-round with a
   length multiplier (1s = 5x, 2s = 3x, 4s = 2x, 8s = 1.5x, 16s = 1x), hot streak
   bonus, one-use insurance.

**Why rebuild:** original game had the wager system (unique among competitors)
but no retention hooks, broken audio (Deezer ORB blocking), and a polluted
catalog dominated by karaoke/compilation albums. The rebuild fixes all three
and adds the daily+streak+share card loop that competitors use to compound.

## User Prompts

### Original Request (2026-04-14)
> study this website https://songgame-puce.vercel.app/ -- I built it to be a
> competitive song guessing game, inspect every aspect of it and let me know
> what you think?

### Rebuild Direction (2026-04-14)
> Ok so I created this game on another computer, but now I want to recreate it
> entirely to look better, play better and feel overall like something that'd
> be worth monetising. … let's build a more appealing version of the game than
> my first attempt. There are a lot of questions that need answering, like how
> will can we reward the players so that it becomes addicting. There's a wager
> system that you didn't discover in your research so please do a better job at
> testing the link I gave you earlier. …

### Naming + Palette (2026-04-14)
> I'm thinking of renaming it to Riffle, but what other names do you suggest?
> Also the new colour palette you suggested works for me. As for the mascot,
> yes lets use the placeholder. Go.

## Tech Stack

- **Next.js 16.2.3** (App Router, Turbopack, Cache Components enabled)
- **React 19.2.4**
- **TypeScript 5**
- **Tailwind CSS 4**
- **Supabase** — Auth, Postgres, Realtime (for rooms)
- **@supabase/ssr** for Next.js server/client clients
- **Zustand** for client game state (installed, not yet used)
- **Framer Motion** (installed, not yet used)
- **lucide-react** for icons
- **iTunes Search API** as the audio source (30s previews, clean catalog, no auth)

## Architecture

- **Audio pipeline:** iTunes Search API → server filters out
  karaoke/compilation garbage in `src/lib/itunes.ts` → preview URL wrapped in
  `/api/audio/[trackId]?src=...` proxy route that re-streams with
  `Content-Type: audio/mp4` and CORS headers (fixing the ORB bug that killed
  the original game).
- **Rendering:** Next 16 Cache Components. Static shell + `use cache` for the
  daily puzzle seed; client components for the interactive game loop.
- **State:** local component state + React for v1. Zustand store is the
  planned home for cross-page game state.
- **Rooms (not built yet):** plan is Supabase Realtime Postgres Changes on
  `rooms` / `room_players` / `room_rounds`, with an optimistic client layer.

## Database Schema (live in Supabase)

Applied by `supabase/migrations/20260414230105_init_schema.sql`. All tables
have RLS enabled.

| Table | Purpose |
|---|---|
| `profiles` | One row per auth user. display_name, avatar, coins, xp, level, is_pro |
| `streaks` | user_id, current/longest streak, last_play_date, freezes_available |
| `tracks` | Normalized catalog cache: id, source, title, artist, album_art, preview_url, genre_tags |
| `packs` | Themed collections (SEO landing pages) |
| `pack_tracks` | Many-to-many |
| `daily_puzzles` | date PK → track_id. One row per day |
| `daily_results` | user_id + date → score, time, clip level |
| `rooms` | 6-char code, host, status, mode, rounds, bank |
| `room_players` | room_code + display_name, bank, correct_count |
| `room_rounds` | room_code + round_num, wagers jsonb, guesses jsonb |
| `achievements` | user unlocks |
| `coin_transactions` | coin ledger |

Realtime publication includes `rooms`, `room_players`, `room_rounds`. A
`handle_new_user` trigger auto-creates `profiles` + `streaks` on auth.users
insert.

## Supabase Configuration

- **Project ref:** `fdmabluqxpmhgempvtig`
- **Dashboard:** https://supabase.com/dashboard/project/fdmabluqxpmhgempvtig
- **Region:** West EU (Ireland)
- **Features in use:** Auth (not yet wired), Database, Realtime (publication
  configured)

## Key Files & Folders

```
riffle-app/
├── src/
│   ├── app/
│   │   ├── layout.tsx            # root layout, fonts, metadata
│   │   ├── page.tsx              # landing (Riffle brand, mascot, CTAs)
│   │   ├── globals.css           # retro amber/cream palette + animations
│   │   ├── daily/
│   │   │   ├── page.tsx          # server: fetches today's track via use cache
│   │   │   └── DailyGame.tsx     # client: game loop
│   │   ├── solo/
│   │   │   ├── page.tsx
│   │   │   └── SoloGame.tsx      # client: endless queue
│   │   └── api/
│   │       ├── itunes/search/route.ts   # autocomplete for GuessInput
│   │       ├── audio/[trackId]/route.ts # CORS-safe audio proxy
│   │       └── songs/random/route.ts    # mixed-pool batch for Solo
│   ├── components/
│   │   ├── branding/
│   │   │   ├── Logo.tsx          # waveform mark + Riffle wordmark
│   │   │   └── Mascot.tsx        # "Boomer" the boombox placeholder
│   │   └── game/
│   │       ├── AudioClip.tsx     # play/pause button + auto-stop at maxSeconds
│   │       ├── ClipLadder.tsx    # 1s/2s/4s/8s/16s pills
│   │       ├── GuessInput.tsx    # input + iTunes autocomplete + skip
│   │       └── RevealCard.tsx    # end-of-round reveal
│   ├── lib/
│   │   ├── utils.ts              # cn(), normalizeGuess(), fuzzyMatchTitle()
│   │   ├── itunes.ts             # Search, lookup, karaoke/compilation filter
│   │   ├── game/
│   │   │   ├── score.ts          # Daily/Solo scoring
│   │   │   └── wager.ts          # length multipliers, hot streak, payout
│   │   └── supabase/
│   │       ├── client.ts         # browser client
│   │       └── server.ts         # server client with cookies()
│   └── types/                    # (reserved for generated supabase types)
├── supabase/
│   ├── config.toml
│   └── migrations/
│       └── 20260414230105_init_schema.sql
├── next.config.ts                # cacheComponents: true, mzstatic remotePatterns
├── .env.local                    # NEXT_PUBLIC_SUPABASE_URL/ANON_KEY
├── .env.local.example
└── PROJECT.md
```

## Environment Variables

`.env.local` (not committed):

- `NEXT_PUBLIC_SUPABASE_URL` — from Supabase dashboard → Settings → API
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — same

## Design Decisions

| Decision | Chosen | Why |
|---|---|---|
| Audio source | iTunes Search API | Free, clean catalog, stable CORS, 30s previews — and the only source that avoids the ORB bug and karaoke pollution of the original |
| Auth model | Anonymous + optional account (Supabase) | Lowest friction to play; retention hooks (streaks, leaderboard) unlock on signup |
| Wager mode | Polished current wager (not Song Poker) | Ship-faster, and still the unique differentiator |
| Scope | Full v1 (~3–4 weeks) | User explicitly wants monetizable product |
| Bundler | Next 16 + Turbopack | Default in Next 16 |
| Rendering | Cache Components (`cacheComponents: true`) | Matches Next 16 direction; static shell + `use cache` + client islands for the game loop |
| Catalog filter | Regex blacklist on artist + track name | Removes "Rockhits", "Best Guitar Songs", karaoke, instrumental, tribute, cover compilations — the exact pollution that wrecked the original app |

## Status (as of 2026-04-14 evening)

### ✅ Working
- Next 16 scaffold + Turbopack + Cache Components enabled
- Retro amber/cream palette + Riffle logo + Boomer mascot placeholder
- Landing page with copy, CTAs, feature cards
- **Daily mode** — end-to-end: deterministic daily seed, audio plays, guess
  ladder advances, reveal card shows, replay works
- **Solo mode** — batch-fetch from iTunes, play through endless queue
- **Audio proxy works** — iTunes preview stream re-served with
  `Content-Type: audio/mp4` and CORS. Verified in Chromium via Playwright:
  `readyState: 4`, `duration: 30s`, no errors. Fixes the core bug from the
  original app.
- **Clean catalog** — verified `/api/songs/random` returns Led Zeppelin,
  Eagles, Queen instead of "Rockhits" karaoke compilations.
- `fuzzyMatchTitle` handles parentheticals, "feat.", accents, punctuation.
- Supabase project `riffle` (ref `fdmabluqxpmhgempvtig`) created and linked;
  full initial schema migration applied to remote.
- `next build` compiles clean, all routes build.

### ⏳ Built but not yet wired to the database
- Daily results, streaks, coins, achievements — tables exist, no UI writes
  to them yet. Daily page picks a deterministic song from iTunes on each
  request instead of persisting the daily puzzle.

### 🚧 Not yet built
- Supabase anonymous + email + Google auth flows
- Profile page
- Rooms (lobby, realtime sync, wager panel, multi-player reveal)
- Themed packs (SEO landing pages, pack detail pages)
- Coins / shop / Stripe subscription plumbing
- Achievements dispatch
- Share card OG image + result emoji grid
- PWA manifest + service worker + install prompt
- Push notifications
- Deploy to Vercel (build is green, just haven't pushed)

## Immediate Next Steps (for a follow-up session)

1. Supabase anonymous auth + profile upsert on first visit.
2. Persist daily results + streak updates.
3. Share card component (emoji grid `🟨⬛🟩` + OG image).
4. Room lobby + realtime wager loop (hardest piece — probably a whole session).
5. Deploy to Vercel, wire env vars.

## Known Issues

- The daily "puzzle" is currently deterministic-from-iTunes, not persisted in
  `daily_puzzles`. Two users playing at the same time may see the same song,
  but there's no per-day history or leaderboard yet.
- `cacheLife` not tuned yet — default is fine for now.
- No observability / logging in API routes (deferred until we have a Vercel
  deployment to wire it into).
